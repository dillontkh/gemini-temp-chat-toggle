const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const {
  findTemporaryChatButton,
  findNewChatButton,
  isTemporaryChatActive,
  isNewChat,
  isNewTemporaryChat,
  sendNewChatShortcut
} = require('../content/content.js');

const normalHtmlPath = path.join(__dirname, '..', 'dev', 'normal.html');
const tempHtmlPath = path.join(__dirname, '..', 'dev', 'temporary.html');

describe("Content Script DOM Automation on Real Gemini Dumps", () => {
  test("Normal HTML dump evaluates isTemporaryChatActive as FALSE", () => {
    if (!fs.existsSync(normalHtmlPath)) return;
    const html = fs.readFileSync(normalHtmlPath, 'utf8');
    const dom = new JSDOM(html);
    assert.strictEqual(isTemporaryChatActive(dom.window.document), false);
  });

  test("Temporary HTML dump evaluates isTemporaryChatActive as TRUE", () => {
    if (!fs.existsSync(tempHtmlPath)) return;
    const html = fs.readFileSync(tempHtmlPath, 'utf8');
    const dom = new JSDOM(html);
    assert.strictEqual(isTemporaryChatActive(dom.window.document), true);
  });

  test("Finds the Temporary Chat button in normal HTML dump", () => {
    if (!fs.existsSync(normalHtmlPath)) return;
    const html = fs.readFileSync(normalHtmlPath, 'utf8');
    const dom = new JSDOM(html);
    const btn = findTemporaryChatButton(dom.window.document);
    assert.ok(btn);
    assert.strictEqual(btn.getAttribute("aria-label"), "Temporary chat");
  });

  test("Finds the Temporary Chat button in temporary HTML dump", () => {
    if (!fs.existsSync(tempHtmlPath)) return;
    const html = fs.readFileSync(tempHtmlPath, 'utf8');
    const dom = new JSDOM(html);
    const btn = findTemporaryChatButton(dom.window.document);
    assert.ok(btn);
    assert.strictEqual(btn.getAttribute("aria-label"), "Temporary chat");
  });

  test("Toggle logic correctly alternates: Normal -> ON, Temporary -> OFF", () => {
    if (!fs.existsSync(normalHtmlPath) || !fs.existsSync(tempHtmlPath)) return;
    const normDom = new JSDOM(fs.readFileSync(normalHtmlPath, 'utf8'));
    const tempDom = new JSDOM(fs.readFileSync(tempHtmlPath, 'utf8'));

    // From normal: wasActive is false -> ON
    const wasActiveNorm = isTemporaryChatActive(normDom.window.document);
    assert.strictEqual(wasActiveNorm, false);
    const nextToastNorm = wasActiveNorm ? "Temporary Chat: OFF" : "Temporary Chat: ON";
    assert.strictEqual(nextToastNorm, "Temporary Chat: ON");

    // From temporary: wasActive is true -> OFF
    const wasActiveTemp = isTemporaryChatActive(tempDom.window.document);
    assert.strictEqual(wasActiveTemp, true);
    const nextToastTemp = wasActiveTemp ? "Temporary Chat: OFF" : "Temporary Chat: ON";
    assert.strictEqual(nextToastTemp, "Temporary Chat: OFF");
  });

  test("Finds the New Chat button in normal HTML dump", () => {
    if (!fs.existsSync(normalHtmlPath)) return;
    const html = fs.readFileSync(normalHtmlPath, 'utf8');
    const dom = new JSDOM(html);
    const btn = findNewChatButton(dom.window.document);
    assert.ok(btn);
    assert.match(btn.getAttribute("aria-label") || "", /new chat/i);
  });

  test("Finds the New Chat button in temporary HTML dump", () => {
    if (!fs.existsSync(tempHtmlPath)) return;
    const html = fs.readFileSync(tempHtmlPath, 'utf8');
    const dom = new JSDOM(html);
    const btn = findNewChatButton(dom.window.document);
    assert.ok(btn);
    assert.match(btn.getAttribute("aria-label") || "", /new chat/i);
  });

  test("isNewChat correctly identifies new chats vs conversations with message history", () => {
    if (!fs.existsSync(normalHtmlPath)) return;
    const html = fs.readFileSync(normalHtmlPath, 'utf8');
    const dom = new JSDOM(html, { url: "https://gemini.google.com/app" });
    assert.strictEqual(isNewChat(dom.window.document), true);

    // Simulate existing chat by appending a message turn
    const msg = dom.window.document.createElement("div");
    msg.className = "user-query-container";
    dom.window.document.body.appendChild(msg);
    assert.strictEqual(isNewChat(dom.window.document), false);
  });

  test("isNewChat detects conversation IDs in URL pathname", () => {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "https://gemini.google.com/app/969f688e5eb79d46"
    });
    assert.strictEqual(isNewChat(dom.window.document), false);

    const newChatDom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "https://gemini.google.com/app"
    });
    assert.strictEqual(isNewChat(newChatDom.window.document), true);
  });

  test("isNewTemporaryChat distinguishes fresh temporary chat from normal and ongoing chats", () => {
    if (!fs.existsSync(normalHtmlPath) || !fs.existsSync(tempHtmlPath)) return;
    const normDom = new JSDOM(fs.readFileSync(normalHtmlPath, 'utf8'), { url: "https://gemini.google.com/app" });
    const tempDom = new JSDOM(fs.readFileSync(tempHtmlPath, 'utf8'), { url: "https://gemini.google.com/app" });

    // Normal empty chat: temporary chat is NOT active
    assert.strictEqual(isNewTemporaryChat(normDom.window.document), false);

    // Fresh temporary chat: temporary chat IS active and is a new chat
    assert.strictEqual(isNewTemporaryChat(tempDom.window.document), true);

    // If messages are sent in temporary chat, it is no longer a fresh new chat
    const msg = tempDom.window.document.createElement("div");
    msg.className = "user-query-container";
    tempDom.window.document.body.appendChild(msg);
    assert.strictEqual(isNewTemporaryChat(tempDom.window.document), false);
  });

  test("sendNewChatShortcut dispatches Ctrl+Shift+O keydown and keyup events", () => {
    const dom = new JSDOM("<!DOCTYPE html><html><body><input id='test-input'/></body></html>");
    const doc = dom.window.document;
    const events = [];

    dom.window.addEventListener("keydown", (e) => {
      events.push({ type: "keydown", key: e.key, code: e.code, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey });
    });
    dom.window.addEventListener("keyup", (e) => {
      events.push({ type: "keyup", key: e.key, code: e.code, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey });
    });

    // Run dispatch inside mock DOM context
    const origDoc = global.document;
    const origWin = global.window;
    const origNav = global.navigator;
    const origKeyboardEvent = global.KeyboardEvent;

    global.document = doc;
    global.window = dom.window;
    global.navigator = dom.window.navigator;
    global.KeyboardEvent = dom.window.KeyboardEvent;

    try {
      sendNewChatShortcut();
      assert.ok(events.length > 0);
      const oKeydowns = events.filter(e => e.type === "keydown" && (e.key === "o" || e.key === "O") && e.ctrlKey && e.shiftKey);
      assert.ok(oKeydowns.length > 0);
    } finally {
      global.document = origDoc;
      global.window = origWin;
      global.navigator = origNav;
      global.KeyboardEvent = origKeyboardEvent;
    }
  });

  test("toggleTemporaryChat triggers new chat and turns temporary chat ON from existing conversation", async () => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <a data-test-id="side-nav-sparkle-button" aria-label="New chat" href="/"></a>
        <div class="user-query-container">Existing user prompt</div>
      </body></html>`,
      { url: "https://gemini.google.com/app/abcd1234efgh" }
    );
    const doc = dom.window.document;

    let newChatTriggered = false;
    let tempButtonClicked = false;

    // Simulate Gemini UI transition when New chat is triggered (via Ctrl+Shift+O or button)
    const onNewChatTriggered = () => {
      newChatTriggered = true;
      setTimeout(() => {
        // Simulate SPA route change to /app
        dom.window.history.pushState({}, "", "/app");
        // Remove existing messages
        const msg = doc.querySelector(".user-query-container");
        if (msg) msg.remove();
        // Add temporary chat button
        const tempBtnContainer = doc.createElement("temp-chat-button");
        const btn = doc.createElement("button");
        btn.setAttribute("aria-label", "Temporary chat");
        btn.addEventListener("click", () => {
          tempButtonClicked = true;
          tempBtnContainer.classList.add("temp-chat-on");
        });
        tempBtnContainer.appendChild(btn);
        doc.body.appendChild(tempBtnContainer);
      }, 50);
    };

    dom.window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "o" || e.key === "O" || e.code === "KeyO")) {
        onNewChatTriggered();
      }
    });

    const newChatBtn = doc.querySelector('a[data-test-id="side-nav-sparkle-button"]');
    newChatBtn.addEventListener("click", onNewChatTriggered);

    const origDoc = global.document;
    const origWin = global.window;
    const origNav = global.navigator;
    const origKeyboardEvent = global.KeyboardEvent;
    const origMutationObserver = global.MutationObserver;

    global.document = doc;
    global.window = dom.window;
    global.navigator = dom.window.navigator;
    global.KeyboardEvent = dom.window.KeyboardEvent;
    global.MutationObserver = dom.window.MutationObserver;

    try {
      const { toggleTemporaryChat } = require('../content/content.js');
      await toggleTemporaryChat();

      assert.strictEqual(newChatTriggered, true, "New chat should have been triggered");
      assert.strictEqual(tempButtonClicked, true, "Temporary chat button should have been clicked to turn ON");
    } finally {
      global.document = origDoc;
      global.window = origWin;
      global.navigator = origNav;
      global.KeyboardEvent = origKeyboardEvent;
      global.MutationObserver = origMutationObserver;
    }
  });
});
