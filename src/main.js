/*
 * Jellyfin Pause Screen script by BobHasNoSoul modified by n00bcodr
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
      this.block = false;
    }

    show() {
      if (this.block || !this.dom) return;
      log("debug", "Showing overlay")
      this.dom.style.display = 'block';
    }

    hide() {
      if (!this.dom) return;
      log("debug", "Hiding overlay")
      this.dom.style.display = 'none';
    }

    clear() {
      if (!this.content) return;
      log("debug", "Clearing")
      this.hide();
      this.content.innerHTML = '';
    }

    create(video) {
      if (this.dom) return; // Already created
      const osd = document.querySelector('#videoOsdPage')
      if (!osd) return;

      const style = document.createElement("style");
      style.textContent = `
            #video-overlay {
                height: 100%;
                width: 100%;
                background: rgba(0, 0, 0, .5);
                position: absolute;
                display: none;
            }

            .overlay-content {
              display: flex;
              flex-direction: column;
              justify-content: center;
              color: white;
              height: 100%;
              width: 100%;
              padding: 12%;
            }

            .header-subtitle {
              font-size: 1.8rem;
              margin-left: 0.4rem;
              font-weight: 400;
              color: rgb(204, 204, 204);
            }

            .header {
              font-size: 5.4rem;
              color: white;
              font-weight: 500;
              margin-top: 0;
              margin-bottom: 0;
            }

            .season-title {
              font-size: 2.4rem;
              margin: 0.4rem 0 0;
              color: white;
              font-weight: 500;
            }

            .episode-title {
              font-size: 2.4rem;
              margin: 2.4rem 0 1.2rem;
              color: white;
              font-weight: 500;
            }

            .synopsis {
              font-size: 1.8rem;
              font-weight: 400;
              color: rgb(204, 204, 204);
              width: 60%;
              margin: 0;
            }
            `;

      document.head.appendChild(style);

      // Create overlay structure
      this.dom = document.createElement("div");
      this.dom.id = "video-overlay";

      this.content = document.createElement("div");
      this.content.classList.add("overlay-content")
      this.dom.appendChild(this.content);

      osd.appendChild(this.dom);

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
      this.block = false;

      if (!this.content) this.create();

      log("debug", "[PauseOverlay] Displaying info for item:", item);

      if (item.Type === "Episode") {
        // Header
        this.content.innerHTML += `<span class="header-subtitle">You're watching</span>`
        this.content.innerHTML += `<h2 class="header">${item.SeriesName}</h2>`
        this.content.innerHTML += `<h4 class="season-title">${item.SeasonName}</h4>`

        // Main content
        this.content.innerHTML += `<h3 class="episode-title">${item.Name} (Ep. ${item.IndexNumber})</h3>`;
        this.content.innerHTML += `<p class="synopsis">${item.Overview || "No description available."}</p>`;
      } else if (item.Type === "Movie") {
        this.content.innerHTML += `<span class="header-subtitle">You're watching</span>`
        this.content.innerHTML += `<h2 class="header">${item.Name}</h2>`

        // Main content
        this.content.innerHTML += `<h3 class="episode-title">${item.ProductionYear || ""} <span class="mediaInfoOfficialRating" rating="${item.OfficialRating}">${item.OfficialRating}</span> ${this.formatTime(item.RunTimeTicks) || ""}</h3>`;
        this.content.innerHTML += `<p class="synopsis">${item.Overview || "No description available."}</p>`;
      } else {
        this.block = true;
        console.warn("[PauseOverlay] Unsupported item type:", item.Type);
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

  class JellyfinPauseOverlay {
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
        this.overlay.create(video);
        this.handleVideoChange(video);
      } else if (!video && this.currentVideo) {
        this.clearState();
        this.overlay.dom?.remove();
      }
    }

    async handleVideoChange(video) {
      this.clearState();
      this.currentVideo = video;
      this.cleanupListeners = this.attachVideoListeners(video);
      const itemId = this.getItemId();
      log("debug", "Detected video change, item ID:", itemId);
      if (itemId) {
        this.overlay.block = false;
        this.currentItemId = itemId;
        const item = this.fetchItemInfo(itemId);
        this.overlay.apply(item);
      } else {
        this.overlay.block = true;
        log("warn", "Item ID not found, overlay disabled for this video.");
      }
    }

    attachVideoListeners(video) {
      const handleMove = () => {
        // this.lastMouseMove = Date.now();
        // this.overlay.hide();
        // clearTimeout(this.mouseMoveTimeout);
        // this.mouseMoveTimeout = setTimeout(() => {
        //   const now = Date.now();
        //   if (now - this.lastMouseMove >= 10000 && this.currentVideo?.paused) {
        //     this.overlay.show()
        //   }
        // }, 10000);
      }

      const handlePause = async () => {
        if (video === this.currentVideo && !video.ended) {
          const newItemId = this.getItemId();
          if (newItemId && newItemId !== this.currentItemId) {
            this.currentItemId = newItemId;
            const item = await this.fetchItemInfo(newItemId)
            this.overlay.apply(item);
          } else {
            this.overlay.show();
          }
        }

        video.addEventListener("mousemove", handleMove)
        video.addEventListener("touchmove", handleMove)
      };

      const handlePlay = () => {
        if (video === this.currentVideo) {
          this.overlay.hide();
        }

        video.removeEventListener("mousemove", handleMove)
        video.removeEventListener("touchmove", handleMove)
      };

      video.addEventListener("pause", handlePause)
      video.addEventListener("play", handlePlay);

      return () => {
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("play", handlePlay);
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
     * @param {string} itemId - The ID of the Jellyfin item.
     */
    async fetchItemInfo(itemId) {
      try {
        const item = await this.fetchWithRetry(`${window.location.origin}/Items/${itemId}`, {
          headers: { "X-Emby-Token": this.token }
        });
        return item;
      } catch (error) {
        this.overlay.block = true;
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

      if (this.overlay.dom?.parentNode) {
        this.overlay.dom.parentNode.removeChild(this.overlay.dom);
      }
    }
  }

  // Initialize the pause screen
  new JellyfinPauseOverlay();
})();
