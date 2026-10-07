/**
 * Gemini Temporary Chat Toggle - Content Script
 */

(function () {
  const _window = typeof window !== "undefined" ? window : globalThis;
  // Prevent duplicate injection
  if (_window.__geminiTempChatInjected) return;
  _window.__geminiTempChatInjected = true;

  let currentSettings = {
    shortcut: "Alt+Shift+T",
    showToast: true
  };

  // Load user settings
  if (typeof browser !== "undefined" && browser.storage && browser.storage.sync) {
    browser.storage.sync.get({
      shortcut: "Alt+Shift+T",
      showToast: true
    }).then((res) => {
      currentSettings = { ...currentSettings, ...res };
    }).catch(() => {});

    // Listen for storage changes to stay in sync
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" || area === "local") {
        if (changes.shortcut) currentSettings.shortcut = changes.shortcut.newValue;
        if (changes.showToast !== undefined) currentSettings.showToast = changes.showToast.newValue;
      }
    });
  }

  /**
   * Search for the Temporary Chat button in the Gemini DOM
   * In Gemini: located in top-bar-actions as <temp-chat-button>
   */
  function findTemporaryChatButton(root = typeof document !== "undefined" ? document : null) {
    if (!root) return null;
    // 1. Target dedicated Gemini Angular component
    let el = root.querySelector('temp-chat-button button, [data-test-id="temp-chat-button-container"] button, .temp-chat-button button');
    if (el) return el;

    // 2. Direct button in top-bar-actions or header
    el = root.querySelector('top-bar-actions button[aria-label*="Temporary chat" i], header button[aria-label*="Temporary chat" i]');
    if (el) return el;

    // 3. Target by aria-label, strictly excluding sidebar navigation items
    const buttons = root.querySelectorAll('button[aria-label*="Temporary chat" i], [role="button"][aria-label*="Temporary chat" i]');
    for (const btn of buttons) {
      if (btn.closest('side-navigation-v2, bard-sidenav-container, nav, mat-nav-list, .gds-sidenav-list')) {
        continue;
      }
      return btn;
    }

    // 4. Target by data-tooltip outside sidebar
    const tooltips = root.querySelectorAll('[data-tooltip*="Temporary chat" i]');
    for (const tip of tooltips) {
      if (tip.closest('side-navigation-v2, bard-sidenav-container, nav, mat-nav-list, .gds-sidenav-list')) {
        continue;
      }
      return tip.closest('button, [role="button"]') || tip;
    }

    // 5. Partial attribute fallback outside sidebar
    const partials = root.querySelectorAll('[aria-label*="Temporary chat" i]');
    for (const p of partials) {
      if (p.closest('side-navigation-v2, bard-sidenav-container, nav, mat-nav-list, .gds-sidenav-list')) {
        continue;
      }
      const b = p.closest('button, [role="button"]');
      if (b && !b.closest('side-navigation-v2, bard-sidenav-container, nav, mat-nav-list, .gds-sidenav-list')) {
        return b;
      }
    }

    // 6. Check text content outside sidebar
    const allButtons = root.querySelectorAll('button, [role="button"]');
    for (const btn of allButtons) {
      if (btn.closest('side-navigation-v2, bard-sidenav-container, nav, mat-nav-list, .gds-sidenav-list')) {
        continue;
      }
      if (btn.children.length <= 3) {
        const text = (btn.innerText || btn.textContent || '').trim();
        if (/temporary\s*chat\b/i.test(text) && text.length < 50) {
          return btn;
        }
      }
    }

    return null;
  }

  /**
   * Check if Gemini is currently in Temporary Chat mode.
   * Matches verified Gemini DOM markers:
   * - <gem-icon-button class="temp-chat-on">
   * - <chat-window class="is-temporary-chat">
   * - <mat-icon data-mat-icon-name="close"> inside temp-chat-button
   * - <h1 class="temporary-chat-card-container"> / <div class="temporary-chat-card">
   * - Card text: "Temporary chats don't appear in recent chats and aren't used to improve Google AI"
   */
  function isTemporaryChatActive(root = typeof document !== "undefined" ? document : null) {
    if (!root) return false;
    // 1. Native Gemini class on button container
    if (root.querySelector('.temp-chat-on, temp-chat-button.temp-chat-on, gem-icon-button.temp-chat-on, [data-test-id="temp-chat-button-container"] .temp-chat-on')) {
      return true;
    }

    // 2. Icon inside temporary chat button changes to "close"
    if (root.querySelector('temp-chat-button [data-mat-icon-name="close"], .temp-chat-button [data-mat-icon-name="close"], temp-chat-button [fonticon="close"], .temp-chat-button [fonticon="close"]')) {
      return true;
    }

    // 3. Class on chat-window or body
    if (root.querySelector('chat-window.is-temporary-chat, .is-temporary-chat')) {
      return true;
    }

    // 4. Temporary chat card in DOM
    if (root.querySelector('.temporary-chat-card, .temporary-chat-card-container, .temporary-chat-header')) {
      return true;
    }

    // 5. Specific text in the main card
    const mainArea = root.querySelector('main, [role="main"], chat-app') || root.body || root;
    const text = mainArea ? (mainArea.textContent || '') : '';
    if (/don't appear in recent chats/i.test(text) && /aren't used to improve google ai/i.test(text)) {
      return true;
    }
    if (/chats? (aren't|are not|won't be|not) saved/i.test(text)) {
      return true;
    }

    return false;
  }

  /**
   * Search for the "New chat" button or link in the Gemini DOM
   */
  function findNewChatButton(root = typeof document !== "undefined" ? document : null) {
    if (!root) return null;
    // 1. Dedicated Gemini Sparkle button in side nav
    let el = root.querySelector('a[data-test-id="side-nav-sparkle-button"], [data-test-id="side-nav-sparkle-button"]');
    if (el) return el;

    // 2. Target by aria-label
    el = root.querySelector('a[aria-label*="New chat" i], button[aria-label*="New chat" i]');
    if (el) return el;

    // 3. Target by data-tooltip
    el = root.querySelector('[data-tooltip*="New chat" i]');
    if (el) return el.closest('button, a, [role="button"]') || el;

    // 4. Navigation link targeting /app or /
    const links = root.querySelectorAll('a[href="/app"], a[href="/"]');
    for (const link of links) {
      const text = (link.innerText || link.textContent || '').trim();
      if (/new\s*chat/i.test(text)) return link;
      const aria = link.getAttribute('aria-label') || '';
      if (/new\s*chat/i.test(aria)) return link;
    }

    return null;
  }

  /**
   * Check if the current view is an empty new chat (zero-state, no existing message turns)
   */
  function isNewChat(root = typeof document !== "undefined" ? document : null) {
    if (!root) return true;
    // If existing message turns are present in DOM, this is not a new chat
    const hasMessages = !!root.querySelector(
      'message-content, .user-query-container, .model-response-text, user-query, model-response'
    );
    if (hasMessages) return false;

    // Check pathname: e.g. /app/34ab87cd... represents an existing saved conversation
    const win = root.defaultView || (typeof window !== "undefined" ? window : null);
    if (win && win.location && win.location.pathname) {
      const pathname = win.location.pathname;
      if (/^\/app\/[a-zA-Z0-9_-]{6,}/.test(pathname)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if the user is already on the page for a new temporary chat
   */
  function isNewTemporaryChat(root = typeof document !== "undefined" ? document : null) {
    return isTemporaryChatActive(root) && isNewChat(root) && !!findTemporaryChatButton(root);
  }

  /**
   * Dispatch the Gemini native keyboard shortcut (Ctrl + Shift + O)
   */
  function sendNewChatShortcut() {
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent);
    const activeDoc = document;
    const target = activeDoc.activeElement || activeDoc.body || activeDoc;
    const targets = [target, activeDoc, window].filter(Boolean);

    const modifierSets = [
      { ctrlKey: true, shiftKey: true, metaKey: false }
    ];
    if (isMac) {
      modifierSets.push({ ctrlKey: false, shiftKey: true, metaKey: true });
      modifierSets.push({ ctrlKey: true, shiftKey: true, metaKey: true });
    }

    for (const mods of modifierSets) {
      for (const key of ["o", "O"]) {
        const eventInit = {
          key,
          code: "KeyO",
          keyCode: 79,
          which: 79,
          ...mods,
          bubbles: true,
          cancelable: true,
          composed: true
        };
        for (const t of targets) {
          try {
            t.dispatchEvent(new KeyboardEvent("keydown", eventInit));
            t.dispatchEvent(new KeyboardEvent("keyup", eventInit));
          } catch (e) {
            // Ignore dispatch errors
          }
        }
      }
    }
  }

  /**
   * Trigger Gemini's "New chat" action via native keyboard shortcut (Ctrl + Shift + O)
   */
  function triggerNewChat() {
    // Dispatch native keyboard shortcut (Ctrl + Shift + O) to start a new chat
    // without interacting with sidebar elements or expanding the side panel.
    sendNewChatShortcut();
  }

  /**
   * Wait for the Temporary Chat button to appear in the DOM
   * @param {number} timeoutMs
   * @param {boolean} requireNewChat If true, will not resolve until isNewChat() is true
   */
  function waitForTemporaryChatButton(timeoutMs = 5000, requireNewChat = false) {
    return new Promise((resolve) => {
      let observer = null;
      let timer = null;
      let interval = null;

      const cleanup = () => {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      };

      const check = () => {
        const inNewChat = isNewChat();
        const btn = findTemporaryChatButton();

        if ((!requireNewChat || inNewChat) && btn) {
          cleanup();
          resolve(btn);
        }
      };

      timer = setTimeout(() => {
        const inNewChat = isNewChat();
        const btn = findTemporaryChatButton();
        cleanup();
        resolve((!requireNewChat || inNewChat) ? btn : null);
      }, timeoutMs);

      if (typeof MutationObserver !== "undefined") {
        observer = new MutationObserver(() => {
          check();
        });
        const targetNode = document.body || document.documentElement;
        if (targetNode) {
          observer.observe(targetNode, {
            childList: true,
            subtree: true,
            attributes: true
          });
        }
      }

      interval = setInterval(check, 80);
      check();
    });
  }

  /**
   * Safely dispatch click and pointer events to an element
   */
  function clickElement(el) {
    if (!el) return;
    const doc = el.ownerDocument || document;
    const win = (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalThis);

    try {
      const PointerCtor = typeof win.PointerEvent !== "undefined" ? win.PointerEvent : (typeof win.MouseEvent !== "undefined" ? win.MouseEvent : null);
      const MouseCtor = typeof win.MouseEvent !== "undefined" ? win.MouseEvent : null;
      const opts = { bubbles: true, cancelable: true, composed: true, view: win };

      if (PointerCtor) {
        el.dispatchEvent(new PointerCtor("pointerdown", opts));
      }
      if (MouseCtor) {
        el.dispatchEvent(new MouseCtor("mousedown", opts));
      }
      if (PointerCtor) {
        el.dispatchEvent(new PointerCtor("pointerup", opts));
      }
      if (MouseCtor) {
        el.dispatchEvent(new MouseCtor("mouseup", opts));
      }
      el.click();
    } catch (e) {
      el.click();
    }
  }

  /**
   * Activate temporary chat with retry verification.
   * Gives Angular time to attach event handlers and render the temporary chat mode.
   */
  async function activateTemporaryChat(maxAttempts = 6, intervalMs = 200) {
    // Initial brief settling delay so Angular finishes hydrating the newly mounted button
    await new Promise((r) => setTimeout(r, 120));

    if (isTemporaryChatActive()) {
      return true;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const btn = findTemporaryChatButton();
      if (btn) {
        clickElement(btn);
        // Also click parent container in case Angular listener is bound higher
        const parentBtn = btn.closest('gem-icon-button, temp-chat-button');
        if (parentBtn && parentBtn !== btn) {
          clickElement(parentBtn);
        }
      }

      // Wait intervalMs to allow Angular change detection and DOM rendering
      await new Promise((r) => setTimeout(r, intervalMs));

      if (isTemporaryChatActive()) {
        return true;
      }
    }

    return isTemporaryChatActive();
  }

  /**
   * Deactivate temporary chat with retry verification.
   */
  async function deactivateTemporaryChat(maxAttempts = 4, intervalMs = 150) {
    if (!isTemporaryChatActive()) {
      return true;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const btn = findTemporaryChatButton();
      if (btn) {
        clickElement(btn);
        const parentBtn = btn.closest('gem-icon-button, temp-chat-button');
        if (parentBtn && parentBtn !== btn) {
          clickElement(parentBtn);
        }
      }
      await new Promise((r) => setTimeout(r, intervalMs));

      if (!isTemporaryChatActive()) {
        return true;
      }
    }
    return !isTemporaryChatActive();
  }

  let isTogglingInProgress = false;

  /**
   * Toggle Temporary Chat state:
   * - If already on a new temporary chat page: toggles temporary chat OFF.
   * - If on a new standard chat page: toggles temporary chat ON.
   * - If in an existing chat or elsewhere on Gemini: sends Ctrl+Shift+O,
   *   waits for the new chat page, and turns temporary chat ON.
   */
  async function toggleTemporaryChat() {
    if (isTogglingInProgress) {
      return;
    }
    isTogglingInProgress = true;

    try {
      let tempBtn = findTemporaryChatButton();
      const tempActive = isTemporaryChatActive();
      const inNewChat = isNewChat();

      // 1. If already on the page for a new temporary chat: toggle it OFF
      if (tempBtn && tempActive && inNewChat) {
        await deactivateTemporaryChat();
        showToast("Temporary Chat: OFF", "off");
        return;
      }

      // 2. If already on the page for a new standard chat: toggle it ON
      if (tempBtn && !tempActive && inNewChat) {
        await activateTemporaryChat();
        showToast("Temporary Chat: ON", "on");
        return;
      }

      // 3. User is in an existing chat or elsewhere on the Gemini site.
      // Store flag in sessionStorage in case the navigation causes a page reload
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("__gemini_temp_chat_pending", Date.now().toString());
        }
      } catch (e) {}

      triggerNewChat();

      // Wait for the new chat view to mount and the temporary chat button to appear
      tempBtn = await waitForTemporaryChatButton(5000, true);

      // Clear pending flag since we did not reload and are handling it here
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("__gemini_temp_chat_pending");
        }
      } catch (e) {}

      if (tempBtn) {
        await activateTemporaryChat();
        showToast("Temporary Chat: ON", "on");
      } else {
        showToast("Temporary chat button not found", "error");
      }
    } catch (err) {
      showToast("Temporary chat button not found", "error");
    } finally {
      isTogglingInProgress = false;
    }
  }

  // Handle post-reload pending temporary chat activation if a full navigation occurred
  try {
    if (typeof sessionStorage !== "undefined") {
      const pendingTs = sessionStorage.getItem("__gemini_temp_chat_pending");
      if (pendingTs) {
        sessionStorage.removeItem("__gemini_temp_chat_pending");
        const elapsed = Date.now() - parseInt(pendingTs, 10);
        if (!isNaN(elapsed) && elapsed < 15000) {
          waitForTemporaryChatButton(6000, false).then(async (btn) => {
            if (btn) {
              await activateTemporaryChat();
              showToast("Temporary Chat: ON", "on");
            }
          });
        }
      }
    }
  } catch (e) {}

  /**
   * Display floating toast notification
   */
  let activeToastTimeout = null;

  function showToast(message, type = "info") {
    if (!currentSettings.showToast) return;

    let toast = document.getElementById("gemini-temp-chat-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "gemini-temp-chat-toast";
      document.body.appendChild(toast);
    }

    if (activeToastTimeout) {
      clearTimeout(activeToastTimeout);
    }

    // Create SVG icon safely using createElementNS
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");

    if (type === "on") {
      const pathBubble = document.createElementNS("http://www.w3.org/2000/svg", "path");
      pathBubble.setAttribute("d", "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z");
      svg.appendChild(pathBubble);
      for (const cx of [9, 12, 15]) {
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "path");
        dot.setAttribute("d", `M${cx} 10h.01`);
        svg.appendChild(dot);
      }
    } else if (type === "off") {
      const pathBubble = document.createElementNS("http://www.w3.org/2000/svg", "path");
      pathBubble.setAttribute("d", "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z");
      const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l1.setAttribute("x1", "9"); l1.setAttribute("y1", "9"); l1.setAttribute("x2", "15"); l1.setAttribute("y2", "15");
      const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l2.setAttribute("x1", "15"); l2.setAttribute("y1", "9"); l2.setAttribute("x2", "9"); l2.setAttribute("y2", "15");
      svg.append(pathBubble, l1, l2);
    } else {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", "12"); circle.setAttribute("cy", "12"); circle.setAttribute("r", "10");
      const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l1.setAttribute("x1", "12"); l1.setAttribute("y1", "8"); l1.setAttribute("x2", "12"); l1.setAttribute("y2", "12");
      const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l2.setAttribute("x1", "12"); l2.setAttribute("y1", "16"); l2.setAttribute("x2", "12.01"); l2.setAttribute("y2", "16");
      svg.append(circle, l1, l2);
    }

    toast.className = `gemini-temp-chat-toast toast-${type} toast-visible`;
    toast.textContent = "";

    const iconSpan = document.createElement("span");
    iconSpan.className = "toast-icon";
    iconSpan.appendChild(svg);

    const textSpan = document.createElement("span");
    textSpan.className = "toast-text";
    textSpan.textContent = message;

    toast.append(iconSpan, textSpan);

    activeToastTimeout = setTimeout(() => {
      toast.classList.remove("toast-visible");
      toast.classList.add("toast-hidden");
    }, 1800);
  }

  // Handle messages from background script
  if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "toggle-temporary-chat") {
        toggleTemporaryChat();
        sendResponse({ status: "executed" });
      }
    });
  }

  /**
   * Helper to parse shortcut string (e.g. "Alt+Shift+T")
   */
  function matchesShortcut(event, shortcutStr) {
    if (!shortcutStr) return false;
    const parts = shortcutStr.toLowerCase().split("+").map(s => s.trim());
    
    const needsCtrl = parts.includes("ctrl") || parts.includes("control");
    const needsAlt = parts.includes("alt");
    const needsShift = parts.includes("shift");
    const needsMeta = parts.includes("command") || parts.includes("meta") || parts.includes("cmd");

    if (event.ctrlKey !== needsCtrl) return false;
    if (event.altKey !== needsAlt) return false;
    if (event.shiftKey !== needsShift) return false;
    if (event.metaKey !== needsMeta) return false;

    const keyToken = parts.find(p => !["ctrl", "control", "alt", "shift", "command", "meta", "cmd"].includes(p));
    if (!keyToken) return false;

    const pressedKey = event.key.toLowerCase();
    const pressedCode = event.code.toLowerCase();

    if (pressedKey === keyToken) return true;
    if (pressedCode === `key${keyToken}`) return true;
    if (pressedCode === `digit${keyToken}`) return true;
    if (pressedCode === keyToken) return true;

    return false;
  }

  // In-page fallback keyboard event listener
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("keydown", (event) => {
      if (!currentSettings.shortcut) return;

      if (matchesShortcut(event, currentSettings.shortcut)) {
        event.preventDefault();
        event.stopPropagation();
        toggleTemporaryChat();
      }
    }, true);
  }

  // Expose helper functions for dev / testing environments
  if (typeof window !== "undefined") {
    window.__geminiTempChatHelpers = {
      findTemporaryChatButton,
      findNewChatButton,
      isTemporaryChatActive,
      isNewChat,
      isNewTemporaryChat,
      sendNewChatShortcut,
      triggerNewChat,
      waitForTemporaryChatButton,
      toggleTemporaryChat,
      matchesShortcut
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      findTemporaryChatButton,
      findNewChatButton,
      isTemporaryChatActive,
      isNewChat,
      isNewTemporaryChat,
      sendNewChatShortcut,
      triggerNewChat,
      waitForTemporaryChatButton,
      toggleTemporaryChat,
      matchesShortcut
    };
  }

})();
