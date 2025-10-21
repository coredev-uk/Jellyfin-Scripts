/*
 * Title: Netflix-Style Pause Overlay
 * Version: v2.2
 * Original Source: https://github.com/BobHasNoSoul/Jellyfin-PauseScreen & https://github.com/n00bcodr/Jellyfish/blob/main/scripts/pausescreen.js 
 * Author: Original: BobHasNoSoul, n00bcodr / Refactored: Core 
 */

(function () {
  'use strict';

  // --- Logging Utility ---
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
      this.videoElement = null;
      this.init();
    }

    init() {
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
                    z-index: 9999;
                }

                #${Overlay.DOM_ID}.show {
                    opacity: 1;
                    visibility: visible;
                }
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
        this.videoElement = video;
        return;
      }
      const container = document.querySelector('.videoPlayerContainer');
      if (!container) {
        log("error", "Video container not found, cannot create overlay.");
        return;
      }

      this.dom = document.createElement("div");
      this.dom.id = Overlay.DOM_ID;

      this.content = document.createElement("div");
      this.content.classList.add(Overlay.CONTENT_CLASS);
      this.dom.appendChild(this.content);
      this.videoElement = video;

      container.appendChild(this.dom);

      const clickHandler = (event) => {
        if (event.target === this.dom || event.target === this.content) {
          this.hide();
          if (this.videoElement?.paused) {
            this.videoElement.play();
          }
        }
      }

      this.dom.addEventListener('click', clickHandler);
      this.dom.addEventListener('touchstart', clickHandler);
    }

    apply(item) {
      if (!item?.Type) {
        log("warn", "No valid item data provided, blocking overlay.");
        return;
      }

      if (!this.content) {
        log("error", "Overlay content not initialized.");
        return;
      }

      log("debug", `Displaying info for item ${item.Name} (${item.Type})`);

      let htmlContent = '';
      let subtitle = `<span class="header-subtitle">You're watching</span>`;

      switch (item.Type) {
        case "Episode":
          htmlContent += subtitle;
          htmlContent += `<h2 class="header">${item.SeriesName || 'Unknown Series'}</h2>`;
          htmlContent += `<h4 class="season-title">${item.SeasonName || 'Unknown Season'}</h4>`;

          htmlContent += `<h3 class="episode-title">${item.Name || 'Unknown Episode'} (Ep. ${item.IndexNumber || '?'})</h3>`;
          htmlContent += `<p class="synopsis">${item.Overview || "No description available."}</p>`;
          break;

        case "Movie":
          htmlContent += subtitle;
          htmlContent += `<h2 class="header">${item.Name || 'Unknown Movie'}</h2>`;

          const ratingHtml = item.OfficialRating ? `<p class="mediaInfoOfficialRating" rating="${item.OfficialRating}">${item.OfficialRating}</p>` : '';
          const runTime = this.formatTime(item.RunTimeTicks);

          htmlContent += `<h3 class="episode-title" data-has-rating="${!!item.OfficialRating}">${item.ProductionYear || ""} ${ratingHtml} ${runTime}</h3>`;
          htmlContent += `<p class="synopsis">${item.Overview || "No description available."}</p>`;
          break;

        default:
          log("warn", `Unmapped item type: ${item.Type}.`);
          return;
      }

      this.content.innerHTML = htmlContent;
    }

    formatTime(runTimeTicks) {
      if (!runTimeTicks) return "";

      const totalMinutes = Math.round(runTimeTicks / 600000000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
  }

  // --- Controller Class: Handles State, Events, and API ---

  class OverlayController {
    static debug = false; // Central debug control: Set to false to disable all logs
    static RETRY_COUNT = 3;

    constructor() {
      this.currentItemId = null;
      this.credentials = null;
      this.cleanupListeners = null;
      this.observer = null;
      this.currentVideo = null;
      this.overlay = new Overlay();
      this.mouseMoveTimeout = null;
      this.lastMouseMove = 0;
      this.timeoutDuration = 10 * 1000; // 10 Seconds

      this.videoInitialized = false;
      this.initialPauseTimeout = null;
      this.initialDebounceTime = 1000;

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

    getCredentials() {
      try {
        const creds = localStorage.getItem("jellyfin_credentials");
        if (!creds) return null;

        const parsed = JSON.parse(creds);
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
      const video = document.querySelector(".videoPlayerContainer video");
      if (video && video !== this.currentVideo) {
        this.handleVideoChange(video);
      } else if (!video && this.currentVideo) {
        this.clearState();
      }
    }

    handleVideoChange(video) {
      this.clearState();
      this.currentVideo = video;
      this.videoInitialized = false;

      this.initialPauseTimeout = setTimeout(() => {
        this.videoInitialized = true;
        log("debug", "Video initialization debounce complete.");
      }, this.initialDebounceTime);

      this.overlay.create(video);
      this.cleanupListeners = this.setupOverlayListeners(video);
    }

    setupOverlayListeners(video) {
      const handleMove = () => {
        this.lastMouseMove = Date.now();
        this.overlay.hide();
        clearTimeout(this.mouseMoveTimeout);

        this.mouseMoveTimeout = setTimeout(async () => {
          log("debug", "Mouse inactive timeout reached.");
          const now = Date.now();
          if ((now - this.lastMouseMove) >= this.timeoutDuration && this.currentVideo?.paused) {
            await this.setOverlay();
          }
        }, this.timeoutDuration);
      }

      const handlePause = async () => {
        if (video !== this.currentVideo || video.ended) return;

        if (!this.videoInitialized) {
          log("debug", "Ignored pause event during video initialization debounce.");
          return;
        }

        log("debug", "Video paused event detected. Starting 10-second inactivity countdown.");

        this.lastMouseMove = Date.now();

        document.addEventListener("mousemove", handleMove);
        document.addEventListener("touchmove", handleMove);

        // Always start the countdown via handleMove() when paused.
        handleMove();
      };

      const handlePlay = () => {
        if (video !== this.currentVideo) return;
        log("debug", "Video playing event detected. Hiding overlay.");
        this.overlay.hide();

        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("touchmove", handleMove);
        clearTimeout(this.mouseMoveTimeout);
      };

      video.addEventListener("pause", handlePause);
      video.addEventListener("play", handlePlay);

      return () => {
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("play", handlePlay);
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("touchmove", handleMove);
        clearTimeout(this.mouseMoveTimeout);
        clearTimeout(this.initialPauseTimeout);
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

    getItemId(force = true) {
      if (!force && (Date.now() - this.lastItemIdCheck) < 500) {
        return this.currentItemId;
      }
      this.lastItemIdCheck = Date.now();

      const ratingButton = document.querySelector('.btnUserRating');
      const dataId = ratingButton?.getAttribute('data-id');

      if (dataId) {
        return dataId;
      }

      const videoOsd = document.querySelector('.videoOsdBottom-hidden');
      const osdItemId = videoOsd?.querySelector('[data-itemid]')?.getAttribute('data-itemid');

      if (osdItemId) {
        return osdItemId;
      }

      return null;
    }

    async fetchItemInfo(id) {
      try {
        const item = await this.fetchWithRetry(`${window.location.origin}/Items/${id}`, {
          headers: { "X-Emby-Token": this.credentials.token }
        }, OverlayController.RETRY_COUNT);
        return item;
      } catch (error) {
        log("error", "Error fetching item info:", error);
      }
    }

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
          await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
        }
      }
    }

    clearState() {
      log("debug", "Clearing controller state.");
      this.overlay.clear();

      if (this.cleanupListeners) {
        this.cleanupListeners();
        this.cleanupListeners = null;
      }

      this.currentItemId = null;
      this.currentVideo = null;
      clearTimeout(this.mouseMoveTimeout);
      clearTimeout(this.initialPauseTimeout);
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
