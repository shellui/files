/**
 * Browse location for the file manager.
 *
 * Path shape: `/{bucket}` or `/{bucket}/{folderId}` (stable folder UUID).
 * Admin → Files (`useHashRouter: false`) mirrors chrome URLs like `/storage/company/<uuid>`.
 * Hash routes (`#/viewer`, `#/move`, …) stay reserved for modal UIs.
 */

import { shellui } from '@shellui/sdk';
import { unwrapStorage } from '@/lib/shellStorage';

export type BrowseRoute = {
  bucket: string;
  /** Stable folder id, or null at bucket root. */
  folderId: string | null;
};

const FOLDER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeBrowsePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

export function isBrowseFolderId(value: string | undefined | null): boolean {
  return Boolean(value && FOLDER_ID_RE.test(value.trim()));
}

/** Build a location pathname for the current bucket / folder id. */
export function buildBrowsePath(bucket: string, folderId: string | null = null): string {
  const slug = bucket.trim();
  if (!slug) return '/';
  const base = `/${encodeURIComponent(slug)}`;
  const id = folderId?.trim() || '';
  if (!id || !isBrowseFolderId(id)) return base;
  return `${base}/${encodeURIComponent(id)}`;
}

/** Parse `/:bucket` + optional `*` rest into bucket root, folder id, or legacy path. */
export function parseBrowseRest(rest: string | undefined): {
  folderId: string | null;
  legacyPath: string | null;
} {
  const normalized = normalizeBrowsePath(rest || '');
  if (!normalized) return { folderId: null, legacyPath: null };
  if (isBrowseFolderId(normalized) && !normalized.includes('/')) {
    return { folderId: normalized, legacyPath: null };
  }
  // Single non-UUID segment or nested segments from older path-based URLs.
  return { folderId: null, legacyPath: normalized };
}

/** Legacy `?bucket=&path=` query (path form, not id). */
export function parseLegacyBrowseSearch(
  search = typeof window !== 'undefined' ? window.location.search : '',
): { bucket: string; path: string } | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const bucket = params.get('bucket')?.trim() || '';
  if (!bucket) return null;
  return {
    bucket,
    path: normalizeBrowsePath(params.get('path')?.trim() || ''),
  };
}

/**
 * Resolve a folder path to its stable id.
 * Prefers `folder_id` from a parent listing (works on read-only buckets), then `createFolder` ensure.
 */
export async function resolveFolderIdForPath(
  bucket: string,
  folderPath: string,
): Promise<string | null> {
  const path = normalizeBrowsePath(folderPath);
  if (!bucket || !path) return null;

  const parts = path.split('/').filter(Boolean);
  const name = parts[parts.length - 1]!;
  const parent = parts.slice(0, -1).join('/');

  try {
    const list = unwrapStorage(
      await shellui.storage.from(bucket).list(parent, { limit: 200 }),
    ) as Array<{ id: string | null; name: string; folder_id?: string | null }>;
    const row = list.find((item) => item.id == null && item.name === name);
    if (row?.folder_id && isBrowseFolderId(row.folder_id)) return row.folder_id;
  } catch {
    // Fall through to createFolder ensure.
  }

  try {
    const created = unwrapStorage(
      await shellui.storage.from(bucket).createFolder(path),
    ) as { path: string; id?: string };
    if (created.id && isBrowseFolderId(created.id)) return created.id;
  } catch {
    return null;
  }
  return null;
}
