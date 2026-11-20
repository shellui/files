# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!---
### ✨ Feature: for new features
### 🛠 Improvements: for general improvements
### 🚨 Changed: for changes in existing functionality
### ⚠️ Deprecated: for soon-to-be removed features
### 📚 Documentation: for documentation update
### 🗑 Removed: for removed features
### 🐛 Bug Fixes: for any bug fixes
### 🔒 Security: for vulnerabilities
### 🏗 Chore: for tidying code

See for sample https://raw.githubusercontent.com/favoloso/conventional-changelog-emoji/master/CHANGELOG.md
-->

## [Unreleased]

### Security

- **Markdown preview:** Rendered Markdown is sanitized before display.
- **PDF preview:** Preview type follows the content type, and the preview frame is sandboxed.
- **Shell messages:** Picker results and close messages post to the parent origin.

## [0.3.0] - 2026-11-18

### Added

- **Local dev image**: The Dockerfile `dev` target runs Vite on port 5175 with `pnpm dev`, and hot module replacement uses the published port. Set `VITE_USE_POLLING` when a bind mount does not emit file events.
- **Local service URLs**: Vite dev falls back to `VITE_STORAGE_URL` for access grants and share links when host `storage.url` is empty. `VITE_IDENTITY_URL` is the local identity-service origin for tooling. Production builds ignore both.

### Changed

- **Shellui SDK**: Uses `@shellui/sdk` 0.8.1, pinned exactly.
- **Icons**: UI icons come from lucide-react 1.61.0.
- **Translations**: The app uses react-i18next 17.0.15.
- **Docs**: The README and development notes cover the Shellui dev stack, the `dev` image, and local Vite env vars.
- **Docker publish**: The release workflow uses checkout v7, setup-qemu v4, login v4, metadata v6, and build-push v7.
- **Typecheck and tests**: TypeScript 5.9.3 and Vitest 5.0.5.

### Fixed

- **Standalone setup**: Signed-out instructions use admin on port 5173 and storage-service on port 8002.

## [0.2.4] - 2026-10-24

### ✨ Feature

- **Docker:** Publishes a `shellui/files` image to Docker Hub on each release, configured at runtime with `FRAME_ANCESTORS`.

## [0.2.3] - 2026-10-21

### 🏗 Chore

- **Shellui SDK:** Uses `@shellui/sdk` 0.7.0-alpha.1, pinned exactly.
- Requires identity-service 0.9.0 and shellui 0.7.0-alpha.1.

## [0.2.2] - 2026-10-19

### 🏗 Chore

- **Shellui SDK:** Uses `@shellui/sdk` 0.6.2.
- **Build:** Builds with Vite 8.

### 📚 Documentation

- Add `AGENTS.md` with Shellui writing and design guidelines for coding agents

## [0.2.1] - 2026-09-07

### 🔒 Security

- **PR CI:** pull requests and `develop`/`main` run format, TypeScript, Vitest, production build, gitleaks, production dependency audit, brand/secret hygiene, markdown link check, and CodeQL. GitHub Pages deploy stays on push to `main` only.

### 🐛 Bug Fixes

- **Storage auth errors:** distinguish expired sessions from other 401s (e.g. JWKS verification failures) and show the API error detail instead of a misleading “Session expired” banner
- **Empty buckets state:** no longer shows “No company files available yet” when bucket listing failed; shows a loading state while buckets load and suppresses the empty placeholder when an error is present

## [0.2.0] - 2026-08-31

### ✨ Feature

- **Folder URL sync:** navigating buckets/folders updates `/{bucket}` or `/{bucket}/{folderId}` (stable UUID) via React Router so refresh restores the same folder after renames; legacy path/`?bucket=` URLs migrate to the id form

### 🛠 Improvements

- **File preview:** opens in a right drawer (~60vw) with the close button in the viewer toolbar instead of shell chrome
- **File list loading:** keeps column headers visible (disabled) and shows skeleton rows instead of a spinner so the layout no longer jumps

### 🐛 Bug Fixes

- **Storage URL:** access grants and share links use host `storage.url` from SDK settings after `shellui.init()`. Removed the `VITE_STORAGE_URL` / `localhost:8001` fallback so the app never calls a hard-coded origin.
- **SDK resolve:** Vite no longer aliases `@shellui/sdk` to the sibling monorepo; builds use the version from `package.json` (prod CI was bundling stale `main` and dropping `showCloseButton: false` on the file viewer drawer)

## [0.1.0] - 2026-08-16

### ✨ Feature

- **Company files:** browse the system company bucket plus optional read-only connector mounts; nested folders with upload, download, rename, and delete gated by `access.can_write`
- **Path access grants:** manage folder/file permissions (allow/deny for users or the whole company)
- **Public share links:** capability URLs with expiry and/or download limits; anonymous redeem on storage-service
- **Shell modal routes:** preview, permissions, share-link, move, and storage picker UIs via hash routes (`#/viewer`, `#/permissions`, `#/share`, `#/move`, `#/select`)
- **Storage picker:** host apps open folder/file selection with `shellui.selectFolders()` / `shellui.selectFiles()`
- **Theme & i18n:** appearance and language (`en` / `fr`) synced from Shellui; auth via session JWT
