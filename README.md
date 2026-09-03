# Gemini Temporary Chat Toggle (Firefox Add-on)

A lightweight, privacy-focused Firefox extension that lets you seamlessly toggle Google Gemini's **Temporary Chat** mode using a configurable keyboard shortcut.

---

## Features

- ⚡ **Instant Toggle**: Switch between ephemeral Temporary Chat and standard chat with a single keypress.
- ⌨️ **Configurable Keyboard Shortcut**: Default is `Alt+Shift+T`. Easily change it via the interactive in-addon recorder or Firefox's native shortcut settings.
- 💬 **Visual Feedback**: Sleek, unobtrusive floating status pill (`Temporary Chat: ON` / `Temporary Chat: OFF`) at the top of the viewport.
- 🎯 **Robust DOM Automation**: Automatically locates the Temporary Chat button (even in collapsed sidebar states) and detects current session status.
- 🎛️ **Customizable Behavior**: Configure what happens if the shortcut is pressed while viewing non-Gemini tabs (ignore, switch to existing Gemini tab, or open Gemini).

---

## Installation in Firefox (Temporary Add-on)

To run and test the add-on locally in Firefox:

1. Open Firefox.
2. In the address bar, navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
3. Click the **"Load Temporary Add-on..."** button.
4. Browse to this directory and select:
   ```text
   /home/dtserver/agent-workspace/gemini-temp-chat-toggle/manifest.json
   ```
5. The add-on will now be loaded and active!

---

## How to Use

1. Navigate to [Google Gemini](https://gemini.google.com/).
2. Press **`Alt+Shift+T`** (default shortcut).
3. Temporary chat will activate immediately and display a floating indicator.
4. Press **`Alt+Shift+T`** again to exit temporary chat and return to normal chat.

---

## Changing the Shortcut

You can configure the shortcut in two ways:

### Method 1: In the Extension Settings / Popup
1. Click the Gemini Temporary Chat icon in your Firefox toolbar.
2. Click into the **Record New Shortcut** field.
3. Press your desired shortcut (e.g. `Ctrl+Alt+T`, `Alt+Shift+G`).
4. Click **Apply**.

### Method 2: Firefox Native Shortcut Manager
1. Navigate to `about:addons`.
2. Click the ⚙️ **Gear icon** in the top right.
3. Select **"Manage Extension Shortcuts"**.
4. Set your custom shortcut for **"Toggle Gemini Temporary Chat mode"**.

---

## File Structure

```text
gemini-temp-chat-toggle/
├── manifest.json              # WebExtension Manifest V3
├── background.js              # Native commands handler & tab router
├── content/
│   ├── content.js             # Gemini DOM interaction & keyboard listener
│   └── toast.css              # Styling for on-screen status toast
├── options/
│   ├── options.html           # Settings & interactive shortcut recorder
│   ├── options.js             # Shortcut capture, validation & storage logic
│   └── options.css            # Dark mode styling for settings
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```
