/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Browser-facing storage-service origin (local dev / docker compose). */
  readonly VITE_STORAGE_URL?: string;
  /** Browser-facing identity-service origin (local dev / docker compose). */
  readonly VITE_IDENTITY_URL?: string;
  /** Set to `true` to poll the file watcher (macOS bind mounts). */
  readonly VITE_USE_POLLING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
