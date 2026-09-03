const { test, describe } = require('node:test');
const assert = require('node:assert');

// Logic extracted from options.js
function parseEventToShortcut(e, isMac = false) {
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
    return null;
  }

  const modifiers = [];
  if (e.ctrlKey) modifiers.push(isMac ? "MacCtrl" : "Ctrl");
  if (e.altKey) modifiers.push("Alt");
  if (e.shiftKey) modifiers.push("Shift");
  if (e.metaKey && isMac) modifiers.push("Command");

  const hasRequiredModifier = e.ctrlKey || e.altKey || (isMac && e.metaKey);
  if (!hasRequiredModifier) {
    return { valid: false, error: "Shortcut must include at least Ctrl or Alt." };
  }

  let key = "";
  if (e.code.startsWith("Key")) {
    key = e.code.replace("Key", "").toUpperCase();
  } else if (e.code.startsWith("Digit")) {
    key = e.code.replace("Digit", "");
  } else if (e.code.startsWith("F") && /^F\d+$/.test(e.code)) {
    key = e.code;
  } else if (["Comma", "Period", "Home", "End", "PageUp", "PageDown", "Space", "Insert", "Delete", "Up", "Down", "Left", "Right"].includes(e.code)) {
    key = e.code;
  } else {
    return { valid: false, error: `Key '${e.key}' is not supported.` };
  }

  return { valid: true, shortcut: [...modifiers, key].join("+") };
}

// Logic extracted from content.js
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

describe("Shortcut Recorder & Matcher Unit Tests", () => {
  test("Ignores solitary modifier keypresses", () => {
    assert.strictEqual(parseEventToShortcut({ key: "Alt", code: "AltLeft" }), null);
    assert.strictEqual(parseEventToShortcut({ key: "Control", code: "ControlLeft" }), null);
    assert.strictEqual(parseEventToShortcut({ key: "Shift", code: "ShiftLeft" }), null);
  });

  test("Requires at least Ctrl or Alt modifier", () => {
    const res = parseEventToShortcut({ key: "T", code: "KeyT", shiftKey: true, altKey: false, ctrlKey: false });
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /must include at least Ctrl or Alt/i);
  });

  test("Correctly parses default shortcut Alt+Shift+T", () => {
    const res = parseEventToShortcut({ key: "T", code: "KeyT", altKey: true, shiftKey: true, ctrlKey: false });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.shortcut, "Alt+Shift+T");
  });

  test("Correctly parses Ctrl+Alt+G", () => {
    const res = parseEventToShortcut({ key: "g", code: "KeyG", ctrlKey: true, altKey: true, shiftKey: false });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.shortcut, "Ctrl+Alt+G");
  });

  test("Correctly parses function keys like Alt+F2", () => {
    const res = parseEventToShortcut({ key: "F2", code: "F2", altKey: true, ctrlKey: false, shiftKey: false });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.shortcut, "Alt+F2");
  });

  test("Matches shortcut case-insensitively in content script", () => {
    const event = { key: "t", code: "KeyT", altKey: true, shiftKey: true, ctrlKey: false, metaKey: false };
    assert.strictEqual(matchesShortcut(event, "Alt+Shift+T"), true);
    assert.strictEqual(matchesShortcut(event, "alt+shift+t"), true);
  });

  test("Does not match when modifier is missing", () => {
    const event = { key: "t", code: "KeyT", altKey: true, shiftKey: false, ctrlKey: false, metaKey: false };
    assert.strictEqual(matchesShortcut(event, "Alt+Shift+T"), false);
  });

  test("Does not match when different key is pressed", () => {
    const event = { key: "x", code: "KeyX", altKey: true, shiftKey: true, ctrlKey: false, metaKey: false };
    assert.strictEqual(matchesShortcut(event, "Alt+Shift+T"), false);
  });
});
