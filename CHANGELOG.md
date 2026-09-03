# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!---
## [Unreleased] - yyyy-mm-dd

### ✨ Feature – for new features
### 🛠 Improvements – for general improvements
### 🚨 Changed – for changes in existing functionality
### ⚠️ Deprecated – for soon-to-be removed features
### 📚 Documentation – for documentation update
### 🗑 Removed – for removed features
### 🐛 Bug Fixes – for any bug fixes
### 🔒 Security – in case of vulnerabilities
### 🏗 Chore – for tidying code

See for sample https://raw.githubusercontent.com/favoloso/conventional-changelog-emoji/master/CHANGELOG.md
-->

## [0.2.1] - 2026-MM-DD

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

## [0.1.0] - 2026-08-16

### ✨ Feature

- **Company files:** browse the system company bucket plus optional read-only connector mounts; nested folders with upload, download, rename, and delete gated by `access.can_write`
- **Path access grants:** manage folder/file permissions (allow/deny for users or the whole company)
- **Public share links:** capability URLs with expiry and/or download limits; anonymous redeem on storage-service
- **Shell modal routes:** preview, permissions, share-link, move, and storage picker UIs via hash routes (`#/viewer`, `#/permissions`, `#/share`, `#/move`, `#/select`)
- **Storage picker:** host apps open folder/file selection with `shellui.selectFolders()` / `shellui.selectFiles()`
- **Theme & i18n:** appearance and language (`en` / `fr`) synced from Shellui; auth via session JWT
