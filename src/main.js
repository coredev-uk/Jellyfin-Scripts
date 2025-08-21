/*
 * Jellyfin Pause Screen script by BobHasNoSoul 
 * Source: https://github.com/n00bcodr/Jellyfish/blob/main/scripts/pausescreen.js
 * Original: https://github.com/BobHasNoSoul/Jellyfin-PauseScreen
 */

/**
 * TODO: 
 * Remove item logo on overlay
 * Redo overlay format to following:
 *   You're watching (small grey text)
 *   Item Title (large text)
 *   Season X (smaller bold text)
 *   (small gap)
 *   Episode Name: Ep. Number (also smaller bold text)
 *   Episode Plot (grey smaller text)
 * (restructure html as such)
 * Change overlay showing to only when paused and no mouse movement is detected for 10 seconds.
 * When overlay is showing, if moue movement is detected, hide overlay. And after 10 seconds of no mouse movement, show overlay again.
 * If overlay is clicked on, hide overlay as well as unpause the video.
 * Keep simplicity and syncrounous, add comments where appropriate, remove redundant stuff
 */

(function () {
  'use strict';

  class JellyfinPauseScreen {
    constructor() {
      this.currentVideo = null;
      this.currentItemId = null;
      this.userId = null;
      this.token = null;
      this.lastItemIdCheck = 0;
      this.cleanupListeners = null;
      this.imageCache = new Map();
      this.observer = null;

      // DOM elements
      this.overlay = null;
      this.overlayContent = null;
      this.overlayLogo = null;
      this.overlayPlot = null;
      this.overlayDetails = null;
      this.overlayDisc = null;

      this.init();
    }

    init() {
      const credentials = this.getCredentials();
      if (!credentials) {
        console.error("Jellyfin credentials not found");
        return;
      }

      this.userId = credentials.userId;
      this.token = credentials.token;

      this.createOverlay();
      this.setupVideoObserver();
    }

    getCredentials() {
      const creds = localStorage.getItem("jellyfin_credentials");
      if (!creds) return null;

      try {
        const parsed = JSON.parse(creds);
        const server = parsed.Servers?.[0];
        return server ? { token: server.AccessToken, userId: server.UserId } : null;
      } catch {
        return null;
      }
    }

    createOverlay() {
      // Add CSS styles
      const style = document.createElement("style");
      style.textContent = `
                #video-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    z-index: 0;
                    display: none;
                    color: white;
                    font-family: inherit;
                }

                #overlay-content {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    backdrop-filter: blur(5px);
                }

                #overlay-logo {
                    position: absolute;
                    max-width: 45vw;
                    max-height: 20vh;
                    width: auto;
                    height: auto;
                    top: 20vh;
                    left: 8vw;
                    display: block;
                    object-fit: contain;
                }

                #overlay-plot {
                    position: absolute;
                    top: 55vh;
                    left: 8vw;
                    max-width: 50vw;
                    height: 50vh;
                    display: block;
                    font-size: 18px;
                    line-height: 1.6;
                    overflow-y: auto;
                    text-align: left;
                } 

                #overlay-details {
                    position: absolute;
                    top: 45vh;
                    left: 8vw;
                    font-size: 16px;
                    display: flex;
                    gap: 2rem;
                    align-items: center;
                }

                #overlay-disc {
                    position: absolute;
                    top: calc(50vh - (26vw / 2));
                    right: 5vw;
                    width: 26vw;
                    height: auto;
                    display: block;
                    animation: 30s linear infinite spin;
                    z-index: 1;
                    filter: brightness(80%);
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* Tablet and smaller desktop screens */
                @media (max-width: 1400px) {
                    #overlay-logo {
                        max-width: 40vw;
                        left: 6vw;
                        top: 18vh;
                    }

                    #overlay-details {
                        left: 6vw;
                        top: 42vh;
                        font-size: 16px;
                    }

                    #overlay-plot {
                        top: 50vh;
                        left: 6vw;
                        max-width: 48vw;
                        font-size: 16px;
                    }

                    #overlay-disc {
                        width: 24vw;
                        top: calc(50vh - (24vw / 2));
                        right: 4vw;
                    }
                }

                /* Tablet screens */
                @media (max-width: 768px) {
                    #overlay-logo {
                        max-width: 70vw;
                        left: 50%;
                        transform: translateX(-50%);
                        top: 12vh;
                    }

                    #overlay-details {
                        left: 50%;
                        transform: translateX(-50%);
                        top: 32vh;
                        font-size: 14px;
                        justify-content: center;
                    }

                    #overlay-plot {
                        top: 40vh;
                        left: 50%;
                        transform: translateX(-50%);
                        max-width: 85vw;
                        text-align: center;
                        font-size: 15px;
                        height: 45vh;
                    }

                    #overlay-disc {
                        width: 18vw;
                        top: calc(50vh - (18vw / 2));
                        right: 3vw;
                    }
                }

                /* Mobile screens */
                @media (max-width: 480px) {
                    #overlay-logo {
                        max-width: 80vw;
                        top: 10vh;
                    }

                    #overlay-details {
                        top: 26vh;
                        font-size: 12px;
                        gap: 0.8rem;
                        flex-wrap: wrap;
                    }

                    #overlay-plot {
                        top: 34vh;
                        max-width: 90vw;
                        font-size: 14px;
                        height: 50vh;
                    }

                    #overlay-disc {
                        width: 16vw;
                        top: calc(50vh - (16vw / 2));
                        right: 2vw;
                    }
                }

                /* Very small mobile screens */
                @media (max-width: 360px) {
                    #overlay-logo {
                        max-width: 85vw;
                        top: 8vh;
                    }

                    #overlay-details {
                        top: 22vh;
                        font-size: 11px;
                        gap: 0.6rem;
                    }

                    #overlay-plot {
                        top: 30vh;
                        max-width: 95vw;
                        font-size: 13px;
                        height: 55vh;
                    }

                    #overlay-disc {
                        width: 14vw;
                        top: calc(50vh - (14vw / 2));
                        right: 1vw;
                    }
                }

                #overlay-logo:not([src]),
                #overlay-disc:not([src]) {
                    display: none;
                }

                .videoOsdBottom {
                    z-index: 1 !important;
                }

                video {
                    z-index: -1 !important;
                }
            `;
      document.head.appendChild(style);

      // Create overlay structure
      this.overlay = document.createElement("div");
      this.overlay.id = "video-overlay";

      this.overlayContent = document.createElement("div");
      this.overlayContent.id = "overlay-content";

      this.overlayLogo = document.createElement("img");
      this.overlayLogo.id = "overlay-logo";

      this.overlayPlot = document.createElement("div");
      this.overlayPlot.id = "overlay-plot";

      this.overlayDetails = document.createElement("div");
      this.overlayDetails.id = "overlay-details";

      this.overlayDisc = document.createElement("img");
      this.overlayDisc.id = "overlay-disc";

      // Assemble overlay
      this.overlayContent.appendChild(this.overlayLogo);
      this.overlayContent.appendChild(this.overlayDetails);
      this.overlayContent.appendChild(this.overlayPlot);
      this.overlay.appendChild(this.overlayContent);
      this.overlay.appendChild(this.overlayDisc);

      document.body.appendChild(this.overlay);

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
    }

    setupVideoObserver() {
      // Use MutationObserver for better performance than continuous polling
      this.observer = new MutationObserver(() => {
        this.checkForVideoChanges();
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Initial check
      this.checkForVideoChanges();
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
      this.clearState();
      this.currentVideo = video;
      this.cleanupListeners = this.attachVideoListeners(video);

      const itemId = this.checkForItemId(true);
      if (itemId) {
        this.currentItemId = itemId;
        await this.fetchItemInfo(itemId);
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
      const handlePause = () => {
        if (video === this.currentVideo && !video.ended) {
          const newItemId = this.checkForItemId(true);
          if (newItemId && newItemId !== this.currentItemId) {
            this.currentItemId = newItemId;
            this.fetchItemInfo(newItemId);
          }
          this.showOverlay();
        }
      };

      const handlePlay = () => {
        if (video === this.currentVideo) {
          this.hideOverlay();
        }
      };

      video.addEventListener("pause", handlePause);
      video.addEventListener("play", handlePlay);

      return () => {
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("play", handlePlay);
      };
    }

    showOverlay() {
      this.overlay.style.display = "flex";
    }

    hideOverlay() {
      this.overlay.style.display = "none";
    }

    clearDisplayData() {
      this.overlayPlot.textContent = "";
      this.overlayDetails.innerHTML = "";
      this.overlayLogo.removeAttribute('src');
      this.overlayDisc.removeAttribute('src');
    }

    async fetchItemInfo(itemId) {
      this.clearDisplayData();

      try {
        const domain = window.location.origin;
        const item = await this.fetchWithRetry(`${domain}/Items/${itemId}`, {
          headers: { "X-Emby-Token": this.token }
        });

        await this.displayItemInfo(item, domain, itemId);
      } catch (error) {
        console.error("Error fetching item info:", error);
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

    async displayItemInfo(item, domain, itemId) {
      // Display basic info
      const year = item.ProductionYear || "";
      const rating = item.OfficialRating || "";
      const runtime = this.formatRuntime(item.RunTimeTicks);

      this.overlayDetails.innerHTML = [
        year && `<span>${year}</span>`,
        rating && `<span class="mediaInfoOfficialRating" rating="${rating}">${rating}</span>`,
        runtime && `<span>${runtime}</span>`
      ].filter(Boolean).join('');

      this.overlayPlot.textContent = item.Overview || "No description available";

      // Load images concurrently
      await Promise.allSettled([
        this.loadLogo(item, domain, itemId),
        this.loadDisc(item, domain, itemId)
      ]);
    }

    formatRuntime(runTimeTicks) {
      if (!runTimeTicks) return "";

      const totalMinutes = Math.floor(runTimeTicks / 600000000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    async loadLogo(item, domain, itemId) {
      const logoUrls = this.getLogoUrls(item, domain, itemId);

      for (const url of logoUrls) {
        if (await this.tryLoadImage(url)) {
          this.overlayLogo.src = url;
          return;
        }
      }
    }

    async loadDisc(item, domain, itemId) {
      const discUrls = this.getDiscUrls(item, domain, itemId);

      for (const url of discUrls) {
        if (await this.tryLoadImage(url)) {
          this.overlayDisc.src = url;
          return;
        }
      }
    }

    getLogoUrls(item, domain, itemId) {
      const urls = [];

      if (item.ImageTags?.Logo) {
        urls.push(`${domain}/Items/${itemId}/Images/Logo?tag=${item.ImageTags.Logo}`);
      }

      if (item.ParentId) {
        urls.push(`${domain}/Items/${item.ParentId}/Images/Logo`);
      }

      if (item.SeriesId) {
        urls.push(`${domain}/Items/${item.SeriesId}/Images/Logo`);
      }

      return urls;
    }

    getDiscUrls(item, domain, itemId) {
      const urls = [`${domain}/Items/${itemId}/Images/Disc`];

      if (item.ParentId) {
        urls.push(`${domain}/Items/${item.ParentId}/Images/Disc`);
      }

      if (item.SeriesId) {
        urls.push(`${domain}/Items/${item.SeriesId}/Images/Disc`);
      }

      return urls;
    }

    async tryLoadImage(url) {
      if (this.imageCache.has(url)) {
        return this.imageCache.get(url);
      }

      try {
        const img = new Image();
        const loaded = new Promise((resolve, reject) => {
          img.onload = () => resolve(true);
          img.onerror = () => reject(false);
          setTimeout(() => reject(false), 3000);
        });

        img.src = url;
        const result = await loaded;
        this.imageCache.set(url, result);
        return result;
      } catch {
        this.imageCache.set(url, false);
        return false;
      }
    }

    clearState() {
      this.hideOverlay();
      this.clearDisplayData();

      if (this.cleanupListeners) {
        this.cleanupListeners();
        this.cleanupListeners = null;
      }

      this.currentItemId = null;
      this.currentVideo = null;
    }

    destroy() {
      this.clearState();

      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      this.imageCache.clear();

      if (this.overlay?.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    }
  }

  // Initialize the pause screen
  new JellyfinPauseScreen();
})();
