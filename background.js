/**
 * Gemini Temporary Chat Toggle - Background Script
 */

const COMMAND_NAME = "toggle-temporary-chat";

/**
 * Send toggle message to tab, dynamically injecting content script if not loaded
 */
async function sendToggleOrInject(tabId) {
  try {
    await browser.tabs.sendMessage(tabId, { action: "toggle-temporary-chat" });
  } catch (err) {
    // Content script not reachable yet (e.g. freshly refreshed tab where declarative script hasn't run)
    try {
      if (browser.scripting) {
        await browser.scripting.insertCSS({
          target: { tabId },
          files: ["content/toast.css"]
        }).catch(() => {});

        await browser.scripting.executeScript({
          target: { tabId },
          files: ["content/content.js"]
        });

        // Small delay to allow script initialization
        setTimeout(async () => {
          try {
            await browser.tabs.sendMessage(tabId, { action: "toggle-temporary-chat" });
          } catch (retryErr) {
            console.error("[Gemini Temp Chat] Failed to send message after injection:", retryErr);
          }
        }, 60);
      }
    } catch (injectErr) {
      console.error("[Gemini Temp Chat] Failed to inject content script:", injectErr);
    }
  }
}

// Listen for keyboard command triggers from browser.commands
browser.commands.onCommand.addListener(async (command) => {
  if (command !== COMMAND_NAME) return;

  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (!activeTab) return;

    let isGemini = activeTab.url && activeTab.url.includes("gemini.google.com");
    if (!isGemini && !activeTab.url) {
      try {
        const fullTab = await browser.tabs.get(activeTab.id);
        if (fullTab && fullTab.url && fullTab.url.includes("gemini.google.com")) {
          isGemini = true;
        }
      } catch (e) {}
    }

    if (isGemini) {
      // Send toggle message directly to the active Gemini tab
      await sendToggleOrInject(activeTab.id);
      return;
    }

    // Active tab is not Gemini. Check configured behavior outside Gemini tabs.
    const config = await browser.storage.sync.get({ outsideTabBehavior: "ignore" }).catch(() => ({ outsideTabBehavior: "ignore" }));

    if (config.outsideTabBehavior === "switch") {
      const geminiTabs = await browser.tabs.query({ url: "*://gemini.google.com/*" });
      if (geminiTabs.length > 0) {
        const targetTab = geminiTabs[0];
        await browser.tabs.update(targetTab.id, { active: true });
        if (targetTab.windowId) {
          await browser.windows.update(targetTab.windowId, { focused: true });
        }
        setTimeout(async () => {
          await sendToggleOrInject(targetTab.id);
        }, 200);
      } else {
        // No open Gemini tab; open a new one
        await browser.tabs.create({ url: "https://gemini.google.com/app" });
      }
    } else if (config.outsideTabBehavior === "open") {
      await browser.tabs.create({ url: "https://gemini.google.com/app" });
    }
  } catch (error) {
    console.error("[Gemini Temp Chat] Error in command handler:", error);
  }
});

// Handle requests from options / popup UI
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action === "get-command-shortcut") {
    try {
      const commands = await browser.commands.getAll();
      const cmd = commands.find(c => c.name === COMMAND_NAME);
      return { success: true, shortcut: cmd ? cmd.shortcut : "Alt+Shift+T" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  if (message.action === "update-command-shortcut") {
    try {
      await browser.commands.update({
        name: COMMAND_NAME,
        shortcut: message.shortcut
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  if (message.action === "reset-command-shortcut") {
    try {
      await browser.commands.reset(COMMAND_NAME);
      const commands = await browser.commands.getAll();
      const cmd = commands.find(c => c.name === COMMAND_NAME);
      return { success: true, shortcut: cmd ? cmd.shortcut : "Alt+Shift+T" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  if (message.action === "test-toggle") {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (activeTab && activeTab.url && activeTab.url.includes("gemini.google.com")) {
        await sendToggleOrInject(activeTab.id);
        return { success: true, target: "active_gemini_tab" };
      } else {
        const geminiTabs = await browser.tabs.query({ url: "*://gemini.google.com/*" });
        if (geminiTabs.length > 0) {
          await sendToggleOrInject(geminiTabs[0].id);
          return { success: true, target: "background_gemini_tab" };
        }
        return { success: false, error: "No open Gemini tab found to test with." };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
});
