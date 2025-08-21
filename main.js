/*
 * Jellyfin Pause Screen script by BobHasNoSoul 
 * Source: https://github.com/n00bcodr/Jellyfish/blob/main/scripts/pausescreen.js
 * Original: https://github.com/BobHasNoSoul/Jellyfin-PauseScreen
 */

(function () {
  'use strict';

  class JellyfinPauseScreen {
    constructor() {
      // Video state
      this.currentVideo = null;
      this.currentItemId = null;

      // Auth state
      this.userId = null;
      this.token = null;

      // DOM elements
      this.overlay = null;
      this.overlayContent = null;
      this.overlayPlot = null;
      this.overlayDetails = null;

      // Timers and observers
      this.observer = null;
      this.overlayTimer = null;
      this.lastMouseMovement = Date.now();

      // Recovery state
      this.recoveryAttempts = 0;
      this.lastRecoveryTime = 0;
      this.maxRecoveryAttempts = 3;
      this.recoveryBackoffMs = 1000;

      this.init();
    }

    init() {
      try {
        const credentials = this.getCredentials();
        if (!credentials) {
          console.debug('[PauseScreen] No credentials found, retrying in 5s...');
          setTimeout(() => this.retryInit(), 5000);
          return;
        }

        this.userId = credentials.userId;
        this.token = credentials.token;

        this.createOverlay();
        this.setupVideoObserver();

        // Reset recovery state on successful init
        this.recoveryAttempts = 0;
        this.lastRecoveryTime = 0;
      } catch (error) {
        console.error('[PauseScreen] Error in init:', error);
        this.handleInitError();
      }
    }

    retryInit() {
      if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
        console.error('[PauseScreen] Max recovery attempts reached, giving up');
        return;
      }

      const now = Date.now();
      const timeSinceLastRecovery = now - this.lastRecoveryTime;
      const backoff = this.recoveryBackoffMs * Math.pow(2, this.recoveryAttempts);

      if (timeSinceLastRecovery < backoff) {
        console.debug('[PauseScreen] Too soon to retry, waiting...');
        setTimeout(() => this.retryInit(), backoff - timeSinceLastRecovery);
        return;
      }

      console.debug(`[PauseScreen] Recovery attempt ${this.recoveryAttempts + 1}/${this.maxRecoveryAttempts}`);
      this.recoveryAttempts++;
      this.lastRecoveryTime = now;
      this.init();
    }

    handleInitError() {
      // Clean up any partial initialization
      this.clearState();

      // Attempt recovery
      this.retryInit();
    }

    async getCredentials() {
      // Add retry mechanism for credential fetching
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const creds = localStorage.getItem("jellyfin_credentials");
          if (!creds) {
            console.debug('[PauseScreen] No credentials found, retrying...');
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            continue;
          }

          const parsed = JSON.parse(creds);
          const server = parsed.Servers?.[0];
          if (!server) {
            console.debug('[PauseScreen] No server info found, retrying...');
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            continue;
          }

          return { token: server.AccessToken, userId: server.UserId };
        } catch (error) {
          console.error('[PauseScreen] Error getting credentials:', error);
          if (attempt === 2) return null;
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
      return null;
    }

    createOverlay() {
      try {
        // Create overlay structure
        this.overlay = document.createElement("div");
        this.overlay.id = "video-overlay";
        this.overlay.setAttribute("role", "dialog");
        this.overlay.setAttribute("aria-label", "Video Information");
        this.overlay.setAttribute("aria-modal", "true");
        this.overlay.setAttribute("tabindex", "-1");

        this.overlayContent = document.createElement("div");
        this.overlayContent.id = "overlay-content";
        this.overlayContent.setAttribute("role", "document");

        // Create info container to hold both details and plot
        const infoContainer = document.createElement("div");
        infoContainer.className = "overlay-info-container";

        this.overlayDetails = document.createElement("div");
        this.overlayDetails.id = "overlay-details";
        this.overlayDetails.setAttribute("role", "heading");
        this.overlayDetails.setAttribute("aria-level", "1");

        this.overlayPlot = document.createElement("div");
        this.overlayPlot.id = "overlay-plot";
        this.overlayPlot.setAttribute("role", "article");
        this.overlayPlot.setAttribute("aria-label", "Plot description");

        // Assemble overlay
        infoContainer.appendChild(this.overlayDetails);
        infoContainer.appendChild(this.overlayPlot);
        this.overlayContent.appendChild(infoContainer);
        this.overlay.appendChild(this.overlayContent);

        document.body.appendChild(this.overlay);
      } catch (error) {
        console.error('[PauseScreen] Error creating overlay:', error);
        return;
      }

      // Store previous focus before showing overlay
      this.previousActiveElement = null;

      // Add keyboard event handler
      this.overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          this.hideOverlay();
          if (this.currentVideo?.paused) {
            this.currentVideo.play();
          }
        }
      });

      // Add click handler to unpause when clicking on overlay
      this.overlay.addEventListener('click', (event) => {
        if (event.target === this.overlay || event.target === this.overlayContent) {
          this.hideOverlay();
          if (this.currentVideo?.paused) {
            this.currentVideo.play();
          }
        }
      });

      // Add touch event listener
      this.overlay.addEventListener('touchstart', (event) => {
        if (event.target === this.overlay || event.target === this.overlayContent) {
          this.hideOverlay();
          if (this.currentVideo?.paused) {
            this.currentVideo.play();
          }
        }
      });

      // Add mousemove listener
      this.overlay.addEventListener('mousemove', (event) => {
        if (event.target === this.overlay || event.target === this.overlayContent) {
          this.hideOverlay();
        }
      });
    }

    setupVideoObserver() {
      try {
        // Cleanup existing observer if any
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }

        // Create new observer with error recovery
        this.observer = new MutationObserver(() => {
          try {
            this.checkForVideoChanges();
          } catch (error) {
            console.error('[PauseScreen] Error in video observer:', error);
            // Reset state and try to recover
            this.clearState();
            // Attempt to reconnect observer
            this.reconnectObserver();
          }
        });

        this.observer.observe(document.body, {
          childList: true,
          subtree: true
        });

        // Initial check with recovery
        this.checkForVideoChanges();
      } catch (error) {
        console.error('[PauseScreen] Error setting up video observer:', error);
        // Attempt to recover by retrying after delay
        setTimeout(() => this.setupVideoObserver(), 5000);
      }
    }

    async reconnectObserver() {
      console.debug('[PauseScreen] Attempting to reconnect observer');

      // Wait a bit before trying to reconnect
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        this.setupVideoObserver();
      } catch (error) {
        console.error('[PauseScreen] Failed to reconnect observer:', error);
        // Try again after longer delay
        setTimeout(() => this.reconnectObserver(), 5000);
      }
    }

    checkForVideoChanges() {
      const video = document.querySelector(".videoPlayerContainer video");

      if (video && video !== this.currentVideo) {
        this.handleVideoChange(video);
      } else if (!video && this.currentVideo) {
        this.clearState();
      }
    }

    async handleVideoChange(video) {
      try {
        this.clearState();
        this.currentVideo = video;
        this.cleanupListeners = this.attachVideoListeners(video);

        // Retry getting itemId with exponential backoff
        let itemId = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          itemId = this.checkForItemId(true);
          if (itemId) break;

          console.debug(`[PauseScreen] ItemId not found, retry attempt ${attempt + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }

        if (itemId) {
          this.currentItemId = itemId;
          await this.fetchItemInfo(itemId);
        } else {
          console.debug('[PauseScreen] Failed to get itemId after retries');
        }
      } catch (error) {
        console.error('[PauseScreen] Error in handleVideoChange:', error);
        // Reset state and try to recover
        this.clearState();
        // Reinitialize video observer
        this.setupVideoObserver();
      }
    }

    checkForItemId(force = false) {
      const now = Date.now();
      if (!force && now - this.lastItemIdCheck < 500) {
        return this.currentItemId;
      }
      this.lastItemIdCheck = now;

      const selectors = [
        '.videoOsdBottom-hidden > div:nth-child(1) > div:nth-child(4) > button:nth-child(3)',
        'div.page:nth-child(3) > div:nth-child(3) > div:nth-child(1) > div:nth-child(4) > button:nth-child(3)',
        '.btnUserRating'
      ];

      for (const selector of selectors) {
        const ratingButton = document.querySelector(selector);
        const dataId = ratingButton?.getAttribute('data-id');
        if (dataId) {
          return dataId;
        }
      }

      return null;
    }

    attachVideoListeners(video) {
      const videoContainer = document.querySelector('.videoPlayerContainer');
      const videoOsdPage = document.querySelector('#videoOsdPage');

      this.currentContainer = videoContainer;

      // Set up periodic container verification
      this.containerCheckInterval = setInterval(() => {
        if (!this.currentContainer || !document.body.contains(this.currentContainer)) {
          this.handleVideoChange(this.currentVideo);
        }
      }, 1000);

      let mouseMoveListener = null;

      // Create a single debounced function instance for the video's lifetime
      const handleMouseMove = (() => {
        let timeout = null;
        return () => {
          if (timeout) {
            clearTimeout(timeout);
          }

          // Use RAF for smoother performance
          requestAnimationFrame(() => {
            timeout = setTimeout(() => {
              if (this.overlayVisible) {
                this.hideOverlay();
              }
              this.lastMouseMovement = Date.now();
              // Only start timer if video is still paused
              if (video.paused && video === this.currentVideo) {
                this.startOverlayTimer();
              }
              timeout = null;
            }, 150); // Debounce time
          });
        };
      })();

      const addMouseMoveListener = () => {
        if (!mouseMoveListener) {
          mouseMoveListener = handleMouseMove;
          // Add listener to both videoContainer and videoOsdPage
          if (videoContainer) {
            videoContainer.addEventListener("mousemove", mouseMoveListener);
          }
          if (videoOsdPage) {
            videoOsdPage.addEventListener("mousemove", mouseMoveListener);
          }
        }
      };

      const removeMouseMoveListener = () => {
        if (mouseMoveListener) {
          if (videoContainer) {
            videoContainer.removeEventListener("mousemove", mouseMoveListener);
          }
          if (videoOsdPage) {
            videoOsdPage.removeEventListener("mousemove", mouseMoveListener);
          }
          mouseMoveListener = null;
        }
        if (mouseMoveTimeout) {
          clearTimeout(mouseMoveTimeout);
          mouseMoveTimeout = null;
        }
      };

      const handlePause = () => {
        if (video === this.currentVideo && !video.ended) {
          addMouseMoveListener();
          const newItemId = this.checkForItemId(true);
          if (newItemId && newItemId !== this.currentItemId) {
            this.currentItemId = newItemId;
            this.fetchItemInfo(newItemId);
          }
          this.startOverlayTimer();
        }
      };

      const handlePlay = () => {
        if (video === this.currentVideo) {
          removeMouseMoveListener();
          this.hideOverlay();
          this.clearOverlayTimer();
        }
      };

      const handleMouseEnter = () => {
        this.mouseOverVideo = true;
        this.startOverlayTimer();
      };

      const handleMouseLeave = () => {
        this.mouseOverVideo = false;
        this.startOverlayTimer();
      };

      video.addEventListener("pause", handlePause);
      video.addEventListener("play", handlePlay);
      video.addEventListener("mouseenter", handleMouseEnter);
      video.addEventListener("mouseleave", handleMouseLeave);

      if (video.paused) {
        addMouseMoveListener();
      }

      return () => {
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("mouseenter", handleMouseEnter);
        video.removeEventListener("mouseleave", handleMouseLeave);
        removeMouseMoveListener();
      };
    }

    startOverlayTimer() {
      this.clearOverlayTimer();

      // Set timer to show overlay after 10 seconds if:
      // 1. Video is paused AND no mouse movement for 10s
      this.overlayTimer = setTimeout(() => {
        const timeSinceLastMovement = Date.now() - this.lastMouseMovement;
        if (this.currentVideo?.paused && timeSinceLastMovement >= 10000) {
          this.showOverlay();
        }
      }, 10000);
    }

    clearOverlayTimer() {
      if (this.overlayTimer) {
        clearTimeout(this.overlayTimer);
        this.overlayTimer = null;
      }
    }

    showOverlay() {
      if (this.pendingTransition) {
        return;
      }

      this.overlayVisible = true;
      this.pendingTransition = true;

      // Store the currently focused element
      this.previousActiveElement = document.activeElement;

      // Make the main content inaccessible to screen readers
      document.body.setAttribute('aria-hidden', 'true');

      // Remove aria-hidden from the overlay
      this.overlay.removeAttribute('aria-hidden');

      // First make element visible without transition
      this.overlay.style.display = "flex";
      this.overlay.style.opacity = "0";

      // Force browser to process display change
      void this.overlay.offsetWidth;

      // Now add visible class to trigger transition
      requestAnimationFrame(() => {
        this.overlay.classList.add('visible');
        this.overlay.style.opacity = "";

        // Focus the overlay for keyboard navigation
        this.overlay.focus();

        setTimeout(() => {
          this.pendingTransition = false;
        }, 300);
      });
    }

    hideOverlay() {
      this.clearOverlayTimer();

      if (!this.overlayVisible || this.pendingTransition) {
        return;
      }

      this.pendingTransition = true;
      this.overlayVisible = false;

      // Remove visible class to trigger transition
      this.overlay.classList.remove('visible');

      // Make the main content accessible again to screen readers
      document.body.removeAttribute('aria-hidden');

      // Hide overlay from screen readers
      this.overlay.setAttribute('aria-hidden', 'true');

      // Restore focus to the previous element
      if (this.previousActiveElement && document.body.contains(this.previousActiveElement)) {
        this.previousActiveElement.focus();
        this.previousActiveElement = null;
      }

      // Wait for transition to complete before hiding
      setTimeout(() => {
        if (!this.overlayVisible) {
          this.overlay.style.display = "none";
          this.pendingTransition = false;
        }
      }, 300);
    }

    clearDisplayData() {
      this.overlayPlot.textContent = "";
      this.overlayDetails.innerHTML = "";
    }

    async fetchItemInfo(itemId) {
      console.debug('[PauseScreen] Fetching item info for:', itemId);
      this.clearDisplayData();

      try {
        const domain = window.location.origin;
        const item = await this.fetchWithRetry(`${domain}/Items/${itemId}`, {
          headers: { "X-Emby-Token": this.token }
        });

        console.debug('[PauseScreen] Successfully fetched item info:', item.Type);
        this.displayItemInfo(item);
      } catch (error) {
        console.debug('[PauseScreen] Error fetching item info:', error);
        this.overlayPlot.textContent = "Unable to fetch item info.";
      }
    }

    async fetchWithRetry(url, options, maxRetries = 2) {
      for (let i = 0; i <= maxRetries; i++) {
        try {
          const response = await fetch(url, options);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return await response.json();
        } catch (error) {
          if (i === maxRetries) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }

    displayItemInfo(item) {
      console.debug('[PauseScreen] Displaying item info for type:', item.Type);

      // Create the content structure with ARIA live region for dynamic updates
      this.overlayDetails.innerHTML = `
        <div class="watching-label" aria-live="polite">You're watching</div>
      `;

      // Handle Series vs Movie
      if (item.Type === 'Episode') {
        const seriesName = item.SeriesName || '';
        const seasonNumber = item.ParentIndexNumber || '';
        const episodeNumber = item.IndexNumber || '';
        const episodeName = item.Name || '';

        const episodeDescription = `${seriesName}, Season ${seasonNumber}, Episode ${episodeNumber}: ${episodeName}`;
        this.overlay.setAttribute('aria-label', `Video Information - ${episodeDescription}`);

        this.overlayDetails.innerHTML += `
          <div class="content-title" aria-label="${seriesName}">${seriesName}</div>
          ${seasonNumber ? `<div class="season-info" aria-label="Season ${seasonNumber}">Season ${seasonNumber}</div>` : ''}
          ${episodeNumber ? `<div class="episode-info" aria-label="${episodeName}, Episode ${episodeNumber}">${episodeName}: Ep. ${episodeNumber}</div>` : ''}
        `;
      } else {
        // Movie or other content
        const title = item.Name || '';
        this.overlay.setAttribute('aria-label', `Video Information - ${title}`);
        this.overlayDetails.innerHTML += `
          <div class="content-title" aria-label="${title}">${title}</div>
        `;
      }

      // Set overview/plot with ARIA description
      const overview = item.Overview || 'No description available';
      this.overlayPlot.textContent = overview;
      this.overlayPlot.setAttribute('aria-label', `Plot: ${overview}`);
    }


    clearState() {
      try {
        // Clear overlay and display
        this.hideOverlay();
        this.clearDisplayData();

        // Clean up event listeners
        if (this.cleanupListeners) {
          this.cleanupListeners();
          this.cleanupListeners = null;
        }

        // Clear intervals
        if (this.containerCheckInterval) {
          clearInterval(this.containerCheckInterval);
          this.containerCheckInterval = null;
        }

        // Reset state
        this.mouseOverVideo = true;
        this.overlayVisible = false;
        this.pendingTransition = false;
        this.lastMouseMovement = Date.now();

        this.currentItemId = null;
        this.currentVideo = null;
        this.currentContainer = null;

        // Clean up orphaned elements
        this.cleanupOrphanedElements();
      } catch (error) {
        console.error('[PauseScreen] Error in clearState:', error);
        // If clearState fails, attempt maximum cleanup
        this.destroy();
        // Attempt to reinitialize if necessary
        if (this.recoveryAttempts < this.maxRecoveryAttempts) {
          console.debug('[PauseScreen] Attempting recovery after clearState failure');
          this.retryInit();
        }
      }
    }

    cleanupOrphanedElements() {
      // Remove any duplicate overlay elements
      const orphanedOverlays = document.querySelectorAll('#video-overlay');
      orphanedOverlays.forEach(overlay => {
        if (overlay !== this.overlay && overlay.parentNode) {
          console.debug('[PauseScreen] Removing orphaned overlay');
          overlay.parentNode.removeChild(overlay);
        }
      });
    }

    destroy() {
      try {
        console.debug('[PauseScreen] Destroying pause screen');

        // Clear state first to stop any ongoing operations
        this.clearState();

        // Clean up observer with error handling
        if (this.observer) {
          try {
            console.debug('[PauseScreen] Disconnecting observer');
            this.observer.disconnect();
          } catch (error) {
            console.error('[PauseScreen] Error disconnecting observer:', error);
          } finally {
            this.observer = null;
          }
        }

        // Clean up intervals
        if (this.containerCheckInterval) {
          try {
            clearInterval(this.containerCheckInterval);
          } catch (error) {
            console.error('[PauseScreen] Error clearing container interval:', error);
          } finally {
            this.containerCheckInterval = null;
          }
        }

        // Clean up DOM elements
        if (this.overlay?.parentNode) {
          try {
            console.debug('[PauseScreen] Removing overlay from DOM');
            this.overlay.parentNode.removeChild(this.overlay);
          } catch (error) {
            console.error('[PauseScreen] Error removing overlay:', error);
            // Fallback cleanup attempt
            this.overlay.style.display = 'none';
          } finally {
            this.overlay = null;
          }
        }

        // Final cleanup of any remaining timeouts
        if (this.overlayTimer) {
          clearTimeout(this.overlayTimer);
          this.overlayTimer = null;
        }

        if (this.mouseMoveTimeout) {
          clearTimeout(this.mouseMoveTimeout);
          this.mouseMoveTimeout = null;
        }
      } catch (error) {
        console.error('[PauseScreen] Fatal error during cleanup:', error);
        // Attempt one final forced cleanup
        try {
          this.observer?.disconnect();
          this.overlay?.parentNode?.removeChild(this.overlay);
        } catch {
          // Ignore any errors in final cleanup
        }
      }
    }
  }

  // Initialize the pause screen
  new JellyfinPauseScreen();
})();
