const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

describe("Content Script DOM Automation & Toggle Cycle Tests", () => {
  let dom, document, window;
  let isTemporaryMode = false;
  let lastToast = null;

  beforeEach(() => {
    isTemporaryMode = false;
    lastToast = null;

    dom = new JSDOM(`<!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div class="app-container">
            <button aria-label="Main menu" class="menu-btn">Menu</button>
            <div class="sidebar">
              <button aria-label="New chat" class="new-chat-btn">New chat</button>
              <button aria-label="Temporary chat" class="temp-chat-btn">Temporary chat</button>
            </div>
            <main>
              <div id="banner-slot"></div>
              <div class="prompt-container">
                <textarea placeholder="Ask Gemini" class="prompt-box"></textarea>
              </div>
            </main>
          </div>
        </body>
      </html>`, { runScripts: "dangerously" });

    document = dom.window.document;
    window = dom.window;

    // Attach click listeners mimicking Gemini behavior
    const tempBtn = document.querySelector('.temp-chat-btn');
    const newChatBtn = document.querySelector('.new-chat-btn');

    tempBtn.addEventListener("click", () => {
      // In real Gemini, clicking Temporary chat adds the banner
      document.getElementById("banner-slot").innerHTML = `
        <div class="temporary-banner">
          <h3>Temporary chat</h3>
          <p>Your chats aren't saved to your chat history or used to train Gemini apps.</p>
        </div>`;
    });

    newChatBtn.addEventListener("click", () => {
      // In real Gemini, clicking New chat removes the temporary banner
      document.getElementById("banner-slot").innerHTML = "";
    });
  });

  function hasTemporaryBanner(doc) {
    const mainArea = doc.querySelector('main, [role="main"], .conversation-container, #chat-history') || doc.body;
    const fullText = mainArea ? (mainArea.textContent || '') : '';
    if (/chats? (aren't|are not|won't be|not) saved/i.test(fullText)) return true;
    if (/saved to your chat history/i.test(fullText)) return true;
    if (/train gemini apps/i.test(fullText)) return true;

    const headings = (mainArea || doc.body).querySelectorAll('h1, h2, h3, h4, [role="heading"], div, span');
    for (const h of headings) {
      if (h.children.length <= 1 && h.textContent) {
        const t = h.textContent.trim();
        if (/^temporary\s*chat$/i.test(t)) {
          const isSidebarButton = h.closest('aside, nav, [role="navigation"], .sidebar');
          if (!isSidebarButton) return true;
        }
      }
    }
    return false;
  }

  function isTemporaryChatActive(doc) {
    if (hasTemporaryBanner(doc)) {
      isTemporaryMode = true;
      return true;
    }
    return isTemporaryMode;
  }

  function findTemporaryChatButton(doc) {
    return doc.querySelector('[aria-label*="Temporary chat" i]');
  }

  function findNewChatButton(doc) {
    return doc.querySelector('[aria-label*="New chat" i]');
  }

  function showToast(msg, type) {
    lastToast = { message: msg, type: type };
  }

  function toggleTemporaryChat(doc) {
    const isActive = isTemporaryChatActive(doc);
    if (isActive) {
      const newChatBtn = findNewChatButton(doc);
      if (newChatBtn) {
        newChatBtn.click();
        isTemporaryMode = false;
        showToast("Temporary Chat: OFF", "off");
        return;
      }
    } else {
      const tempBtn = findTemporaryChatButton(doc);
      if (tempBtn) {
        tempBtn.click();
        isTemporaryMode = true;
        showToast("Temporary Chat: ON", "on");
        return;
      }
    }
  }

  test("Initial state is standard chat (OFF)", () => {
    assert.strictEqual(isTemporaryChatActive(document), false);
  });

  test("Detects real Gemini banner text: 'Your chats aren't saved to your chat history...'", () => {
    document.getElementById("banner-slot").innerHTML = `
      <div>Your chats aren't saved to your chat history or used to train Gemini apps.</div>`;
    assert.strictEqual(hasTemporaryBanner(document), true);
    assert.strictEqual(isTemporaryChatActive(document), true);
  });

  test("Cycle: ON -> OFF -> ON produces alternating toasts", () => {
    // 1st Toggle: Turn ON
    toggleTemporaryChat(document);
    assert.strictEqual(lastToast.message, "Temporary Chat: ON");
    assert.strictEqual(lastToast.type, "on");
    assert.strictEqual(hasTemporaryBanner(document), true);

    // 2nd Toggle: Turn OFF
    toggleTemporaryChat(document);
    assert.strictEqual(lastToast.message, "Temporary Chat: OFF");
    assert.strictEqual(lastToast.type, "off");
    assert.strictEqual(hasTemporaryBanner(document), false);

    // 3rd Toggle: Turn ON again
    toggleTemporaryChat(document);
    assert.strictEqual(lastToast.message, "Temporary Chat: ON");
    assert.strictEqual(lastToast.type, "on");
    assert.strictEqual(hasTemporaryBanner(document), true);
  });
});
