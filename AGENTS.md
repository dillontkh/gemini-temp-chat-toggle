# AGENTS.md

## Verification

Before committing changes, ensure tests and linting pass:
```bash
npm test
npm run lint
```

## Publishing Releases

1. **Bump Version**: Update `"version"` in `manifest.json` and `package.json`.
2. **Update Changelog**: Add release notes under `CHANGELOG.md` (Keep a Changelog format).
3. **Verify & Build**:
   ```bash
   npm test
   npm run lint
   npm run build
   ```
4. **Sign via AMO**: Upload `gemini-temp-chat-toggle.zip` to Mozilla AMO Developer Hub to generate the signed `.xpi`.
5. **GitHub Release**: Create release `v<version>` on GitHub and attach the signed `.xpi`.
6. **Update `updates.json`**:
   - Compute the sha256 hash:
     ```bash
     sha256sum gemini_temporary_chat_toggle-<version>.xpi
     ```
   - Add the update entry with download URL and sha256 hash to `updates.json`.
7. **Commit & Sync**: Commit and push changes, then update the submodule pointer in `agent-workspace`.
