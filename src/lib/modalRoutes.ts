/** Shared helpers for ShellUI-centered modal hash routes. */

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
  const paths = params.getAll('path').map((value) => value.trim()).filter(Boolean);
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

export function buildPermissionsModalUrl(
  bucket: string,
  items: PermissionsRouteItem[],
): string {
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

/** Send picker result to ShellUI root. Does not close the generic URL modal. */
export function sendSelectResult(payload: SelectResultPayload): void {
  if (typeof window === 'undefined') return;
  const message = { type: 'SHELLUI_SELECT_STORAGE_RESULT', payload };
  if (window.parent !== window) {
    window.parent.postMessage(message, '*');
    return;
  }
  window.postMessage(message, '*');
}

/** Close the ShellUI modal, or clear the hash when running standalone. */
export function closeAppModal(): void {
  if (typeof window === 'undefined') return;
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'SHELLUI_CLOSE_MODAL', payload: {} }, '*');
    return;
  }
  window.location.hash = '';
}

/** Close the ShellUI drawer, or clear the hash when running standalone. */
export function closeAppDrawer(): void {
  if (typeof window === 'undefined') return;
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'SHELLUI_CLOSE_DRAWER', payload: {} }, '*');
    return;
  }
  window.location.hash = '';
}
