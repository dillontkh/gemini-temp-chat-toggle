/**
 * Gemini Temporary Chat Toggle - Content Script
 */

(function () {
  // Prevent duplicate injection
  if (window.__geminiTempChatInjected) return;
  window.__geminiTempChatInjected = true;

  let currentSettings = {
    shortcut: "Alt+Shift+T",
    showToast: true
  };

  // Load user settings
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

  /**
   * Search for the Temporary Chat button in the Gemini DOM
   * In Gemini: located in top-bar-actions as <temp-chat-button>
   */
  function findTemporaryChatButton() {
    // 1. Target dedicated Gemini Angular component
    let el = document.querySelector('temp-chat-button button, [data-test-id="temp-chat-button-container"] button, .temp-chat-button button');
    if (el) return el;

    // 2. Target by aria-label
    el = document.querySelector('button[aria-label*="Temporary chat" i]');
    if (el) return el;

    // 3. Target by data-tooltip
    el = document.querySelector('[data-tooltip*="Temporary chat" i]');
    if (el) return el.closest('button, [role="button"]') || el;

    // 4. Partial attribute fallback
    el = document.querySelector('[aria-label*="Temporary chat" i]');
    if (el) return el.closest('button, [role="button"]') || el;

    // 5. Check text content
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      if (btn.children.length <= 3) {
        const text = (btn.innerText || btn.textContent || '').trim();
        if (/temporary\s*chat/i.test(text) && text.length < 50) {
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
  function isTemporaryChatActive() {
    // 1. Native Gemini class on button container
    if (document.querySelector('.temp-chat-on, temp-chat-button.temp-chat-on, gem-icon-button.temp-chat-on, [data-test-id="temp-chat-button-container"] .temp-chat-on')) {
      return true;
    }

    // 2. Icon inside temporary chat button changes to "close"
    if (document.querySelector('temp-chat-button [data-mat-icon-name="close"], .temp-chat-button [data-mat-icon-name="close"], temp-chat-button [fonticon="close"], .temp-chat-button [fonticon="close"]')) {
      return true;
    }

    // 3. Class on chat-window or body
    if (document.querySelector('chat-window.is-temporary-chat, .is-temporary-chat')) {
      return true;
    }

    // 4. Temporary chat card in DOM
    if (document.querySelector('.temporary-chat-card, .temporary-chat-card-container, .temporary-chat-header')) {
      return true;
    }

    // 5. Specific text in the main card
    const mainArea = document.querySelector('main, [role="main"], chat-app') || document.body;
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
   * Toggle Temporary Chat state.
   * Clicking Gemini's Temporary Chat button natively toggles between Standard and Temporary chat.
   */
  async function toggleTemporaryChat() {
    let tempBtn = findTemporaryChatButton();

    if (!tempBtn) {
      // Check if sidebar / top bar is collapsed or menu needs opening
      const menuBtn = document.querySelector(
        'button[aria-label*="Main menu" i], button[aria-label*="Expand side panel" i], button[aria-label*="Open side panel" i]'
      );
      if (menuBtn) {
        menuBtn.click();
        setTimeout(() => {
          tempBtn = findTemporaryChatButton();
          if (tempBtn) {
            executeToggle(tempBtn);
          } else {
            showToast("Temporary chat button not found", "error");
          }
        }, 200);
      } else {
        showToast("Temporary chat button not found", "error");
      }
      return;
    }

    executeToggle(tempBtn);
  }

  function executeToggle(tempBtn) {
    const wasActive = isTemporaryChatActive();

    // Click the native button to toggle mode
    tempBtn.click();

    // Display the resulting state
    if (wasActive) {
      showToast("Temporary Chat: OFF", "off");
    } else {
      showToast("Temporary Chat: ON", "on");
    }
  }

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
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggle-temporary-chat") {
      toggleTemporaryChat();
      sendResponse({ status: "executed" });
    }
  });

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
  window.addEventListener("keydown", (event) => {
    if (!currentSettings.shortcut) return;

    if (matchesShortcut(event, currentSettings.shortcut)) {
      event.preventDefault();
      event.stopPropagation();
      toggleTemporaryChat();
    }
  }, true);

})();
