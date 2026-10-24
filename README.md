# files

Shellui file manager — a small React app embedded in the **administration** iframe. File upload, download, list, move, and rename go through `@shellui/sdk` (`shellui.storage`); the root shell executes them against [storage-service](../storage-service) using `storage.url`. Access grants and share links still call storage-service directly with the session JWT.

**Compatibility:** Files 0.2.3 requires identity-service 0.9.0 and Shellui 0.7.0-alpha.1 (`@shellui/sdk` pinned exactly).

## Features

- **Company files** — one system bucket per company (`company`), plus optional read-only connector mounts
- Nested folders, upload / download / rename / delete (gated by `access.can_write`)
- **Path access grants** — manage folder/file permissions (allow/deny for users or the whole company)
- **Public share links** — capability URLs with expiry and/or download limits; anonymous redeem on storage-service
- Theme synced from Shellui (`appearance`)
- i18n (`en` / `fr`) synced from Shellui language settings
- Auth via `SHELLUI_SETTINGS.accessToken` (Bearer JWT)

## Local setup

```bash
pnpm install
pnpm start   # http://localhost:5175
```

Storage-service origin is **not** set via env. After `shellui.init()`, this app reads `storage.url` from SDK settings (host `storage` in `shellui.config.ts`).

Also run:

| Service              | Port     |
| -------------------- | -------- |
| Shellui              | 4000     |
| identity-service     | 8000     |
| admin                | 5174     |
| storage-service      | 8001     |
| **files** (this app) | **5175** |

Host config (`shellui/shellui.config.ts`):

```ts
storage: {
  url: 'http://localhost:8001',
  filesUrl: 'http://localhost:5175/',
},
```

Admin sidebar → **Storage** → **Files**. Shellui shares the session JWT with `storage.filesUrl`. The explorer syncs the current location to `/{bucket}` or `/{bucket}/{folderId}` (stable folder UUID, mirrored on the Admin chrome URL) so refresh survives renames. Preview, permissions, share-link, move, and **storage picker** UIs open in the Shellui modal via hash routes on the same origin (`#/viewer`, `#/permissions`, `#/share`, `#/move`, `#/select`). File explorer operations use `shellui.storage` (messages to the shell); share-link downloads are served by storage-service at `/storage/v1/share/link/{token}` (no JWT). See storage-service [access](../storage-service/docs/access.md) and [sharing](../storage-service/docs/sharing.md) docs.

Apps inside Shellui open the picker with `shellui.selectFolders()` / `shellui.selectFiles()` — the host loads this app at `#/select`.

## Production

Production deploy (GitHub Pages) outputs the site at the **root** of the domain (**https://files.shellui.com/**). Set the host’s `storage.filesUrl` to that origin.

## Docker image

Each published release is pushed to Docker Hub as `shellui/files` (tags `X.Y.Z`, `X.Y`, and `latest` for the highest stable release only). The image is multi-arch (amd64 and arm64), serves the static build with unprivileged nginx on port `8080`, and has a built-in healthcheck on `/health`.

```bash
docker run -p 8080:8080 -e FRAME_ANCESTORS="https://admin.shellui.com" shellui/files:latest
```

The image holds no secrets and no region-specific URLs. Identity, email, storage and hosting URLs come from the host shell config at runtime, so the same image works in every region.

| Variable          | Required          | Description                                                                                                                                                                                                                                                               |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FRAME_ANCESTORS` | Yes in production | Space-separated exact origins allowed to embed the app (the admin origins that open the file manager). Sets the `frame-ancestors` CSP header. Each entry must be `'self'` or an `http(s)` origin. A bare `*` is refused. When unset, only same-origin framing is allowed. |

Releases are published by `.github/workflows/publish.yml`. It needs the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository secrets (a Read & Write token for the `shellui` namespace). A manual run only moves `latest` when it publishes the highest stable tag.

## Tests

```bash
pnpm test
pnpm typecheck
pnpm format:check
```

Pull requests (and pushes to `develop` / `main`) run the same checks plus production build, secret scan, dependency audit, and CodeQL. GitHub Pages deploy still runs only after merge to `main`. Require those CI jobs in branch protection before merging.

## Structure

| Path      | Role                                                                         |
| --------- | ---------------------------------------------------------------------------- |
| `src/`    | Vite + React source                                                          |
| `public/` | Static files copied to `dist/` (including `CNAME` for **files.shellui.com**) |

## License

MIT
