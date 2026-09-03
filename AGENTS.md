# AGENTS.md

Instructions for AI coding agents working on the `gemini-temp-chat-toggle` Firefox extension repository.

## Development Guidelines

- **Architecture**: Firefox WebExtension (Manifest V3).
- **Core Scripts**:
  - `background.js`: Handles browser-level keyboard commands (`browser.commands`), `activeTab` recovery, and runtime messaging.
  - `content/content.js`: Injected into `gemini.google.com`. Interacts with Gemini's top-bar `<temp-chat-button>`, detects active temporary mode, and renders the floating HUD toast.
  - `content/toast.css`: Toast styling (SVG icons, smooth slide/fade animations, safe DOM).
  - `options/options.html`, `options.js`, `options.css`: Popup & options page for recording keyboard shortcuts and managing permissions.
- **Verification**:
  - Run `npm test` before every commit (tests DOM automation, shortcut logic, background routing).
  - Run `npm run lint` (`web-ext lint --self-hosted`) to ensure 0 errors and 0 warnings.
  - Run `npm run serve` to start the local visual mock testbed (`http://localhost:3300/`).

## Publishing Releases

Whenever publishing a new version of the extension, follow these exact steps in order:

1. **Bump Version**: Update `"version"` in `manifest.json` and `package.json`.
2. **Update Changelog**: Add release notes under `CHANGELOG.md` following the Keep a Changelog format.
3. **Verify & Build**:
   ```bash
   npm test
   npm run lint
   npm run build
   ```
   This generates the clean release archive: `gemini-temp-chat-toggle.zip`.
4. **Sign via AMO**: Upload `gemini-temp-chat-toggle.zip` to the Mozilla AMO Developer Hub to generate the signed `.xpi`.
5. **GitHub Release**: Create release `v<version>` on GitHub (`dillontkh/gemini-temp-chat-toggle`) and attach the signed `.xpi`.
6. **Update `updates.json`**:
   - Compute the sha256 hash of the downloaded signed `.xpi`:
     ```bash
     sha256sum gemini_temporary_chat_toggle-<version>.xpi
     ```
   - Add the update entry with download URL and sha256 hash to `updates.json` so existing Firefox installations auto-update.
7. **Commit & Sync**: Commit and push changes in `gemini-temp-chat-toggle`, then update the submodule pointer in `agent-workspace`.
