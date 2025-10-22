/**
 * Title: Jellyfin Login Profile Enhancer
 * Version: v2.0
 * Original Source: https://github.com/n00bcodr/Jellyfish/blob/main/scripts/loginimage.js
 * Author: Original: n00bcodr / Optimized: Core
 * Description: Displays the selected user's profile image on the manual login form and hides the redundant username input field.
 */

(function () {
  'use strict';

  // --- Configuration ---
  const debug = false; // Set to 'true' to enable all console logs
  const LOG_PREFIX = '[LoginImage]';

  const log = (message) => {
    if (debug) {
      console.log(`${LOG_PREFIX} ${message}`);
    }
  };
  // ---------------------
  log('Script loaded. Starting initialization.');

  const getServerAddress = () => window.location.origin;

  const getCleanImageUrl = (url) => {
    try {
      const serverUrl = new URL(url);
      serverUrl.searchParams.set('quality', '40');
      serverUrl.searchParams.delete('width');
      serverUrl.searchParams.delete('height');
      serverUrl.searchParams.delete('tag');
      return serverUrl.href;
    } catch (e) {
      return url;
    }
  };

  /**
   * Resets the UI styles and removes the dynamically injected image container.
   */
  const resetUI = (userNameInput, userLabel) => {
    const imgContainer = document.getElementById('userProfileImageContainer');
    if (imgContainer) imgContainer.remove();

    // Use removeProperty to reset style gracefully
    [userNameInput, userLabel].forEach(el => {
      if (el) el.style.removeProperty('display');
    });
    log('UI state reset.');
  };

  /**
   * Finds the user's profile image and displays it above the password field.
   */
  const updateProfilePicture = () => {
    log('UpdateProfilePicture called.');

    const userNameInput = document.getElementById('txtManualName');
    const manualLoginForm = document.querySelector('.manualLoginForm');
    const userLabel = manualLoginForm?.querySelector('label[for="txtManualName"]');

    if (!userNameInput || !manualLoginForm || manualLoginForm.classList.contains('hide')) {
      log('Form not ready or hidden, skipping update.');
      resetUI(userNameInput, userLabel);
      return;
    }

    const currentUsername = userNameInput.value;
    const userCardsContainer = document.getElementById('divUsers');
    let imageUrl = null;

    log(`Current username: '${currentUsername}'`);

    // 1. Extract image URL from the selected user card
    if (userCardsContainer && currentUsername) {
      const userCardContent = userCardsContainer.querySelector(`.cardContent[data-username="${currentUsername}"]`);
      if (userCardContent) {
        const userId = userCardContent.dataset.userid;
        log(`Found user ID from card: ${userId}`);
        const cardImageContainer = userCardContent.querySelector('.cardImageContainer');

        if (cardImageContainer?.style.backgroundImage) {
          const style = cardImageContainer.style.backgroundImage;
          const urlMatch = style.match(/url\(['"]?(.*?)['"]?\)/);
          if (urlMatch?.[1]) {
            imageUrl = getCleanImageUrl(urlMatch[1]);
            log(`Found and cleaned image URL from card style: ${imageUrl}`);
          }
        }

        // Fallback: Manually construct the URL if needed
        if (!imageUrl && userId) {
          imageUrl = `${getServerAddress()}/Users/${userId}/Images/Primary?quality=40`;
          log(`Constructed image URL as fallback: ${imageUrl}`);
        }
      } else {
        log(`No user card found for username: '${currentUsername}'`);
      }
    }

    // 2. Find or create the image container
    let imageContainer = document.getElementById('userProfileImageContainer');
    if (!imageContainer) {
      imageContainer = document.createElement('div');
      imageContainer.id = 'userProfileImageContainer';
      const inputContainer = manualLoginForm.querySelector('.inputContainer');

      if (inputContainer) {
        manualLoginForm.insertBefore(imageContainer, inputContainer);
      } else {
        manualLoginForm.prepend(imageContainer);
      }
    }

    imageContainer.style.textAlign = 'center';
    imageContainer.innerHTML = '';

    // 3. Display or Reset
    if (imageUrl) {
      log(`Displaying image: ${imageUrl}`);
      const imgElement = document.createElement('img');
      imgElement.src = imageUrl;
      imgElement.alt = `Profile picture for ${currentUsername}`;

      imgElement.style.cssText = 'width: 125px; height: 125px; border-radius: 50%; object-fit: cover;';

      imageContainer.appendChild(imgElement);

      // Hide the username input field and label
      if (userNameInput) userNameInput.style.display = 'none';
      if (userLabel) userLabel.style.display = 'none';
    } else {
      log('No image URL found. Ensuring username input is visible.');
      resetUI(userNameInput, userLabel);
    }
  };


  const runScriptCore = (userNameInput, manualLoginForm) => {
    log('Attaching new MutationObservers to login elements.');

    const userLabel = manualLoginForm?.querySelector('label[for="txtManualName"]');

    new MutationObserver(updateProfilePicture)
      .observe(userNameInput, { attributes: true, attributeFilter: ['value'] });

    new MutationObserver(() => {
      log('Login form class attribute changed.');
      if (manualLoginForm.classList.contains('hide')) {
        resetUI(userNameInput, userLabel);
      } else {
        updateProfilePicture();
      }
    }).observe(manualLoginForm, { attributes: true, attributeFilter: ['class'] });

    if (!manualLoginForm.classList.contains('hide')) {
      updateProfilePicture();
    } else {
      resetUI(userNameInput, userLabel);
    }
  };

  const initializedElements = new WeakSet();

  const masterObserver = new MutationObserver((_mutations, _observer) => {
    const loginContainer = document.getElementById('loginPage');

    if (loginContainer && !initializedElements.has(loginContainer)) {
      const userNameInput = document.getElementById('txtManualName');
      const manualLoginForm = document.querySelector('.manualLoginForm');

      if (userNameInput && manualLoginForm) {
        initializedElements.add(loginContainer);
        log('Login elements found on dynamic load. Running core script.');

        setTimeout(() => runScriptCore(userNameInput, manualLoginForm), 500);
      }
    }
  });

  masterObserver.observe(document.body, { childList: true, subtree: true });

})();
