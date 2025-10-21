# 📜 Changelog for All Scripts

## ⭐️ Jellyfin Rating Attribute Setter

### Version 2.5 
* **Targeting Finalised:** Simplified `targetSelector` from complex exclusion (`:not(.age-rating *)`) back to the base `'.mediaInfoOfficialRating'`. This allows the script to successfully process elements created by the Media Bar Patcher.
* **Attribute Naming Finalised:** Changed the attribute name from `data-rating` to the required custom attribute **`rating`** for compatibility with existing custom CSS.
* **Descriptive Tagging:** Updated the script's title and comments to clearly reflect its status as a custom enhancement.

### Version 2.4
* **Functional Change:** Changed the attribute name from `data-rating` to the custom attribute **`rating`**.

### Version 2.3
* **Targeting Update:** Implemented a new, complex `targetSelector` using the exclusion rule `:not(.age-rating *)` to prevent duplicate attribute setting on elements handled by the Media Bar Patcher. (This rule was later reverted in v2.5).

### Version 2.2
* **Feature Integration:** Updated `targetSelector` to include the new rating element structure, `.age-rating span`, to ensure coverage across all media views.

### Version 2.1
* **CSS Injection Removed:** Removed the `injectCSS` function, `cssUrl`, and `cssId` configurations, as external CSS injection was deemed unreliable in favour of using Jellyfin's **built-in Custom CSS** capability.
* **Optimisation:** Implemented a new, centralised, and clean **debug-controlled logging system** governed by a single `const debug` flag.

---

## ⏯️ Netflix-Style Pause Overlay

### Version 2.2 (Stability Fix)
* **Critical Bug Fix (Flicker):** Resolved the issue where the overlay appeared instantly upon pausing. This was fixed by:
    * Implementing a **`videoInitialized` debounce flag** and a 1-second grace period (`initialDebounceTime`) to ignore spontaneous `pause` events on video load.
    * Forcing **`this.lastMouseMove = Date.now()`** at the start of `handlePause` to reset the inactivity timer, preventing the instant show bug caused by checking against a stale timestamp.

### Version 2.1 (Initial Refactor)
* **Structural Change:** Implemented a safer and more defensive logic structure to prevent accidental show/hide events.
* **Cleanup:** Ensured that all new timeouts (`initialPauseTimeout`, `mouseMoveTimeout`) are explicitly cleared within the `clearState` function to prevent memory leaks.

---

## ⚙️ Media Bar Patcher

### Version 1.7 
* **Rating Element Replacement:** Refactored `processRatingReplacement` to use the powerful `Element.replaceWith()`. This completely removes the problematic nested structure (`<div class="age-rating"><span>...</span></div>`) and replaces it with a simplified, single `<div>` (`<div class="mediaInfoItem mediaInfoOfficialRating">...</div>`). This fixed attribute duplication issues by providing a clean target for the main Rating Script.

### Version 1.6
* **Logic Refinement:** Modified logic to ensure all custom attributes (`rating`, `aria-label`, `title`) were applied **only** to the outer `div.age-rating`, avoiding duplication on the inner `span`.

### Version 1.5
* **Rating Integration:** Added new logic (`tagRatingForProcessing`) to target the new `.age-rating span` element and apply the `data-rating` attribute to the outer `div` element, preparing it for styling and the main rating script.

### Version 1.4
* **Logic Simplification:** Simplified the rating integration logic to only add the standard class **`.mediaInfoOfficialRating`** to the `.age-rating span`. This delegates all complex normalisation/attribute setting to the primary Rating Script.

### Version 1.3
* **Initial Feature Merge:** Script was updated to include two core functions:
    1.  Replaced the Unicode separator (▫️) with the Material Icon HTML (`<i class="material-icons..."></i>`).
    2.  Added initial logic to read the rating text from the `.age-rating span` element.
