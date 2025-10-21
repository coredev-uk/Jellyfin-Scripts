/**
 * Title: Jellyfin Rating Attribute Setter
 * Version: v2.0
 * Original Source: https://github.com/n00bcodr/Jellyfish/blob/main/scripts/rating.js
 * Author: Original: n00bcodr / Improved: Core
 * Description: Dynamically applies the media rating (e.g., 'TV-MA', 'R') as a custom HTML attribute named 'rating' to media elements for easy CSS styling/theming. Ignores elements processed by the Media Bar Patcher.
 */

(function () {
  'use strict';

  // --- Configuration & Logging ---
  const debug = false; // Set to 'true' to enable all console logs
  const LOG_PREFIX = '[JellyfinRating]';

  const log = (message, isError = false) => {
    if (debug) {
      if (isError) {
        console.error(`${LOG_PREFIX} ERROR: ${message}`);
      } else {
        console.log(`${LOG_PREFIX} ${message}`);
      }
    }
  };
  // -------------------------------

  const CONFIG = {
    // --- CRITICAL CHANGE: ATTRIBUTE NAME IS NOW 'rating' ---
    attributeName: 'rating',
    // --------------------------------------------------------

    // This selector ensures the script ignores elements handled by the Media Bar Patcher.
    targetSelector: '.mediaInfoOfficialRating:not(.age-rating *)',
    fallbackInterval: 1500,
    debounceDelay: 150,
  };

  let observer = null;
  let fallbackTimer = null;
  let debounceTimer = null;
  let lastUrl = location.href;
  let processedElements = new WeakSet();

  log("Script loaded.");

  // --- Core Utility Functions ---

  function normalizeRating(rating) {
    if (!rating) return '';

    let normalized = rating.replace(/\s+/g, ' ').trim().toUpperCase();

    const ratingMappings = {
      'NOT RATED': 'NR',
      'NOT-RATED': 'NR',
      'UNRATED': 'NR',
      'NO RATING': 'NR',
      'APPROVED': 'APPROVED',
      'PASSED': 'PASSED'
    };

    return ratingMappings[normalized] || normalized.replace(/[^A-Z0-9-]/g, '');
  }

  function processRatingElements() {
    try {
      const elements = document.querySelectorAll(CONFIG.targetSelector);
      let processedCount = 0;

      elements.forEach((element) => {
        const ratingText = element.textContent?.trim();

        if (ratingText && ratingText.length > 0) {
          const normalizedRating = normalizeRating(ratingText);
          const currentAttribute = element.getAttribute(CONFIG.attributeName);

          if (currentAttribute === normalizedRating && processedElements.has(element)) {
            return;
          }

          // APPLYING THE REQUIRED 'rating' ATTRIBUTE
          element.setAttribute(CONFIG.attributeName, normalizedRating);
          processedElements.add(element);
          processedCount++;

          // Note: Aria-label and title remain standard for accessibility/tooltips
          if (!element.getAttribute('aria-label')) {
            element.setAttribute('aria-label', `Content rated ${normalizedRating}`);
          }
          if (!element.getAttribute('title')) {
            element.setAttribute('title', `Rating: ${normalizedRating}`);
          }
        }
      });

      if (processedCount > 0) {
        log(`Processed ${processedCount} new/updated rating elements.`);
      }

    } catch (error) {
      log(`Error processing elements: ${error}`, true);
    }
  }

  function debouncedProcess() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(processRatingElements, CONFIG.debounceDelay);
  }

  function setupMutationObserver() {
    if (!window.MutationObserver) {
      log("MutationObserver not supported, falling back to polling.", true);
      return false;
    }

    try {
      if (!observer) {
        observer = new MutationObserver((mutations) => {
          let shouldProcess = false;

          for (const mutation of mutations) {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
              if (mutation.target.nodeType === Node.ELEMENT_NODE) {
                if (mutation.target.matches(CONFIG.targetSelector) || mutation.target.closest(CONFIG.targetSelector)) {
                  shouldProcess = true;
                  break;
                }
              }
            }
          }

          if (shouldProcess) {
            debouncedProcess();
          }
        });
      }

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: false
      });

      log("MutationObserver initialized.");
      return true;

    } catch (error) {
      log(`Failed to setup MutationObserver: ${error}`, true);
      return false;
    }
  }

  function setupFallbackPolling() {
    fallbackTimer = setInterval(processRatingElements, CONFIG.fallbackInterval);
    log(`Fallback polling started (${CONFIG.fallbackInterval}ms interval).`);
  }

  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    processedElements = new WeakSet();
    log("Cleanup performed.");
  }

  // --- Initialization and Runtime Management ---

  function initialize() {
    cleanup();

    processRatingElements();

    if (!setupMutationObserver()) {
      setupFallbackPolling();
    } else {
      setupFallbackPolling();
    }

    log("Initialization complete.");
  }

  // Handle single-page application (SPA) navigation changes by watching URL
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(initialize, 500);
    }
  }).observe(document.head, { subtree: true, childList: true, characterData: true });


  // Handle page visibility changes 
  if (typeof document.visibilityState !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        setTimeout(processRatingElements, 100);
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);

  // Expose cleanup function globally for manual cleanup if needed
  window.jellyfinRatingCleanup = cleanup;

})();
