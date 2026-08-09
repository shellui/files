# files

ShellUI file manager — a small React app embedded in the **administration** iframe. It talks to [storage-service](../storage-service) with the session JWT from `@shellui/sdk`.

## Features

- Bucket list, nested folders, upload / download / delete
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

Admin sidebar → **Storage** → **Files**. ShellUI shares the session JWT with `storage.filesUrl` (including `#/viewer` preview modals on the same origin).
