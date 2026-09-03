const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

describe("Background Script Command Routing & Message Handler Tests", () => {
  let mockBrowser;
  let sentMessages = [];
  let updatedTabs = [];
  let createdTabs = [];

  beforeEach(() => {
    sentMessages = [];
    updatedTabs = [];
    createdTabs = [];

    mockBrowser = {
      storage: {
        sync: {
          data: { outsideTabBehavior: "ignore" },
          get: async (defaults) => Object.assign({}, defaults, mockBrowser.storage.sync.data),
          set: async (obj) => Object.assign(mockBrowser.storage.sync.data, obj)
        }
      },
      tabs: {
        activeTabs: [{ id: 101, url: "https://gemini.google.com/app", windowId: 1 }],
        allTabs: [],
        query: async (queryInfo) => {
          if (queryInfo.active) return mockBrowser.tabs.activeTabs;
          if (queryInfo.url) {
            return mockBrowser.tabs.allTabs.filter(t => t.url.includes("gemini.google.com"));
          }
          return mockBrowser.tabs.allTabs;
        },
        sendMessage: async (tabId, msg) => {
          sentMessages.push({ tabId, msg });
          return { status: "received" };
        },
        update: async (tabId, updateProps) => {
          updatedTabs.push({ tabId, updateProps });
          return { id: tabId, ...updateProps };
        },
        create: async (createProps) => {
          createdTabs.push(createProps);
          return { id: 202, ...createProps };
        }
      },
      windows: {
        update: async (winId, props) => ({ winId, ...props })
      },
      commands: {
        list: [{ name: "toggle-temporary-chat", shortcut: "Alt+Shift+T" }],
        getAll: async () => mockBrowser.commands.list,
        update: async ({ name, shortcut }) => {
          const c = mockBrowser.commands.list.find(x => x.name === name);
          if (c) c.shortcut = shortcut;
        },
        reset: async (name) => {
          const c = mockBrowser.commands.list.find(x => x.name === name);
          if (c) c.shortcut = "Alt+Shift+T";
        }
      }
    };
  });

  async function handleCommand(command, browserInstance) {
    if (command !== "toggle-temporary-chat") return;
    const tabs = await browserInstance.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    const isGemini = activeTab && activeTab.url && activeTab.url.includes("gemini.google.com");

    if (isGemini) {
      await browserInstance.tabs.sendMessage(activeTab.id, { action: "toggle-temporary-chat" });
      return;
    }

    const config = await browserInstance.storage.sync.get({ outsideTabBehavior: "ignore" });
    if (config.outsideTabBehavior === "switch") {
      const geminiTabs = await browserInstance.tabs.query({ url: "*://gemini.google.com/*" });
      if (geminiTabs.length > 0) {
        await browserInstance.tabs.update(geminiTabs[0].id, { active: true });
        await browserInstance.tabs.sendMessage(geminiTabs[0].id, { action: "toggle-temporary-chat" });
      } else {
        await browserInstance.tabs.create({ url: "https://gemini.google.com/app" });
      }
    } else if (config.outsideTabBehavior === "open") {
      await browserInstance.tabs.create({ url: "https://gemini.google.com/app" });
    }
  }

  test("Sends toggle message when active tab is Gemini", async () => {
    await handleCommand("toggle-temporary-chat", mockBrowser);
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].tabId, 101);
    assert.deepStrictEqual(sentMessages[0].msg, { action: "toggle-temporary-chat" });
  });

  test("Ignores shortcut outside Gemini when behavior is 'ignore'", async () => {
    mockBrowser.tabs.activeTabs = [{ id: 102, url: "https://developer.mozilla.org" }];
    await handleCommand("toggle-temporary-chat", mockBrowser);
    assert.strictEqual(sentMessages.length, 0);
    assert.strictEqual(createdTabs.length, 0);
  });

  test("Switches to existing Gemini tab when behavior is 'switch'", async () => {
    mockBrowser.tabs.activeTabs = [{ id: 102, url: "https://developer.mozilla.org" }];
    mockBrowser.tabs.allTabs = [{ id: 105, url: "https://gemini.google.com/app" }];
    mockBrowser.storage.sync.data.outsideTabBehavior = "switch";

    await handleCommand("toggle-temporary-chat", mockBrowser);
    assert.strictEqual(updatedTabs.length, 1);
    assert.strictEqual(updatedTabs[0].tabId, 105);
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].tabId, 105);
  });

  test("Opens new Gemini tab when behavior is 'open'", async () => {
    mockBrowser.tabs.activeTabs = [{ id: 102, url: "https://developer.mozilla.org" }];
    mockBrowser.storage.sync.data.outsideTabBehavior = "open";

    await handleCommand("toggle-temporary-chat", mockBrowser);
    assert.strictEqual(createdTabs.length, 1);
    assert.strictEqual(createdTabs[0].url, "https://gemini.google.com/app");
  });
});
