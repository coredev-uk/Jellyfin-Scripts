/*
 * Jellyfin Pause Screen script by BobHasNoSoul modified by n00bcodr
 * Modified (again) to match Netflix style by Core
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

/**
 * Jellyfin Item
 * @typedef {Object} Item
 * @property {string} Name - The name of the item.
 * @property {string} ServerId - The server ID associated with the item.
 * @property {string} Id - The unique identifier for the item.
 * @property {string} Etag - The ETag for the item.
 * @property {string} DateCreated - The creation date of the item.
 * @property {boolean} CanDelete - Indicates if the item can be deleted.
 * @property {boolean} CanDownload - Indicates if the item can be downloaded.
 * @property {boolean} HasSubtitles - Indicates if the item has subtitles.
 * @property {string} Container - The container format of the item.
 * @property {string} SortName - The sort name of the item.
 * @property {Array} BackdropImageTags - Array of backdrop image tags.
 * @property {Array} Chapters - Array of chapters in the item.
 * @property {string} DisplayPreferencesId - The display preferences ID.
 * @property {boolean} EnableMediaSourceDisplay - Indicates if media source display is enabled.
 * @property {Array} ExternalUrls - Array of external URLs related to the item.
 * @property {Array} GenreItems - Array of genre items.
 * @property {Array<string>} Genres - Array of genre names.
 * @property {number} Height - The height of the video.
 * @property {Object} ImageBlurHashes - Object containing blur hashes for images.
 * @property {Object} ImageTags - Object containing image tags.
 * @property {number} IndexNumber - The index number of the item.
 * @property {boolean} IsFolder - Indicates if the item is a folder.
 * @property {boolean} IsHD - Indicates if the item is in HD.
 * @property {string} LocationType - The location type of the item.
 * @property {boolean} LockData - Indicates if the item data is locked.
 * @property {Array} LockedFields - Array of locked fields.
 * @property {Array} MediaSources - Array of media sources.
 * @property {Array} MediaStreams - Array of media streams.
 * @property {string} MediaType - The media type of the item.
 * @property {string} Overview - The overview or description of the item.
 * @property {Array<string>} ParentBackdropImageTags - Array of parent backdrop image tags.
 * @property {string} ParentBackdropItemId - The parent backdrop item ID.
 * @property {string} ParentId - The parent ID of the item.
 * @property {number} ParentIndexNumber - The parent index number.
 * @property {string} ParentLogoImageTag - The parent logo image tag.
 * @property {string} ParentLogoItemId - The parent logo item ID.
 * @property {string} ParentThumbImageTag - The parent thumbnail image tag.
 * @property {string} ParentThumbItemId - The parent thumbnail item ID.
 * @property {string} Path - The file path of the item.
 * @property {Array} People - Array of people associated with the item.
 * @property {string} PlayAccess - The play access level of the item.
 * @property {string} PremiereDate - The premiere date of the item.
 * @property {number} PrimaryImageAspectRatio - The aspect ratio of the primary image.
 * @property {number} ProductionYear - The production year of the item.
 * @property {Object} ProviderIds - Object containing provider IDs.
 * @property {Array} RemoteTrailers - Array of remote trailers.
 * @property {number} RunTimeTicks - The runtime of the item in ticks.
 * @property {string} SeasonId - The season ID of the item.
 * @property {string} SeasonName - The season name of the item.
 * @property {string} SeriesId - The series ID of the item.
 * @property {string} SeriesName - The series name of the item.
 * @property {string} SeriesPrimaryImageTag - The series primary image tag.
 * @property {string} SeriesStudio - The studio of the series.
 * @property {string} SortName - The sort name of the item.
 * @property {number} SpecialFeatureCount - The count of special features.
 * @property {Array} Studios - Array of studios associated with the item.
 * @property {Array} Taglines - Array of taglines.
 * @property {Array} Tags - Array of tags.
 * @property {Object} Trickplay - Object containing trickplay data.
 * @property {string} Type - The type of the item.
 * @property {Object} UserData - Object containing user data.
 * @property {string} VideoType - The video type of the item.
 * @property {number} Width - The width of the video.
 */

(function () {
  'use strict';

  class JellyfinPauseScreen {
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
      this.invalidOverlay = false;

      // DOM elements
      this.overlay = null;
      this.overlayContent = null;
      this.currentVideo = null;

      this.init();
    }

    log(type, msg) {
      console[type](`[PauseOverlay] ${msg}`);
    }

    init() {
      const credentials = this.getCredentials();
      if (!credentials) {
        log("error", "Jellyfin credentials not found");
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
      const style = document.createElement("style");
      style.textContent = `
            #video-overlay {
                height: 100%;
                width: 100%;
                background: rgba(0, 0, 0, .5);
                position: relative;
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
      this.overlay = document.createElement("div");
      this.overlay.id = "video-overlay";

      this.overlayContent = document.createElement("div");
      this.overlayContent.classList.add("overlay-content")

      // Assemble overlay
      this.overlay.appendChild(this.overlayContent);
      document.body.appendChild(this.overlay);

      const clickHandler = (event) => {
        if (event.target === this.overlay || event.target === this.overlayHeader) {
          this.hideOverlay();
          if (this.currentVideo?.paused) {
            this.currentVideo.play();
          }
        }
      }

      // Add click handler to unpause when clicking on overlay
      this.overlay.addEventListener('click', clickHandler);
      this.overlay.addEventListener('touchstart', clickHandler);
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
      } else {
        this.invalidOverlay = true;
      }
    }

    /**
     * Checks and extracts the item ID from the video's poster URL.
     */
    checkForItemId(force = false) {
      const now = Date.now();
      if (!force && now - this.lastItemIdCheck < 500) {
        return this.currentItemId;
      }
      this.lastItemIdCheck = now;
      const id = new URL(this.video.poster).pathname.split('Items/')[1].split('/')[0]
      return id || null;
    }

    attachVideoListeners(video) {
      // On pause, show the overlay after 10 seconds of no movement
      const handleMove = (e) => {
        this.lastMouseMove = Date.now();

      }

      const handlePause = () => {
        if (video === this.currentVideo && !video.ended) {
          const newItemId = this.checkForItemId(true);
          if (newItemId && newItemId !== this.currentItemId) {
            this.currentItemId = newItemId;
            this.fetchItemInfo(newItemId);
          }
          this.showOverlay();
        }

        video.addEventListener("mousemove", handleMove)
        video.addEventListener("touchmove", handleMove)

      };

      const handlePlay = () => {
        if (video === this.currentVideo) {
          this.hideOverlay();
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

    showOverlay() {
      if (this.invalidOverlay) return;
      this.overlay.style.display = "flex";
    }

    hideOverlay() {
      this.overlay.style.display = "none";
    }

    clearDisplayData() {
      this.overlayContent.textContent = "";
    }

    async fetchItemInfo(itemId) {
      this.clearDisplayData();

      try {
        const domain = window.location.origin;
        const item = await this.fetchWithRetry(`${domain}/Items/${itemId}`, {
          headers: { "X-Emby-Token": this.token }
        });
        this.displayItemInfo(item);
      } catch (error) {
        log("error", `Error fetching item info: ${error}`);
        this.invalidOverlay = true;
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

    /**
     * A function to apply the item info to the overlay.
     * @param {Item} item - The Jellyfin item object.
     */
    displayItemInfo(item) {
      this.clearDisplayData();

      if (item.Type === "Episode") {
        // Header
        this.overlayContent.innerHTML += `<span class="header-subtitle">You're watching</span>`
        this.overlayContent.innerHTML += `<h2 class="header">${item.SeriesName}</h2>`
        this.overlayContent.innerHTML += `<h4 class="season-title">${item.SeasonName}</h4>`

        // Main content
        this.overlayContent.innerHTML += `<h3 class="episode-title">${item.Name} (Ep. ${item.IndexNumber})</h3>`;
        this.overlayContent.innerHTML += `<p class="synopsis">${item.Overview || "No description available."}</p>`;
      } else if (item.Type === "Movie") {
        this.overlayContent.innerHTML += `<span class="header-subtitle">You're watching</span>`
        this.overlayContent.innerHTML += `<h2 class="header">${item.Name}</h2>`

        // Main content
        this.overlayContent.innerHTML += `<h3 class="episode-title">${item.ProductionYear || ""} <span class="mediaInfoOfficialRating" rating="${item.OfficialRating}">${item.OfficialRating}</span> ${this.formatRuntime(item.RunTimeTicks) || ""}</h3>`;
        this.overlayContent.innerHTML += `<p class="synopsis">${item.Overview || "No description available."}</p>`;
      } else {
        // TODO: Don't show the overlay for unsupported types
      }
    }

    formatRuntime(runTimeTicks) {
      if (!runTimeTicks) return "";

      const totalMinutes = Math.floor(runTimeTicks / 600000000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    clearState() {
      this.hideOverlay();
      this.clearDisplayData();
      this.invalidOverlay = false;

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

      if (this.overlay?.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    }
  }

  // Initialize the pause screen
  new JellyfinPauseScreen();
})();
