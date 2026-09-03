# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-09-03

### Fixed
- **Page Refresh Shortcut Recovery**: Fixed an issue in Firefox Manifest V3 where refreshing the page caused the keyboard shortcut to stop working until the toolbar icon was clicked.
  - Added `"activeTab"` and `"scripting"` permissions to `manifest.json`.
  - Implemented automatic dynamic script injection fallback in `background.js` when `tabs.sendMessage` cannot reach an uninitialized content script.
  - Added a one-click "Always Allow" permission request in the options/popup interface to persistently authorize automatic script injection on `gemini.google.com`.

---

## [1.0.1] - 2026-09-03

### Fixed
- **Temporary Chat State Detection**: Fixed a bug where the notification toast repeatedly reported `"Temporary Chat: ON"` on every shortcut press regardless of whether the session was toggling on or off.
- **Accurate Gemini DOM Targeting**: Updated DOM selectors to match Google Gemini's native top-bar `<temp-chat-button>` and active state indicators:
  - Detects `.temp-chat-button.temp-chat-on` on the top bar action button.
  - Recognizes `data-mat-icon-name="close"` when the button switches to its active exit state.
  - Detects `chat-window.is-temporary-chat` and `.temporary-chat-card-container`.
  - Accurately checks for Gemini's live disclaimer text (*"Temporary chats don't appear in recent chats and aren't used to improve Google AI"*).
- **AMO Manifest Compliance**: Updated `strict_min_version` to `"142.0"` in `manifest.json` to eliminate Mozilla linter warnings regarding the `data_collection_permissions` property on desktop and mobile.

### Added
- **Automated Test Suite**: Added 17 automated tests (`npm test`) covering key parsing, background script message routing, and DOM toggle assertions against real Gemini HTML captures.
- **Visual Development Testbed**: Added a local mock server and Gemini sandbox (`dev/mock-gemini.html`, `dev/server.js`) to test shortcut handling and toast rendering in isolation.
- **Automated Clean Packaging**: Added `scripts/package.py` (`npm run build`) to produce clean, release-ready zip archives for AMO without test fixtures or development files.

---

## [1.0.0] - 2026-09-03

### Added
- Initial release of **Gemini Temporary Chat Toggle**.
- Configurable global keyboard shortcut (default `Alt+Shift+T`).
- Floating HUD toast notification indicating temporary chat status.
- Options page for customizing the keyboard shortcut and configuring behavior when invoked outside Gemini tabs.
- Full Firefox Manifest V3 support with strict privacy standards (zero data collection).
