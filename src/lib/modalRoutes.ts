/** Shared helpers for Shellui-centered modal hash routes. */

import { postShellMessage, resolveParentTargetOrigin } from '@shellui/sdk';

/**
 * Post to the Shellui parent at its own origin. When this frame cannot name the parent
 * origin nothing is sent (never `*`), and the console says so.
 */
function postToShell(message: { type: string; payload?: unknown }): void {
  if (typeof window === 'undefined') return;
  if (window.parent !== window) {
    const origin = resolveParentTargetOrigin();
    if (!origin || origin === '*' || origin === 'null') {
      console.warn(`[files] Parent origin is unknown, so ${message.type} was not sent.`);
      return;
    }
  }
  postShellMessage(message);
}

function appBaseUrl(): string {
  return (
    `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '') ||
    window.location.origin
  );
}

function parseHashPath(hash = window.location.hash): { path: string; search: string } {
  const raw = hash.replace(/^#/, '');
  const q = raw.indexOf('?');
  return {
    path: q >= 0 ? raw.slice(0, q) : raw,
    search: q >= 0 ? raw.slice(q + 1) : '',
  };
}

export function fileNameFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

export type PermissionsRouteItem = {
  path: string;
  resourceType: 'folder' | 'object';
};

export type PermissionsRoute = {
  bucket: string;
  items: PermissionsRouteItem[];
};

export type ShareRoute = {
  bucket: string;
  path: string;
};

export function parsePermissionsHash(hash = window.location.hash): PermissionsRoute | null {
  const { path, search } = parseHashPath(hash);
  if (path !== '/permissions') return null;
  const params = new URLSearchParams(search);
  const bucket = params.get('bucket')?.trim() || '';
  const paths = params
    .getAll('path')
    .map((value) => value.trim())
    .filter(Boolean);
  const types = params.getAll('type');
  if (!bucket || paths.length === 0) return null;
  const items: PermissionsRouteItem[] = paths.map((objectPath, index) => ({
    path: objectPath,
    resourceType: types[index] === 'folder' ? 'folder' : 'object',
  }));
  return { bucket, items };
}

export function isPermissionsHash(hash = window.location.hash): boolean {
  return parseHashPath(hash).path === '/permissions';
}

export function buildPermissionsModalUrl(bucket: string, items: PermissionsRouteItem[]): string {
  const params = new URLSearchParams({ bucket });
  for (const item of items) {
    params.append('path', item.path);
    params.append('type', item.resourceType);
  }
  return `${appBaseUrl()}/#/permissions?${params.toString()}`;
}

export function parseShareHash(hash = window.location.hash): ShareRoute | null {
  const { path, search } = parseHashPath(hash);
  if (path !== '/share') return null;
  const params = new URLSearchParams(search);
  const bucket = params.get('bucket')?.trim() || '';
  const objectPath = params.get('path')?.trim() || '';
  if (!bucket || !objectPath) return null;
  return { bucket, path: objectPath };
}

export function isShareHash(hash = window.location.hash): boolean {
  return parseHashPath(hash).path === '/share';
}

export function buildShareModalUrl(bucket: string, path: string): string {
  const params = new URLSearchParams({ bucket, path });
  return `${appBaseUrl()}/#/share?${params.toString()}`;
}

export type MoveRoute = {
  bucket: string;
  path: string;
  resourceType: 'folder' | 'object';
};

export function parseMoveHash(hash = window.location.hash): MoveRoute | null {
  const { path, search } = parseHashPath(hash);
  if (path !== '/move') return null;
  const params = new URLSearchParams(search);
  const bucket = params.get('bucket')?.trim() || '';
  const objectPath = params.get('path')?.trim() || '';
  const resourceType = params.get('type') === 'folder' ? 'folder' : 'object';
  if (!bucket || !objectPath) return null;
  return { bucket, path: objectPath, resourceType };
}

export function isMoveHash(hash = window.location.hash): boolean {
  return parseHashPath(hash).path === '/move';
}

export function buildMoveModalUrl(
  bucket: string,
  path: string,
  resourceType: 'folder' | 'object' = 'object',
): string {
  const params = new URLSearchParams({
    bucket,
    path,
    type: resourceType,
  });
  return `${appBaseUrl()}/#/move?${params.toString()}`;
}

export type SelectRoute = {
  requestId: string;
  mode: 'folders' | 'files' | 'any';
  multiple: boolean;
};

export function parseSelectHash(hash = window.location.hash): SelectRoute | null {
  const { path, search } = parseHashPath(hash);
  if (path !== '/select') return null;
  const params = new URLSearchParams(search);
  const requestId = params.get('requestId')?.trim() || '';
  if (!requestId) return null;
  const modeParam = params.get('mode');
  const mode = modeParam === 'files' || modeParam === 'any' ? modeParam : 'folders';
  return {
    requestId,
    mode,
    multiple: params.get('multiple') === '1' || params.get('multiple') === 'true',
  };
}

export function isSelectHash(hash = window.location.hash): boolean {
  return parseHashPath(hash).path === '/select';
}

export type SelectResultPayload = {
  id: string;
  items?: Array<{
    id: string;
    bucket: string;
    path: string;
    name: string;
    type: 'file' | 'folder';
  }>;
  cancelled?: boolean;
};

/** Send picker result to Shellui root. Does not close the generic URL modal. */
export function sendSelectResult(payload: SelectResultPayload): void {
  postToShell({ type: 'SHELLUI_SELECT_STORAGE_RESULT', payload });
}

/** Close the Shellui modal, or clear the hash when running standalone. */
export function closeAppModal(): void {
  if (typeof window === 'undefined') return;
  if (window.parent !== window) {
    postToShell({ type: 'SHELLUI_CLOSE_MODAL', payload: {} });
    return;
  }
  window.location.hash = '';
}

/** Close the Shellui drawer, or clear the hash when running standalone. */
export function closeAppDrawer(): void {
  if (typeof window === 'undefined') return;
  if (window.parent !== window) {
    postToShell({ type: 'SHELLUI_CLOSE_DRAWER', payload: {} });
    return;
  }
  window.location.hash = '';
}
