/**
 * Gemini Temporary Chat Toggle - Options & Popup Controller
 */

const COMMAND_NAME = "toggle-temporary-chat";
const DEFAULT_SHORTCUT = "Alt+Shift+T";

const currentBadge = document.getElementById("current-badge");
const recorderInput = document.getElementById("recorder-input");
const saveBtn = document.getElementById("save-shortcut-btn");
const resetBtn = document.getElementById("reset-shortcut-btn");
const feedbackEl = document.getElementById("recorder-feedback");

const showToastCheck = document.getElementById("show-toast-check");
const outsideBehaviorSelect = document.getElementById("outside-behavior-select");
const testToggleBtn = document.getElementById("test-toggle-btn");
const testFeedbackEl = document.getElementById("test-feedback");

let recordedShortcut = "";
let isRecording = false;

// Initialize settings
async function init() {
  // 1. Fetch current shortcut from browser.commands
  try {
    const commands = await browser.commands.getAll();
    const cmd = commands.find(c => c.name === COMMAND_NAME);
    const activeShortcut = (cmd && cmd.shortcut) ? cmd.shortcut : DEFAULT_SHORTCUT;
    currentBadge.textContent = activeShortcut;
  } catch (e) {
    currentBadge.textContent = DEFAULT_SHORTCUT;
  }

  // 2. Fetch preferences from storage
  try {
    const data = await browser.storage.sync.get({
      showToast: true,
      outsideTabBehavior: "ignore"
    });
    showToastCheck.checked = data.showToast;
    outsideBehaviorSelect.value = data.outsideTabBehavior;
  } catch (e) {
    console.warn("Storage sync failed, using defaults:", e);
  }

  // 3. Check persistent host permission status
  await checkHostPermission();
}

// Check and update permission banner visibility
async function checkHostPermission() {
  try {
    const permCard = document.getElementById("permission-card");
    if (!permCard || !browser.permissions) return;

    const hasPerm = await browser.permissions.contains({
      origins: ["*://gemini.google.com/*"]
    });

    permCard.style.display = hasPerm ? "none" : "flex";
  } catch (e) {
    console.warn("Could not check permissions:", e);
  }
}

// Grant Persistent Permission Button
const grantPermBtn = document.getElementById("grant-perm-btn");
if (grantPermBtn) {
  grantPermBtn.addEventListener("click", async () => {
    try {
      grantPermBtn.disabled = true;
      const granted = await browser.permissions.request({
        origins: ["*://gemini.google.com/*"]
      });
      if (granted) {
        await checkHostPermission();
        setFeedback("Permanent permission granted! Extension will run automatically on refresh.", "success");
      } else {
        grantPermBtn.disabled = false;
      }
    } catch (err) {
      console.error("Permission request error:", err);
      grantPermBtn.disabled = false;
    }
  });
}

// Show feedback message
function setFeedback(msg, type = "info") {
  feedbackEl.textContent = msg;
  feedbackEl.className = `feedback ${type}`;
}

// Convert event to valid WebExtension shortcut string
function parseEventToShortcut(e) {
  // Ignore lone modifier presses
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
    return null;
  }

  const modifiers = [];
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  if (e.ctrlKey) {
    modifiers.push(isMac ? "MacCtrl" : "Ctrl");
  }
  if (e.altKey) {
    modifiers.push("Alt");
  }
  if (e.shiftKey) {
    modifiers.push("Shift");
  }
  if (e.metaKey && isMac) {
    modifiers.push("Command");
  }

  // Validate that at least Ctrl, Alt, or Command is present (required by Firefox)
  const hasRequiredModifier = e.ctrlKey || e.altKey || (isMac && e.metaKey);
  if (!hasRequiredModifier) {
    return {
      valid: false,
      error: "Shortcut must include at least Ctrl or Alt."
    };
  }

  // Parse Key
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
    return {
      valid: false,
      error: `Key '${e.key}' is not supported by browser commands. Use A-Z, 0-9, or F1-F12.`
    };
  }

  const shortcutString = [...modifiers, key].join("+");
  return {
    valid: true,
    shortcut: shortcutString
  };
}

// Recorder Input Event Handlers
recorderInput.addEventListener("focus", () => {
  isRecording = true;
  recorderInput.classList.add("recording");
  recorderInput.value = "";
  setFeedback("Press your key combination now...", "info");
});

recorderInput.addEventListener("blur", () => {
  isRecording = false;
  recorderInput.classList.remove("recording");
  if (!recordedShortcut) {
    recorderInput.placeholder = "Click here and press key combination...";
    setFeedback("");
  }
});

recorderInput.addEventListener("keydown", (e) => {
  if (!isRecording) return;

  e.preventDefault();
  e.stopPropagation();

  // Escape cancels recording
  if (e.key === "Escape") {
    recorderInput.blur();
    setFeedback("Recording cancelled.");
    return;
  }

  const result = parseEventToShortcut(e);
  if (!result) {
    // Modifier key held down
    const held = [];
    if (e.ctrlKey) held.push("Ctrl");
    if (e.altKey) held.push("Alt");
    if (e.shiftKey) held.push("Shift");
    if (e.metaKey) held.push("Meta");
    recorderInput.value = held.length ? held.join("+") + "+..." : "...";
    return;
  }

  if (!result.valid) {
    recorderInput.value = "";
    saveBtn.disabled = true;
    setFeedback(result.error, "error");
    return;
  }

  recordedShortcut = result.shortcut;
  recorderInput.value = recordedShortcut;
  saveBtn.disabled = false;
  setFeedback(`Shortcut captured: ${recordedShortcut}. Click Apply to save.`, "success");
});

// Save Shortcut
saveBtn.addEventListener("click", async () => {
  if (!recordedShortcut) return;

  try {
    saveBtn.disabled = true;
    setFeedback("Applying shortcut...", "info");

    // 1. Update native browser command
    await browser.commands.update({
      name: COMMAND_NAME,
      shortcut: recordedShortcut
    });

    // 2. Persist to storage for content script in-page listener
    await browser.storage.sync.set({ shortcut: recordedShortcut });

    currentBadge.textContent = recordedShortcut;
    setFeedback("Shortcut saved successfully!", "success");
    recorderInput.value = "";
    recorderInput.placeholder = "Click here and press key combination...";
    recordedShortcut = "";
  } catch (err) {
    console.error("Failed to update shortcut:", err);
    saveBtn.disabled = false;
    setFeedback(`Failed to apply: ${err.message || "Invalid shortcut combination"}`, "error");
  }
});

// Reset Shortcut to Default
resetBtn.addEventListener("click", async () => {
  try {
    setFeedback("Resetting shortcut...", "info");
    await browser.commands.reset(COMMAND_NAME);
    await browser.storage.sync.set({ shortcut: DEFAULT_SHORTCUT });

    const commands = await browser.commands.getAll();
    const cmd = commands.find(c => c.name === COMMAND_NAME);
    const activeShortcut = (cmd && cmd.shortcut) ? cmd.shortcut : DEFAULT_SHORTCUT;

    currentBadge.textContent = activeShortcut;
    recorderInput.value = "";
    saveBtn.disabled = true;
    setFeedback(`Reset to default (${DEFAULT_SHORTCUT}).`, "success");
  } catch (err) {
    setFeedback(`Reset failed: ${err.message}`, "error");
  }
});

// Save Preferences
showToastCheck.addEventListener("change", async () => {
  await browser.storage.sync.set({ showToast: showToastCheck.checked });
});

outsideBehaviorSelect.addEventListener("change", async () => {
  await browser.storage.sync.set({ outsideTabBehavior: outsideBehaviorSelect.value });
});

// Test Toggle Button
testToggleBtn.addEventListener("click", async () => {
  testFeedbackEl.textContent = "Testing...";
  testFeedbackEl.style.color = "var(--text-secondary)";

  try {
    const res = await browser.runtime.sendMessage({ action: "test-toggle" });
    if (res && res.success) {
      testFeedbackEl.textContent = "Triggered successfully on Gemini tab!";
      testFeedbackEl.style.color = "var(--success-color)";
    } else {
      testFeedbackEl.textContent = (res && res.error) ? res.error : "No Gemini tab open.";
      testFeedbackEl.style.color = "var(--error-color)";
    }
  } catch (e) {
    testFeedbackEl.textContent = "Failed to communicate with tab.";
    testFeedbackEl.style.color = "var(--error-color)";
  }
});

// Run init on DOM load
document.addEventListener("DOMContentLoaded", init);
