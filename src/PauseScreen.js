/*
 * Title: Netflix-Style Pause Overlay
 * Version: v2.0
 * Author: Original: BobHasNoSoul, n00bcodr / Refactored: Core
 * Description: Displays a Netflix-style overlay on video pause, showing rich media metadata (title, season, synopsis) and hides after mouse inactivity.
 */

(function () {
  'use strict';

  // --- Logging Utility ---
  // Note: Logging is essential for debugging dynamic player scripts.
  function log(type, msg, errorDetails = null) {
    if (type === 'debug' && !OverlayController.debug) return;

    const prefix = `[PauseOverlay] [${type.toUpperCase()}]`;
    if (errorDetails) {
      console.error(prefix, msg, errorDetails);
    } else {
      console[type](prefix, msg);
    }
  }

  // --- Overlay Class: Handles the DOM and Styling ---

  class Overlay {
    static DOM_ID = "video-overlay";
    static CONTENT_CLASS = "overlay-content";

    constructor() {
      this.isShowing = false;
      this.dom = null;
      this.content = null;
      this.videoElement = null; // Store video element for unpausing
      this.init();
    }

    init() {
      // CSS is now inside the class constructor, ensuring it's injected exactly once.
      const style = document.createElement("style");
      style.textContent = `
                #${Overlay.DOM_ID} {
                    height: 100%;
                    width: 100%;
                    background: rgba(0, 0, 0, .5);
                    position: absolute;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.5s ease, visibility 0.5s ease;
                    z-index: 9999; /* Ensure overlay is above Jellyfin controls */
                }

                #${Overlay.DOM_ID}.show {
                    opacity: 1;
                    visibility: visible;
                }
                /* CSS for overlay content remains unchanged */
                .${Overlay.CONTENT_CLASS} {
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  color: white;
                  height: 100%;
                  width: 100%;
                  padding-left: 10%;
                }
                .header-subtitle {
                  font-size: 1.2rem;
                  margin-left: 0.4rem;
                  font-weight: 400;
                  color: rgb(204, 204, 204);
                }
                .header {
                  color: white;
                  font-weight: 500;
                  margin-top: 0;
                  margin-bottom: 0;
                  font-size: 4em;
                }
                .season-title {
                  font-size: 1.5rem;
                  margin: 0.4rem 0 0;
                  color: white;
                  font-weight: 500;
                }
                .episode-title {
                  color: white;
                  font-weight: 500;
                }
                .episode-title[data-has-rating="true"] {
                  display: inline-flex;
                  gap: 2rem;
                }
                .episode-title .mediaInfoOfficialRating {
                  transform: scale(1.05) !important;
                  margin: auto 0;
                  pointer-events: none;
                }
                .synopsis {
                  font-weight: 400;
                  color: rgb(204, 204, 204);
                  width: 60%;
                  margin: 0;
                }
            `;
      document.head.appendChild(style);
    }

    show() {
      if (!this.dom || this.isShowing) return;
      log("debug", "Showing overlay");
      this.dom.classList.add('show');
      this.dom.classList.remove('hide');
      this.isShowing = true;
    }

    hide() {
      if (!this.dom || !this.isShowing) return;
      log("debug", "Hiding overlay");
      this.dom.classList.add('hide');
      this.dom.classList.remove('show');
      this.isShowing = false;
    }

    clear() {
      if (!this.content) return;
      log("debug", "Clearing content");
      this.hide();
      this.content.innerHTML = '';
    }

    destroy() {
      this.dom?.remove();
      this.dom = null;
      this.content = null;
      this.videoElement = null;
      log("debug", "Overlay DOM destroyed.");
    }

    create(video) {
      if (this.dom) {
        log("debug", "Overlay already exists");
        this.videoElement = video; // Update reference
        return;
      }
      const container = document.querySelector('.videoPlayerContainer');
      if (!container) {
        log("error", "Video container not found, cannot create overlay.");
        return;
      }

      // Create overlay structure
      this.dom = document.createElement("div");
      this.dom.id = Overlay.DOM_ID;

      this.content = document.createElement("div");
      this.content.classList.add(Overlay.CONTENT_CLASS);
      this.dom.appendChild(this.content);
      this.videoElement = video;

      // Ensure overlay is appended to the video container
      container.appendChild(this.dom);

      const clickHandler = (event) => {
        // Check if the click was directly on the overlay or content, not on hidden video controls
        if (event.target === this.dom || event.target === this.content) {
          this.hide();
          // Use optional chaining for safer access
          if (this.videoElement?.paused) {
            this.videoElement.play();
          }
        }
      }

      this.dom.addEventListener('click', clickHandler);
      this.dom.addEventListener('touchstart', clickHandler);
    }

    apply(item) {
      if (!item?.Type) { // Use optional chaining for safer item check
        log("warn", "No valid item data provided, blocking overlay.");
        return;
      }

      if (!this.content) {
        log("error", "Overlay content not initialized.");
        return;
      }

      log("debug", `Displaying info for item ${item.Name} (${item.Type})`);

      // Use temporary variables for cleaner string building
      let htmlContent = '';
      let subtitle = `<span class="header-subtitle">You're watching</span>`;

      switch (item.Type) {
        case "Episode":
          // Header
          htmlContent += subtitle;
          htmlContent += `<h2 class="header">${item.SeriesName || 'Unknown Series'}</h2>`;
          htmlContent += `<h4 class="season-title">${item.SeasonName || 'Unknown Season'}</h4>`;

          // Main content
          htmlContent += `<h3 class="episode-title">${item.Name || 'Unknown Episode'} (Ep. ${item.IndexNumber || '?'})</h3>`;
          htmlContent += `<p class="synopsis">${item.Overview || "No description available."}</p>`;
          break;

        case "Movie":
          // Header
          htmlContent += subtitle;
          htmlContent += `<h2 class="header">${item.Name || 'Unknown Movie'}</h2>`;

          // Main content - Use the custom attribute 'rating' as intended by your CSS
          // The Movie type has OfficialRating directly available.
          const ratingHtml = item.OfficialRating ? `<p class="mediaInfoOfficialRating" rating="${item.OfficialRating}">${item.OfficialRating}</p>` : '';
          const runTime = this.formatTime(item.RunTimeTicks);

          htmlContent += `<h3 class="episode-title" data-has-rating="${!!item.OfficialRating}">${item.ProductionYear || ""} ${ratingHtml} ${runTime}</h3>`;
          htmlContent += `<p class="synopsis">${item.Overview || "No description available."}</p>`;
          break;

        default:
          log("warn", `Unmapped item type: ${item.Type}.`);
          return; // Return early if type is unhandled
      }

      this.content.innerHTML = htmlContent;
    }

    formatTime(runTimeTicks) {
      if (!runTimeTicks) return "";

      // Use standard Math.round for better performance than Math.floor where possible
      const totalMinutes = Math.round(runTimeTicks / 600000000); // 60M ticks/second * 60 seconds/minute * 10 = 600M
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
  }

  // --- Controller Class: Handles State, Events, and API ---

  class OverlayController {
    static debug = true; // Central debug control: Set to false to disable all logs
    static RETRY_COUNT = 3;

    constructor() {
      this.currentItemId = null;
      this.credentials = null; // Store credentials object
      this.cleanupListeners = null;
      this.observer = null;
      this.currentVideo = null;
      this.overlay = new Overlay();
      this.mouseMoveTimeout = null;
      this.lastMouseMove = 0;
      this.timeoutDuration = 10 * 1000; // 10 Seconds

      this.init();
    }

    init() {
      this.credentials = this.getCredentials();
      if (!this.credentials) {
        log("error", "Jellyfin credentials not found. Script disabled.");
        return;
      }
      this.setupVideoObserver();
      log("info", "Initialised successfully.");
    }

    /**
     * Enhanced credential retrieval: cleaner and more defensive.
     */
    getCredentials() {
      try {
        const creds = localStorage.getItem("jellyfin_credentials");
        if (!creds) return null;

        const parsed = JSON.parse(creds);
        // Use Array.find to safely get the active/first server
        const server = parsed.Servers?.find(s => s.AccessToken) || parsed.Servers?.[0];

        if (server?.AccessToken && server?.UserId) {
          return { token: server.AccessToken, userId: server.UserId };
        }
      } catch (e) {
        log("error", "Failed to parse credentials from localStorage.", e);
      }
      return null;
    }

    setupVideoObserver() {
      // Observe the body for video player container changes (entering/exiting video playback)
      this.observer = new MutationObserver(() => {
        this.checkForVideoChanges();
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      this.checkForVideoChanges();
    }

    checkForVideoChanges() {
      // Target the video element directly
      const video = document.querySelector(".videoPlayerContainer video");
      if (video && video !== this.currentVideo) {
        // New video started
        this.handleVideoChange(video);
      } else if (!video && this.currentVideo) {
        // Video ended or player closed
        this.clearState();
      }
    }

    handleVideoChange(video) {
      this.clearState(); // Clean up old listeners/state
      this.currentVideo = video;

      this.overlay.create(video); // Create/update overlay element

      // Setup new event listeners and get cleanup function
      this.cleanupListeners = this.setupOverlayListeners(video);
    }

    /**
     * Sets up pause/play and mouse move event listeners.
     */
    setupOverlayListeners(video) {
      const handleMove = () => {
        this.lastMouseMove = Date.now();
        this.overlay.hide();
        clearTimeout(this.mouseMoveTimeout);

        // Re-arm timeout
        this.mouseMoveTimeout = setTimeout(async () => {
          log("debug", "Mouse inactive timeout reached.");
          const now = Date.now();
          // Check if mouse is still inactive AND video is paused
          if ((now - this.lastMouseMove) >= this.timeoutDuration && this.currentVideo?.paused) {
            await this.setOverlay();
          }
        }, this.timeoutDuration); // Use the full timeout duration here
      }

      const handlePause = async () => {
        if (video !== this.currentVideo || video.ended) return;
        log("debug", "Video paused event detected.");

        // Attach move listeners only on pause
        document.addEventListener("mousemove", handleMove);
        document.addEventListener("touchmove", handleMove);

        // Immediately check if mouse is already inactive (e.g., if paused via keyboard)
        const now = Date.now();
        if ((now - this.lastMouseMove) >= this.timeoutDuration) {
          // If mouse has been inactive long enough, show overlay immediately
          await this.setOverlay();
        } else {
          // Otherwise, start the timeout check
          handleMove();
        }
      };

      const handlePlay = () => {
        if (video !== this.currentVideo) return;
        log("debug", "Video playing event detected. Hiding overlay.");
        this.overlay.hide();

        // Remove move listeners and stop timeout on play
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("touchmove", handleMove);
        clearTimeout(this.mouseMoveTimeout);
      };

      video.addEventListener("pause", handlePause);
      video.addEventListener("play", handlePlay);

      // Return a function to clean up all added listeners
      return () => {
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("play", handlePlay);
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("touchmove", handleMove);
        clearTimeout(this.mouseMoveTimeout);
        this.overlay.destroy();
      };
    }

    async setOverlay() {
      const id = this.getItemId();

      if (!id) {
        log("warn", "Item ID not found, cannot update overlay.");
        return;
      }

      if (id && id !== this.currentItemId) {
        const item = await this.fetchItemInfo(id);
        this.overlay.apply(item);
        this.currentItemId = id;
      }
      this.overlay.show();
    }

    /**
     * Attempts to extract the current item's ID from the DOM.
     * Optimization: Target reliable data attributes instead of brittle nth-child selectors.
     */
    getItemId(force = true) {
      // Rate limit ID checks to prevent excessive DOM querying
      if (!force && (Date.now() - this.lastItemIdCheck) < 500) {
        return this.currentItemId;
      }
      this.lastItemIdCheck = Date.now();

      // Prioritize reliable elements often visible in the player OSD (e.g., rating button, settings button)
      const ratingButton = document.querySelector('.btnUserRating'); // Most reliable selector
      const dataId = ratingButton?.getAttribute('data-id');

      if (dataId) {
        return dataId;
      }

      // Fallback to searching the main video container for data-itemid (less reliable, but a good check)
      const videoOsd = document.querySelector('.videoOsdBottom-hidden');
      const osdItemId = videoOsd?.querySelector('[data-itemid]')?.getAttribute('data-itemid');

      if (osdItemId) {
        return osdItemId;
      }

      return null;
    }

    /** * Fetch item info from Jellyfin API with simplified access to credentials.
     */
    async fetchItemInfo(id) {
      try {
        const item = await this.fetchWithRetry(`${window.location.origin}/Items/${id}`, {
          headers: { "X-Emby-Token": this.credentials.token }
        }, OverlayController.RETRY_COUNT); // Use static retry count
        return item;
      } catch (error) {
        log("error", "Error fetching item info:", error);
      }
    }

    /**
     * Fetch helper with clear async/await retry logic.
     */
    async fetchWithRetry(url, options, maxRetries) {
      for (let i = 0; i < maxRetries; i++) {
        try {
          const response = await fetch(url, options);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return await response.json();
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          // Exponential backoff delay
          await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
        }
      }
    }

    clearState() {
      log("debug", "Clearing controller state.");
      this.overlay.clear();

      if (this.cleanupListeners) {
        this.cleanupListeners(); // Calls the function returned by setupOverlayListeners
        this.cleanupListeners = null;
      }

      this.currentItemId = null;
      this.currentVideo = null;
      clearTimeout(this.mouseMoveTimeout);
    }

    destroy() {
      log("info", "Script destroyed.");
      this.clearState();

      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    }
  }

  // Initialize the overlay controller when the script runs
  new OverlayController();
})();
