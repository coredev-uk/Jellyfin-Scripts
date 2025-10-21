/**
 * Title: Media Bar Patcher
 * Version: v1.0
 * Author: Core
 * Description: Replaces the White Small Square (▫️) genre separator with a Material Icon AND completely replaces the '.age-rating' structure with a simplified, standard '.mediaInfoOfficialRating' DIV for clean CSS targeting by the main rating script.
 */

(function () {
  'use strict';

  // --- Configuration ---
  // Classes needed for the replacement DIV
  const RATING_REPLACEMENT_CLASSES = 'mediaInfoItem mediaInfoText mediaInfoOfficialRating';

  // RATING CONFIG: Target the outer div to be replaced
  const RATING_DIV_SELECTOR = '.age-rating';

  // Separator Config
  const SEPARATOR_OLD_CHAR = '▫️';
  const SEPARATOR_NEW_HTML = ' <i class="material-icons fiber_manual_record separator-icon"></i> ';
  const SEPARATOR_TARGET_SELECTOR = '#slides-container .slide .genre';

  // --- Core Functions ---

  function processSeparators(element) {
    element.querySelectorAll(SEPARATOR_TARGET_SELECTOR).forEach(genreSpan => {
      if (!genreSpan.getAttribute('data-separator-fixed')) {
        const originalText = genreSpan.textContent;
        genreSpan.innerHTML = originalText.replace(new RegExp(SEPARATOR_OLD_CHAR, 'g'), SEPARATOR_NEW_HTML);
        genreSpan.setAttribute('data-separator-fixed', 'true');
      }
    });
  }

  /**
   * 2. Completely replaces the complex div.age-rating structure with a simple, flat div 
   * ready for the main rating script to apply attributes to.
   */
  function processRatingReplacement(element) {
    // Find the outer DIVs that need replacement
    element.querySelectorAll(RATING_DIV_SELECTOR).forEach(originalRatingDiv => {

      // Check if the element has already been replaced by this script
      if (originalRatingDiv.getAttribute('data-bar-processed') === 'true') {
        return;
      }

      const ratingSpan = originalRatingDiv.querySelector('span');

      if (ratingSpan) {
        const ratingText = ratingSpan.textContent?.trim();

        if (ratingText && ratingText.length > 0) {
          // 1. Create the new simplified DIV element
          const newDiv = document.createElement('div');
          newDiv.className = RATING_REPLACEMENT_CLASSES;
          newDiv.textContent = ratingText;

          // Mark the new element as processed to prevent endless loops
          newDiv.setAttribute('data-bar-processed', 'true');

          // 2. Replace the original complex structure with the new simple DIV
          originalRatingDiv.replaceWith(newDiv);
        }
      }
    });
  }

  /**
   * Main processing function that runs both enhancers.
   */
  function processElements(element) {
    processSeparators(element);
    processRatingReplacement(element);
  }

  // --- Mutation Observer Setup ---

  const observer = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element Node
            processElements(node);
          }
        });
      }
    }
  });

  // 1. Initial fix for content already loaded in the body
  processElements(document.body);

  // 2. Start observing the document body for newly loaded slides/content
  observer.observe(document.body, { childList: true, subtree: true });

})();
