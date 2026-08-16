# files

ShellUI file manager — a small React app embedded in the **administration** iframe. File upload, download, list, move, and rename go through `@shellui/sdk` (`shellui.storage`); the root shell executes them against [storage-service](../storage-service) using `storage.url`. Access grants and share links still call storage-service directly with the session JWT.

## Features

- **Company files** — one system bucket per company (`company`), plus optional read-only connector mounts
- Nested folders, upload / download / rename / delete (gated by `access.can_write`)
- **Path access grants** — manage folder/file permissions (allow/deny for users or the whole company)
- **Public share links** — capability URLs with expiry and/or download limits; anonymous redeem on storage-service
- Theme synced from ShellUI (`appearance`)
- i18n (`en` / `fr`) synced from ShellUI language settings
- Auth via `SHELLUI_SETTINGS.accessToken` (Bearer JWT)

## Local setup

```bash
cp .env.example .env
# VITE_STORAGE_URL=http://localhost:8001
pnpm install
pnpm start   # http://localhost:5175
```

Also run:

| Service | Port |
|---------|------|
| ShellUI | 4000 |
| identity-service | 8000 |
| admin | 5174 |
| storage-service | 8001 |
| **files** (this app) | **5175** |

Host config (`shellui/shellui.config.ts`):

```ts
storage: {
  url: 'http://localhost:8001',
  filesUrl: 'http://localhost:5175/',
},
```

Admin sidebar → **Storage** → **Files**. ShellUI shares the session JWT with `storage.filesUrl`. Preview, permissions, share-link, move, and **storage picker** UIs open in the ShellUI modal via hash routes on the same origin (`#/viewer`, `#/permissions`, `#/share`, `#/move`, `#/select`). File explorer operations use `shellui.storage` (messages to the shell); share-link downloads are served by storage-service at `/storage/v1/share/link/{token}` (no JWT). See storage-service [access](../storage-service/docs/access.md) and [sharing](../storage-service/docs/sharing.md) docs.

Apps inside ShellUI open the picker with `shellui.selectFolders()` / `shellui.selectFiles()` — the host loads this app at `#/select`.

## Production

Production deploy (GitHub Pages) outputs the site at the **root** of the domain (**https://files.shellui.com/**). Set the host’s `storage.filesUrl` to that origin.

## Structure

| Path      | Role                                                                         |
| --------- | ---------------------------------------------------------------------------- |
| `src/`    | Vite + React source                                                          |
| `public/` | Static files copied to `dist/` (including `CNAME` for **files.shellui.com**) |

## License

MIT
