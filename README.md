# Shellui Files

The file explorer for files stored in Shellui.

[![CI](https://github.com/shellui/files/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/shellui/files/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Files is a React app that browses a company's files on [storage-service](https://github.com/shellui/storage-service): folders, upload, download, move, rename, access grants and share links. It opens inside [Admin](https://github.com/shellui/admin) under Storage, and it powers the file picker apps call with `shellui.selectFiles()` and `shellui.selectFolders()`. File operations go through `@shellui/sdk`, so the app never holds a storage URL of its own.

Production runs at [files.shellui.com](https://files.shellui.com).

## Get started

You need [pnpm](https://pnpm.io/), a local [Shellui](https://github.com/shellui/shellui) shell with [Admin](https://github.com/shellui/admin), [identity-service](https://github.com/shellui/identity-service) and [storage-service](https://github.com/shellui/storage-service).

```bash
git clone https://github.com/shellui/files.git
cd files
pnpm install
pnpm start   # http://localhost:5175
```

Then add it to the shell config and open Admin, then Storage, then Files:

```ts
storage: {
  url: 'http://localhost:8001',
  filesUrl: 'http://localhost:5175/',
},
```

## Docker

Each release is published to Docker Hub as `shellui/files`: a static build on unprivileged nginx, port `8080`, health check on `/health`.

```bash
docker run -p 8080:8080 -e FRAME_ANCESTORS="https://admin.shellui.com" shellui/files:latest
```

`FRAME_ANCESTORS` lists the exact admin origins allowed to embed the app. A bare `*` is refused. The image holds no secrets and no region URLs.

## Documentation

- [Storage](https://docs.shellui.com/features/storage/) and the [storage picker](https://docs.shellui.com/features/storage-picker/) on docs.shellui.com
- [storage-service docs](https://docs.shellui.com/storage), including access grants and share links
- [Development notes](docs/development.md): ports, routes and how the explorer talks to the shell
- [CHANGELOG.md](CHANGELOG.md)

## Development

```bash
pnpm test
pnpm typecheck
pnpm format:check
pnpm build
```

## Contributing

Open an issue or a pull request against `develop`. CI runs the tests, a production build, a secret scan, a dependency audit, a link check and CodeQL. Coding agents start with [AGENTS.md](AGENTS.md).

## Shellui projects

| Project                                                         | What it does                        |
| --------------------------------------------------------------- | ----------------------------------- |
| [shellui](https://github.com/shellui/shellui)                   | The shell, CLI and SDK              |
| [admin](https://github.com/shellui/admin)                       | Administration app inside the shell |
| [files](https://github.com/shellui/files)                       | File explorer for storage-service   |
| [identity-service](https://github.com/shellui/identity-service) | Sign-in, companies and tokens       |
| [storage-service](https://github.com/shellui/storage-service)   | File storage                        |
| [hosting-service](https://github.com/shellui/hosting-service)   | Deploys and serves Shellui apps     |
| [email-service](https://github.com/shellui/email-service)       | Templates and sends email           |
| [skills](https://github.com/shellui/skills)                     | Agent Skills for coding agents      |
| [playground](https://github.com/shellui/playground)             | Live demo of the shell              |

## License

[MIT](LICENSE)
