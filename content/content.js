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

  // State tracker to ensure reliable toggling
  let isTemporaryMode = false;

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
    if (el) return el.closest('button, [role="button"], a') || el;

    // 2. Check data-tooltip
    el = document.querySelector('[data-tooltip*="Temporary chat" i]');
    if (el) return el.closest('button, [role="button"], a') || el;

    // 3. Search buttons by text content
    const buttons = document.querySelectorAll('button, [role="button"], a');
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
   * Search for the New Chat button in the Gemini DOM
   */
  function findNewChatButton() {
    // 1. Check aria-label
    let el = document.querySelector('[aria-label*="New chat" i]');
    if (el) return el.closest('button, [role="button"], a') || el;

    // 2. Check data-tooltip
    el = document.querySelector('[data-tooltip*="New chat" i]');
    if (el) return el.closest('button, [role="button"], a') || el;

    // 3. Search buttons by text content
    const buttons = document.querySelectorAll('button, [role="button"], a');
    for (const btn of buttons) {
      if (btn.children.length <= 3) {
        const text = (btn.innerText || btn.textContent || '').trim();
        if (/^new\s*chat$/i.test(text)) {
          return btn;
        }
      }
    }

    // 4. Link to /app (the new chat link on Gemini)
    el = document.querySelector('a[href="/app"], a[href="/"]');
    if (el) return el;

    return null;
  }

  /**
   * Check for Gemini's in-page Temporary Chat banner or heading
   */
  function hasTemporaryBanner() {
    // Check main area or whole page for temporary chat banner text
    const mainArea = document.querySelector('main, [role="main"], .conversation-container, #chat-history') || document.body;
    const fullText = mainArea ? (mainArea.textContent || '') : '';

    // Gemini banner phrasing matches:
    // - "Your chats aren't saved to your chat history or used to train Gemini apps."
    // - "Chats aren't saved..."
    // - "chats won't be saved..."
    if (/chats? (aren't|are not|won't be|not) saved/i.test(fullText)) return true;
    if (/saved to your chat history/i.test(fullText)) return true;
    if (/train gemini apps/i.test(fullText)) return true;

    // Check for "Temporary chat" title / header outside the navigation sidebar
    const headings = (mainArea || document.body).querySelectorAll('h1, h2, h3, h4, [role="heading"], div, span');
    for (const h of headings) {
      if (h.children.length <= 1 && h.textContent) {
        const t = h.textContent.trim();
        if (/^temporary\s*chat$/i.test(t)) {
          // Verify this element is NOT the sidebar button
          const isSidebarButton = h.closest('aside, nav, [role="navigation"], .sidebar');
          if (!isSidebarButton) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if Gemini is currently in Temporary Chat mode
   */
  function isTemporaryChatActive() {
    // 1. Explicit banner or heading in the main view
    if (hasTemporaryBanner()) {
      isTemporaryMode = true;
      return true;
    }

    // 2. Check input box placeholder
    const inputs = document.querySelectorAll('textarea, [contenteditable="true"], rich-textarea, .ql-editor');
    for (const input of inputs) {
      const ph = input.getAttribute('placeholder') || 
                 input.getAttribute('data-placeholder') || 
                 input.getAttribute('aria-label') || '';
      if (/temporary/i.test(ph)) {
        isTemporaryMode = true;
        return true;
      }
    }

    // 3. Check Temporary Chat button toggle attribute
    const tempBtn = findTemporaryChatButton();
    if (tempBtn) {
      const pressed = tempBtn.getAttribute('aria-pressed');
      const checked = tempBtn.getAttribute('aria-checked');
      const selected = tempBtn.getAttribute('aria-selected');
      if (pressed === 'true' || checked === 'true' || selected === 'true') {
        isTemporaryMode = true;
        return true;
      }
      if (tempBtn.classList.contains('active') || tempBtn.classList.contains('selected')) {
        isTemporaryMode = true;
        return true;
      }
    }

    // 4. Return tracked state
    return isTemporaryMode;
  }

  // Observe DOM changes to keep tracked state accurate when user clicks with mouse
  const observer = new MutationObserver(() => {
    if (hasTemporaryBanner()) {
      isTemporaryMode = true;
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  /**
   * Toggle Temporary Chat state
   */
  async function toggleTemporaryChat() {
    const isActive = isTemporaryChatActive();

    if (isActive) {
      // Currently ACTIVE -> Switch to OFF
      const newChatBtn = findNewChatButton();
      const tempBtn = findTemporaryChatButton();

      // Starting a "New chat" exits temporary mode in Gemini
      if (newChatBtn) {
        newChatBtn.click();
        isTemporaryMode = false;
        showToast("Temporary Chat: OFF", "off");
        return;
      }

      // If tempBtn is explicitly a toggle button, clicking it toggles it off
      if (tempBtn && (tempBtn.getAttribute('aria-pressed') === 'true' || tempBtn.classList.contains('active'))) {
        tempBtn.click();
        isTemporaryMode = false;
        showToast("Temporary Chat: OFF", "off");
        return;
      }

      // Fallback: click tempBtn if newChatBtn wasn't found
      if (tempBtn) {
        tempBtn.click();
        isTemporaryMode = false;
        showToast("Temporary Chat: OFF", "off");
        return;
      }

      showToast("Unable to exit temporary chat: button not found", "error");
    } else {
      // Currently INACTIVE -> Switch to ON
      let tempBtn = findTemporaryChatButton();

      if (tempBtn) {
        tempBtn.click();
        isTemporaryMode = true;
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
            isTemporaryMode = true;
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
