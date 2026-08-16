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

## [0.1.0] - 2026-08-16

### ✨ Feature

- **Company files:** browse the system company bucket plus optional read-only connector mounts; nested folders with upload, download, rename, and delete gated by `access.can_write`
- **Path access grants:** manage folder/file permissions (allow/deny for users or the whole company)
- **Public share links:** capability URLs with expiry and/or download limits; anonymous redeem on storage-service
- **Shell modal routes:** preview, permissions, share-link, move, and storage picker UIs via hash routes (`#/viewer`, `#/permissions`, `#/share`, `#/move`, `#/select`)
- **Storage picker:** host apps open folder/file selection with `shellui.selectFolders()` / `shellui.selectFiles()`
- **Theme & i18n:** appearance and language (`en` / `fr`) synced from ShellUI; auth via session JWT
