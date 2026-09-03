const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const normalHtmlPath = path.join(__dirname, '..', 'dev', 'normal.html');
const tempHtmlPath = path.join(__dirname, '..', 'dev', 'temporary.html');

describe("Content Script DOM Automation on Real Gemini Dumps", () => {
  function isTemporaryChatActive(doc) {
    if (doc.querySelector('.temp-chat-on, temp-chat-button.temp-chat-on, gem-icon-button.temp-chat-on, [data-test-id="temp-chat-button-container"] .temp-chat-on')) {
      return true;
    }
    if (doc.querySelector('temp-chat-button [data-mat-icon-name="close"], .temp-chat-button [data-mat-icon-name="close"], temp-chat-button [fonticon="close"], .temp-chat-button [fonticon="close"]')) {
      return true;
    }
    if (doc.querySelector('chat-window.is-temporary-chat, .is-temporary-chat')) {
      return true;
    }
    if (doc.querySelector('.temporary-chat-card, .temporary-chat-card-container, .temporary-chat-header')) {
      return true;
    }
    const mainArea = doc.querySelector('main, [role="main"], chat-app') || doc.body;
    const text = mainArea ? (mainArea.textContent || '') : '';
    if (/don't appear in recent chats/i.test(text) && /aren't used to improve google ai/i.test(text)) {
      return true;
    }
    return false;
  }

  function findTemporaryChatButton(doc) {
    let el = doc.querySelector('temp-chat-button button, [data-test-id="temp-chat-button-container"] button, .temp-chat-button button');
    if (el) return el;
    el = doc.querySelector('button[aria-label*="Temporary chat" i]');
    if (el) return el;
    return null;
  }

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
});
