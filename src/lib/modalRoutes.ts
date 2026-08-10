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

export type PermissionsRoute = {
  bucket: string;
  path: string;
  resourceType: 'folder' | 'object';
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
  const objectPath = params.get('path')?.trim() || '';
  const resourceType = params.get('type') === 'folder' ? 'folder' : 'object';
  if (!bucket || !objectPath) return null;
  return { bucket, path: objectPath, resourceType };
}

export function isPermissionsHash(hash = window.location.hash): boolean {
  return parseHashPath(hash).path === '/permissions';
}

export function buildPermissionsModalUrl(
  bucket: string,
  path: string,
  resourceType: 'folder' | 'object',
): string {
  const params = new URLSearchParams({
    bucket,
    path,
    type: resourceType,
  });
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
};

export function parseMoveHash(hash = window.location.hash): MoveRoute | null {
  const { path, search } = parseHashPath(hash);
  if (path !== '/move') return null;
  const params = new URLSearchParams(search);
  const bucket = params.get('bucket')?.trim() || '';
  const objectPath = params.get('path')?.trim() || '';
  if (!bucket || !objectPath) return null;
  return { bucket, path: objectPath };
}

export function isMoveHash(hash = window.location.hash): boolean {
  return parseHashPath(hash).path === '/move';
}

export function buildMoveModalUrl(bucket: string, path: string): string {
  const params = new URLSearchParams({ bucket, path });
  return `${appBaseUrl()}/#/move?${params.toString()}`;
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
