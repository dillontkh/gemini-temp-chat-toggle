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
   */
  function findTemporaryChatButton() {
    // 1. Check aria-label
    let el = document.querySelector('[aria-label*="Temporary chat" i]');
    if (el) return el.closest('button, [role="button"]') || el;

    // 2. Check data-tooltip
    el = document.querySelector('[data-tooltip*="Temporary chat" i]');
    if (el) return el.closest('button, [role="button"]') || el;

    // 3. Search buttons by text content
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const text = (btn.innerText || btn.textContent || '').trim();
      if (/temporary\s*chat/i.test(text) && text.length < 50) {
        return btn;
      }
    }

    return null;
  }

  /**
   * Search for the New Chat button in the Gemini DOM
   */
  function findNewChatButton() {
    // 1. Check aria-label
    let el = document.querySelector('[aria-label*="New chat" i]');
    if (el) return el.closest('button, [role="button"]') || el;

    // 2. Check data-tooltip
    el = document.querySelector('[data-tooltip*="New chat" i]');
    if (el) return el.closest('button, [role="button"]') || el;

    // 3. Search buttons by text content
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const text = (btn.innerText || btn.textContent || '').trim();
      if (/^new\s*chat$/i.test(text)) {
        return btn;
      }
    }

    return null;
  }

  /**
   * Check if Gemini is currently in Temporary Chat mode
   */
  function isTemporaryChatActive() {
    // 1. Check input box placeholder (e.g. "Ask in a temporary chat")
    const inputs = document.querySelectorAll('textarea, [contenteditable="true"], rich-textarea, .ql-editor');
    for (const input of inputs) {
      const ph = input.getAttribute('placeholder') || 
                 input.getAttribute('data-placeholder') || 
                 input.getAttribute('aria-label') || '';
      if (/temporary\s*chat/i.test(ph)) {
        return true;
      }
    }

    // 2. Check Temporary Chat button toggle state
    const tempBtn = findTemporaryChatButton();
    if (tempBtn) {
      const pressed = tempBtn.getAttribute('aria-pressed');
      const checked = tempBtn.getAttribute('aria-checked');
      const selected = tempBtn.getAttribute('aria-selected');
      if (pressed === 'true' || checked === 'true' || selected === 'true') {
        return true;
      }
      if (tempBtn.classList.contains('active') || tempBtn.classList.contains('selected')) {
        return true;
      }
    }

    // 3. Check for in-page banners or tags
    const notices = document.querySelectorAll('header, [role="banner"], main');
    for (const container of notices) {
      const text = container.textContent || '';
      if (/chats aren't saved to your google account|temporary chat is on/i.test(text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Toggle Temporary Chat state
   */
  async function toggleTemporaryChat() {
    const isActive = isTemporaryChatActive();

    if (isActive) {
      // Currently ACTIVE -> Switch to OFF
      const tempBtn = findTemporaryChatButton();
      const newChatBtn = findNewChatButton();

      // If tempBtn is explicitly a toggle button (aria-pressed="true"), clicking it toggles it off
      if (tempBtn && tempBtn.getAttribute('aria-pressed') === 'true') {
        tempBtn.click();
        showToast("Temporary Chat: OFF", "off");
        return;
      }

      // Otherwise, starting a "New chat" exits temporary mode in Gemini
      if (newChatBtn) {
        newChatBtn.click();
        showToast("Temporary Chat: OFF", "off");
        return;
      }

      if (tempBtn) {
        tempBtn.click();
        showToast("Temporary Chat: OFF", "off");
        return;
      }

      showToast("Unable to exit temporary chat: button not found", "error");
    } else {
      // Currently INACTIVE -> Switch to ON
      let tempBtn = findTemporaryChatButton();

      if (tempBtn) {
        tempBtn.click();
        showToast("Temporary Chat: ON", "on");
        return;
      }

      // If button not found, the side panel might be collapsed.
      const menuBtn = document.querySelector(
        'button[aria-label*="Main menu" i], button[aria-label*="Expand side panel" i], button[aria-label*="Open side panel" i]'
      );

      if (menuBtn) {
        menuBtn.click();
        setTimeout(() => {
          tempBtn = findTemporaryChatButton();
          if (tempBtn) {
            tempBtn.click();
            showToast("Temporary Chat: ON", "on");
          } else {
            showToast("Temporary chat button not found", "error");
          }
        }, 250);
      } else {
        showToast("Temporary chat button not found", "error");
      }
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

    // Extract key token (the one that is not a modifier)
    const keyToken = parts.find(p => !["ctrl", "control", "alt", "shift", "command", "meta", "cmd"].includes(p));
    if (!keyToken) return false;

    // Compare with event.key and event.code
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
    // Only process if user configured shortcut
    if (!currentSettings.shortcut) return;

    if (matchesShortcut(event, currentSettings.shortcut)) {
      event.preventDefault();
      event.stopPropagation();
      toggleTemporaryChat();
    }
  }, true);

})();
