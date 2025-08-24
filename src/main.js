/*
 * Jellyfin Pause Overlay script by BobHasNoSoul modified by n00bcodr
 * Modified (again) to match Netflix style by Core
 * Source: https://github.com/n00bcodr/Jellyfish/blob/main/scripts/pausescreen.js
 * Original: https://github.com/BobHasNoSoul/Jellyfin-PauseScreen
 */

(function () {
  'use strict';

  function log(type, msg) {
    console[type](`[PauseOverlay]`, msg);
  }

  class Overlay {
    constructor() {
      this.isShowing = false;
      this.dom = null;
      this.content = null;

      this.init();
    }

    init() {
      const style = document.createElement("style");
      style.textContent = `
            #video-overlay {
                height: 100%;
                width: 100%;
                background: rgba(0, 0, 0, .5);
                position: absolute;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.5s ease, visibility 0.5s ease;
            }

            #video-overlay.show {
                opacity: 1;
                visibility: visible;
            }

            #video-overlay.hide {
                opacity: 0;
                visibility: hidden;
            }

            .overlay-content {
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
      log("debug", "Showing overlay")
      this.dom.classList.add('show');
      this.dom.classList.remove('hide');
      this.isShowing = true;
    }

    hide() {
      if (!this.dom || !this.isShowing) return;
      log("debug", "Hiding overlay")
      this.dom.classList.add('hide');
      this.dom.classList.remove('show');
      this.isShowing = false;
    }

    clear() {
      if (!this.content) return;
      log("debug", "Clearing")
      this.hide();
      this.content.innerHTML = '';
    }

    destroy() {
      this.dom?.remove();
    }

    create(video) {
      if (this.dom) {
        log("debug", "Overlay already exists");
        return; // Already created
      }
      const container = document.querySelector('.videoPlayerContainer')
      if (!container) {
        log("error", "Video container not found, cannot create overlay.");
        return;
      }

      // Create overlay structure
      this.dom = document.createElement("div");
      this.dom.id = "video-overlay";

      this.content = document.createElement("div");
      this.content.classList.add("overlay-content")
      this.dom.appendChild(this.content);

      container.appendChild(this.dom);

      const clickHandler = (event) => {
        if (event.target === this.dom || event.target === this.content) {
          this.hide();
          if (video?.paused) {
            video.play();
          }
        }
      }

      // Add click handler to unpause when clicking on overlay
      this.dom.addEventListener('click', clickHandler);
      this.dom.addEventListener('touchstart', clickHandler);
    }

    apply(item) {
      this.clear();

      if (!item) {
        log("warn", "No item data provided, blocking overlay.");
        return;
      }

      if (!this.content) this.create();

      log("debug", `Displaying info for item ${item.Name} (${item.Type})`);

      switch (item.Type) {
        case "Episode":
          // Header
          this.content.innerHTML = `<span class="header-subtitle">You're watching</span>`
          this.content.innerHTML += `<h2 class="header">${item.SeriesName}</h2>`
          this.content.innerHTML += `<h4 class="season-title">${item.SeasonName}</h4>`

          // Main content
          this.content.innerHTML += `<h3 class="episode-title">${item.Name} (Ep. ${item.IndexNumber})</h3>`;
          this.content.innerHTML += `<p class="synopsis">${item.Overview || "No description available."}</p>`;
          break;

        case "Movie":
          // Header
          this.content.innerHTML = `<span class="header-subtitle">You're watching</span>`
          this.content.innerHTML += `<h2 class="header">${item.Name}</h2>`

          // Main content
          this.content.innerHTML += `<h3 class="episode-title" data-has-rating="true">${item.ProductionYear || ""} <p class="mediaInfoOfficialRating" rating="${item.OfficialRating}">${item.OfficialRating}</p> ${this.formatTime(item.RunTimeTicks) || ""}</h3>`;
          this.content.innerHTML += `<p class="synopsis">${item.Overview || "No description available."}</p>`;
          break;

        default:
          this.clear();
      }
    }

    formatTime(runTimeTicks) {
      if (!runTimeTicks) return "";

      const totalMinutes = Math.floor(runTimeTicks / 600000000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

  }

  class OverlayController {
    constructor() {
      // Video and item tracking
      this.currentItemId = null;

      // Auth
      this.userId = null;
      this.token = null;

      // State helpers
      this.lastMouseMove = 0;
      this.lastItemIdCheck = 0;
      this.cleanupListeners = null;
      this.observer = null;

      // DOM elements
      this.currentVideo = null;
      this.overlay = new Overlay();

      // Timers
      this.mouseMoveTimeout = null;
      this.lastMouseMove = 0;
      this.timeoutDuration = 10 * 1000 // 10 Seconds

      this.init();
    }

    init() {
      const credentials = this.getCredentials();
      if (!credentials) {
        log("error", "Jellyfin credentials not found");
        return;
      }
      this.userId = credentials.userId;
      this.token = credentials.token;
      this.setupVideoObserver();
      log("info", "Initialised successfully");
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

      // Create the initial listeners and overlay
      this.cleanupListeners = this.setupOverlay(video);
      await this.setOverlay(false);
    }

    async setOverlay(show = false) {
      const id = this.getItemId();

      if (!id) log("warn", "Item ID not found, cannot update overlay.");

      if (id && id !== this.currentItemId) {
        this.currentItemId = id;
        const item = await this.fetchItemInfo(id)
        this.overlay.apply(item);
      }
      if (show) this.overlay.show();

    }

    setupOverlay(video) {
      this.overlay.create(video);

      const handleMove = () => {
        this.lastMouseMove = Date.now();
        this.overlay.hide();
        clearTimeout(this.mouseMoveTimeout);
        this.mouseMoveTimeout = setTimeout(async () => {
          log("debug", "Mouse inactive, showing overlay if paused");
          const now = Date.now();
          if (now - this.lastMouseMove >= this.timeoutDuration && this.currentVideo?.paused) {
            await this.setOverlay(true);
          }
        }, 10000);
      }

      const handlePause = async () => {
        if (video !== this.currentVideo || video.ended) return;
        log("debug", "Video paused, creating listeners");
        document.addEventListener("mousemove", handleMove)
        document.addEventListener("touchmove", handleMove)
      };

      const handlePlay = () => {
        if (video !== this.currentVideo) return;
        this.overlay.hide();
        document.removeEventListener("mousemove", handleMove)
        document.removeEventListener("touchmove", handleMove)
      };

      video.addEventListener("pause", handlePause)
      video.addEventListener("play", handlePlay);

      return () => {
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("play", handlePlay);
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("touchmove", handleMove);
        this.overlay.destroy();
      };
    }


    /**
     * Attempts to extract the current item's ID from the DOM.
     */
    getItemId(force = true) {
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

    /** 
     * Fetch item info from Jellyfin API 
     * @param {string} id - The ID of the Jellyfin item.
     */
    async fetchItemInfo(id) {
      try {
        const item = await this.fetchWithRetry(`${window.location.origin}/Items/${id}`, {
          headers: { "X-Emby-Token": this.token }
        });
        return item;
      } catch (error) {
        log("error", "Error fetching item info:", error);
      }
    }

    /**
     * Fetch helper with retry logic.
     */
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

    clearState() {
      this.overlay.clear();

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
    }
  }

  // Initialize the pause screen
  new OverlayController();
})();
