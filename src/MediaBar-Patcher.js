/**
 * Title: Media Bar Patcher
 * Version: v1.5.0
 * Author: Core
 * Description: Replaces the White Small Square (▫️) genre separator with a Material Icon AND completely replaces the '.age-rating' structure with a simplified, standard '.mediaInfoOfficialRating' DIV for clean CSS targeting by the main rating script.
 */

(function () {
  'use strict';

  /**
   * The core class responsible for patching the media bar elements.
   */
  class MediaBarPatcher {
    /**
     * @param {object} config - Configuration options.
     */
    constructor(config) {
      // --- Configuration ---
      this.DEBUG = config.debug || false;

      // Original Rating Config (Official Rating Replacement)
      this.RATING_REPLACEMENT_CLASSES = config.ratingReplacementClasses;
      this.RATING_DIV_SELECTOR = config.ratingDivSelector;

      // Separator config
      this.SEPARATOR_OLD_CHAR = config.separatorOldChar;
      this.SEPARATOR_NEW_HTML = config.separatorNew_HTML;
      this.SEPARATOR_TARGET_SELECTOR = config.separatorTargetSelector;

      // Hidden Ratings config
      this.RATING_CONTAINER_SELECTOR = config.ratingContainerSelector;
      this.HIDDEN_RATING_TEXTS = config.hiddenRatingTexts;

      // Styled Ratings Config
      this.RATING_TARGET_SELECTOR = config.ratingTargetSelector;

      this.PROCESSED_ATTR = 'data-bar-processed';

      this.observer = new MutationObserver(this._handleMutations.bind(this));
    }

    // ----------------------------------------------------------------------
    // --- PRIVATE UTILITIES & FONT OVERRIDE ---
    // ----------------------------------------------------------------------

    /**
     * Centralized logging function, active only when this.DEBUG is true.
     */
    _log(message, type = 'log', data) {
      if (this.DEBUG) {
        const prefix = `[MediaBarPatcher] ${message}`;
        console[type](prefix, data || '');
      }
    }

    /**
     * Creates and marks a new styled HTML element.
     */
    _createStyledRatingElement(htmlString) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlString;
      const newElement = tempDiv.firstElementChild;
      newElement.setAttribute(this.PROCESSED_ATTR, 'true');
      return newElement;
    }

    // ----------------------------------------------------------------------
    // --- PRIVATE CORE LOGIC METHODS ---
    // ----------------------------------------------------------------------

    /**
     * Replaces the old genre separator character with new HTML.
     */
    _processSeparators(element) {
      let count = 0;
      const targets = element.querySelectorAll(this.SEPARATOR_TARGET_SELECTOR);

      targets.forEach(genreSpan => {
        if (!genreSpan.getAttribute(this.PROCESSED_ATTR)) {
          const originalText = genreSpan.textContent;

          if (originalText.includes(this.SEPARATOR_OLD_CHAR)) {
            const newHtml = originalText.replace(new RegExp(this.SEPARATOR_OLD_CHAR, 'g'), this.SEPARATOR_NEW_HTML);

            genreSpan.innerHTML = newHtml;
            genreSpan.setAttribute(this.PROCESSED_ATTR, 'true');
            count++;
          }
        }
      });
    }

    /**
     * Replaces the complex '.age-rating' structure with a simple DIV. (Official rating)
     */
    _processRatingReplacement(element) {
      element.querySelectorAll(this.RATING_DIV_SELECTOR).forEach(originalRatingDiv => {
        if (originalRatingDiv.getAttribute(this.PROCESSED_ATTR) === 'true') {
          return;
        }
        const ratingSpan = originalRatingDiv.querySelector('span');
        if (ratingSpan) {
          const ratingText = ratingSpan.textContent?.trim();
          if (ratingText && ratingText.length > 0) {
            const newDiv = document.createElement('div');
            newDiv.className = this.RATING_REPLACEMENT_CLASSES;
            newDiv.textContent = ratingText;
            newDiv.setAttribute(this.PROCESSED_ATTR, 'true');
            originalRatingDiv.setAttribute(this.PROCESSED_ATTR, 'true');
            originalRatingDiv.replaceWith(newDiv);
          }
        }
      });
    }

    /**
     * Applies styling to remaining, non-N/A rating elements.
     */
    _processStyledRatings(element) {
      setTimeout(() => {
        element.querySelectorAll(this.RATING_TARGET_SELECTOR).forEach(container => {

          if (container.getAttribute('data-styled-processed') === 'true') {
            return;
          }

          let imdbWasReplaced = false;
          let tomatoElement = null;

          // --- 1. Process IMDb Rating ---
          const imdbLogoDiv = container.querySelector('.imdb-logo');

          if (imdbLogoDiv && imdbLogoDiv.style.display !== 'none') {

            const ratingSpan = imdbLogoDiv.nextElementSibling;
            const ratingText = ratingSpan?.textContent?.trim();

            if (ratingSpan && ratingText) {

              const newHtml = `<div class="starRatingContainer mediaInfoItem"><span class="material-icons starIcon star" style="font-family: 'Material Symbols Rounded' !important;" aria-hidden="true"></span>${ratingText}</div>`;
              const newElement = this._createStyledRatingElement(newHtml);

              imdbLogoDiv.replaceWith(newElement);

              const separatorIcon = ratingSpan.nextElementSibling;
              if (separatorIcon && separatorIcon.classList.contains('separator-icon')) {
                separatorIcon.remove();
              }
              ratingSpan.remove();

              imdbWasReplaced = true;
            } else if (imdbLogoDiv) {
              imdbLogoDiv.style.display = 'none';
              if (ratingSpan) ratingSpan.style.display = 'none';
            }
          }


          // --- 2. Process Rotten Tomatoes Rating ---
          const tomatoRatingDiv = container.querySelector('.tomato-rating');

          if (tomatoRatingDiv && tomatoRatingDiv.style.display !== 'none') {

            const ratingSpan = tomatoRatingDiv.querySelector('span:nth-child(2)');
            const ratingText = ratingSpan?.textContent?.trim().replace('%', '');

            if (ratingText) {

              const value = parseInt(ratingText);
              const criticClass = (value >= 60) ? 'mediaInfoCriticRatingFresh' : 'mediaInfoCriticRatingRotten';

              const newHtml = `<div class="mediaInfoItem mediaInfoCriticRating ${criticClass}" style="margin: none !important;">${ratingText}</div>`;
              const newElement = this._createStyledRatingElement(newHtml);

              tomatoRatingDiv.replaceWith(newElement);
              tomatoElement = newElement;
            } else if (tomatoRatingDiv) {
              tomatoRatingDiv.style.display = 'none';
            }
          }

          // --- 3. INJECT SEPARATORS ---

          // Separator between IMDb and Tomato ratings (if both exist)
          if (imdbWasReplaced && tomatoElement) {
            const imdbElement = container.querySelector('.starRatingContainer');
            if (imdbElement) {
              const separator = document.createElement('i');
              separator.className = 'material-icons fiber_manual_record separator-icon';
              imdbElement.after(separator);
            }
          }

          // Separator between Tomato Rating and Year
          if (tomatoElement) {
            const nextSibling = tomatoElement.nextElementSibling;
            if (nextSibling && nextSibling.classList.contains('date')) {
              const separator = document.createElement('i');
              separator.className = 'material-icons fiber_manual_record separator-icon';
              tomatoElement.after(separator);
            }
          }

          container.setAttribute('data-styled-processed', 'true');
        });
      }, 50); // Delay execution by 50ms
    }

    /**
     * Hides N/A elements and removes adjacent separators.
     */
    _processHiddenRatings(element) {
      element.querySelectorAll(this.RATING_CONTAINER_SELECTOR).forEach(container => {

        if (container.getAttribute('data-hidden-processed') === 'true') {
          return;
        }

        let changesMade = false;
        const separatorIconClass = 'separator-icon';

        // --- 1. Handle IMDb N/A consolidation ---
        const imdbLogoDiv = container.querySelector('.imdb-logo');

        if (imdbLogoDiv) {
          const ratingSpan = imdbLogoDiv.nextElementSibling;
          const ratingText = ratingSpan?.textContent?.trim();

          if (ratingSpan && this.HIDDEN_RATING_TEXTS.some(text => ratingText.includes(text))) {
            imdbLogoDiv.style.display = 'none';
            ratingSpan.style.display = 'none';
            changesMade = true;
          }
        }

        // --- 2. Handle Rotten Tomatoes N/A ---
        const tomatoRatingDiv = container.querySelector('.tomato-rating');
        if (tomatoRatingDiv) {
          const tomatoText = tomatoRatingDiv.textContent?.trim();

          if (this.HIDDEN_RATING_TEXTS.some(text => tomatoText.includes(text))) {
            tomatoRatingDiv.style.display = 'none';
            changesMade = true;
          }
        }

        // --- 3. Clean up separators around hidden elements ---
        const children = Array.from(container.children);
        children.forEach(child => {
          if (child.nodeType === 1 && child.style.display === 'none') {

            // Remove PRECEDING separator
            let prev = child.previousElementSibling;
            if (prev && prev.classList.contains(separatorIconClass) && prev.style.display !== 'none') {
              prev.style.display = 'none';
              changesMade = true;
            }

            // Remove SUCCEEDING separator
            let next = child.nextElementSibling;
            if (next && next.classList.contains(separatorIconClass) && next.style.display !== 'none') {
              next.style.display = 'none';
              changesMade = true;
            }
          }
        });

        if (changesMade) {
          container.setAttribute('data-hidden-processed', 'true');
        }
      });
    }


    // ----------------------------------------------------------------------
    // --- PUBLIC INTERFACE & UTILITIES ---
    // ----------------------------------------------------------------------

    /**
     * Main processing function for a given element.
     */
    processElements(element) {
      if (!element || element.nodeType !== 1) return;

      // Execute all patchers in order

      this._processHiddenRatings(element);
      this._processStyledRatings(element);
      this._processRatingReplacement(element);
      this._processSeparators(element);
    }

    _handleMutations(mutationsList) {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              this.processElements(node);
            }
          });
        }
      }
    }

    init(targetNode) {
      if (!targetNode) {
        return;
      }

      this.processElements(targetNode);

      this.observer.observe(targetNode, {
        childList: true,
        subtree: true
      });
    }
  }

  // ----------------------------------------------------------------------
  // --- EXECUTION / LIFECYCLE MANAGEMENT ---
  // ----------------------------------------------------------------------

  const config = {
    // --- GENERAL CONFIG ---
    debug: false,

    // --- RATING CONFIG (Official Rating Replacement) ---
    ratingReplacementClasses: 'mediaInfoItem mediaInfoText mediaInfoOfficialRating',
    ratingDivSelector: '.age-rating',

    // --- SEPARATOR CONFIG (Genre Separator Fix) ---
    separatorOldChar: '▫️',
    separatorNew_HTML: ' <i class="material-icons fiber_manual_record separator-icon"></i> ',
    separatorTargetSelector: '.slide .genre',

    // --- RATING HIDER CONFIG (Hides N/A values) ---
    ratingContainerSelector: '.slide .info-container .rating-value',
    hiddenRatingTexts: ['N/A', '0.0', '0%', '0'],

    // --- STYLED RATINGS CONFIG (Upgrades IMDb/Tomato) ---
    ratingTargetSelector: '.slide .info-container .rating-value',
  };

  const patcher = new MediaBarPatcher(config);
  const targetId = 'slides-container';

  const initializePatcher = () => {
    const slidesContainer = document.getElementById(targetId);

    if (slidesContainer) {
      patcher.init(slidesContainer);
    } else {
      const temporaryObserver = new MutationObserver((_mutations, obs) => {
        if (document.getElementById(targetId)) {
          obs.disconnect();
          patcher.init(document.getElementById(targetId));
        }
      });

      temporaryObserver.observe(document.body, { childList: true, subtree: true });
    }
  };


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePatcher);
  } else {
    initializePatcher();
  }

})();
