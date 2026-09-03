# AGENTS.md

## Verification

Before committing changes, ensure tests and linting pass:
```bash
npm test
npm run lint
```

## Publishing Releases

Releases are automated via GitHub Actions ([.github/workflows/release.yml](.github/workflows/release.yml)). The workflow triggers on version tags matching `v*`.

### Prerequisites
- GitHub repository secrets: `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`.
- Workflow permission: `contents: write` (enabled in workflow).

### Release Steps

1. **Bump Version**: Update `"version"` in `manifest.json` and `package.json`.
2. **Update Changelog**: Add release notes under `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.
3. **Verify Locally**:
   ```bash
   npm test
   npm run lint
   ```
4. **Commit & Push Tag**:
   ```bash
   git add manifest.json package.json CHANGELOG.md
   git commit -m "chore(release): bump version to <version>"
   git tag v<version>
   git push origin main --tags
   ```

Once the tag is pushed, the automated pipeline takes care of the rest:
- Validates tests and linter in CI.
- Signs the add-on via Mozilla AMO API (`web-ext sign --channel=unlisted`).
- Computes the SHA-256 hash of the signed `.xpi`.
- Appends the new release entry to `updates.json` and pushes the commit directly to `main`.
- Creates the GitHub Release `v<version>` with the signed `.xpi` attached.

*(Note: Run `git pull origin main` before starting subsequent work to sync the automated `updates.json` commit.)*

### Manual Release Fallback
If the automated AMO API signing is ever unavailable:
1. Build clean zip: `npm run build`
2. Upload `gemini-temp-chat-toggle.zip` to [Mozilla AMO Developer Hub](https://addons.mozilla.org/developers/) to generate signed `.xpi`.
3. Compute SHA-256: `sha256sum gemini_temporary_chat_toggle-<version>.xpi`
4. Add entry to `updates.json` and push to `main`.
5. Create GitHub release `v<version>` and attach the signed `.xpi`.
