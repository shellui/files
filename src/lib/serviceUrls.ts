function normalizeServiceUrl(raw: string | undefined): string {
  return raw?.trim().replace(/\/+$/, '') ?? '';
}

/** Browser-facing storage-service origin for local dev (`VITE_STORAGE_URL`). Empty in production builds. */
export function viteStorageServiceUrl(): string {
  if (!import.meta.env.DEV) return '';
  return normalizeServiceUrl(import.meta.env.VITE_STORAGE_URL);
}

/** Browser-facing identity-service origin for local dev (`VITE_IDENTITY_URL`). Empty in production builds. */
export function viteIdentityServiceUrl(): string {
  if (!import.meta.env.DEV) return '';
  return normalizeServiceUrl(import.meta.env.VITE_IDENTITY_URL);
}

/**
 * Storage origin from host shell settings, with a dev-only `VITE_STORAGE_URL` fallback.
 * Production embeds always rely on `storage.url` from the parent Shellui app.
 */
export function resolveStorageServiceUrl(settingsUrl: string | undefined): string {
  const fromSettings = normalizeServiceUrl(settingsUrl);
  if (fromSettings) return fromSettings;
  return viteStorageServiceUrl();
}
