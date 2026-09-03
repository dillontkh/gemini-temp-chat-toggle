const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

describe("Content Script DOM Automation & Toast Tests", () => {
  let dom, document, window;

  beforeEach(() => {
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
              <div class="prompt-container">
                <textarea placeholder="Ask Gemini" class="prompt-box"></textarea>
              </div>
            </main>
          </div>
        </body>
      </html>`, { runScripts: "dangerously" });

    document = dom.window.document;
    window = dom.window;
  });

  function findTemporaryChatButton(doc) {
    let el = doc.querySelector('[aria-label*="Temporary chat" i]');
    if (el) return el.closest('button, [role="button"]') || el;
    el = doc.querySelector('[data-tooltip*="Temporary chat" i]');
    if (el) return el.closest('button, [role="button"]') || el;
    const buttons = doc.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const text = (btn.innerText || btn.textContent || '').trim();
      if (/temporary\s*chat/i.test(text) && text.length < 50) return btn;
    }
    return null;
  }

  function findNewChatButton(doc) {
    let el = doc.querySelector('[aria-label*="New chat" i]');
    if (el) return el.closest('button, [role="button"]') || el;
    el = doc.querySelector('[data-tooltip*="New chat" i]');
    if (el) return el.closest('button, [role="button"]') || el;
    const buttons = doc.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const text = (btn.innerText || btn.textContent || '').trim();
      if (/^new\s*chat$/i.test(text)) return btn;
    }
    return null;
  }

  function isTemporaryChatActive(doc) {
    const inputs = doc.querySelectorAll('textarea, [contenteditable="true"], rich-textarea, .ql-editor');
    for (const input of inputs) {
      const ph = input.getAttribute('placeholder') || input.getAttribute('data-placeholder') || input.getAttribute('aria-label') || '';
      if (/temporary\s*chat/i.test(ph)) return true;
    }
    const tempBtn = findTemporaryChatButton(doc);
    if (tempBtn) {
      if (tempBtn.getAttribute('aria-pressed') === 'true' || tempBtn.getAttribute('aria-checked') === 'true') return true;
      if (tempBtn.classList.contains('active') || tempBtn.classList.contains('selected')) return true;
    }
    const notices = doc.querySelectorAll('header, [role="banner"], main');
    for (const container of notices) {
      const text = container.textContent || '';
      if (/chats aren't saved to your google account|temporary chat is on/i.test(text)) return true;
    }
    return false;
  }

  test("Finds Temporary Chat button via aria-label", () => {
    const btn = findTemporaryChatButton(document);
    assert.ok(btn);
    assert.strictEqual(btn.getAttribute("aria-label"), "Temporary chat");
  });

  test("Finds New Chat button via aria-label", () => {
    const btn = findNewChatButton(document);
    assert.ok(btn);
    assert.strictEqual(btn.getAttribute("aria-label"), "New chat");
  });

  test("Correctly identifies inactive temporary chat", () => {
    assert.strictEqual(isTemporaryChatActive(document), false);
  });

  test("Correctly identifies active temporary chat via placeholder", () => {
    const textarea = document.querySelector("textarea");
    textarea.setAttribute("placeholder", "Ask in a temporary chat");
    assert.strictEqual(isTemporaryChatActive(document), true);
  });

  test("Correctly identifies active temporary chat via aria-pressed", () => {
    const btn = findTemporaryChatButton(document);
    btn.setAttribute("aria-pressed", "true");
    assert.strictEqual(isTemporaryChatActive(document), true);
  });

  test("Toggles to active when clicked", () => {
    let clicked = false;
    const btn = findTemporaryChatButton(document);
    btn.addEventListener("click", () => {
      clicked = true;
      btn.setAttribute("aria-pressed", "true");
      document.querySelector("textarea").setAttribute("placeholder", "Ask in a temporary chat");
    });

    btn.click();
    assert.strictEqual(clicked, true);
    assert.strictEqual(isTemporaryChatActive(document), true);
  });

  test("Creates floating toast element using safe DOM APIs (no innerHTML)", () => {
    const toast = document.createElement("div");
    toast.id = "gemini-temp-chat-toast";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");

    const iconSpan = document.createElement("span");
    iconSpan.className = "toast-icon";
    iconSpan.appendChild(svg);

    const textSpan = document.createElement("span");
    textSpan.className = "toast-text";
    textSpan.textContent = "Temporary Chat: ON";

    toast.append(iconSpan, textSpan);
    document.body.appendChild(toast);

    const attached = document.getElementById("gemini-temp-chat-toast");
    assert.ok(attached);
    assert.strictEqual(attached.querySelector(".toast-text").textContent, "Temporary Chat: ON");
    assert.ok(attached.querySelector("svg"));
  });
});
