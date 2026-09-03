export type ViewerRoute = {
  bucket: string;
  path: string;
};

/** Parse `#/viewer?bucket=…&path=…` from the current location hash. */
export function parseViewerHash(hash = window.location.hash): ViewerRoute | null {
  const raw = hash.replace(/^#/, '');
  if (!raw.startsWith('/viewer')) return null;
  const q = raw.indexOf('?');
  const search = q >= 0 ? raw.slice(q + 1) : '';
  const params = new URLSearchParams(search);
  const bucket = params.get('bucket')?.trim() || '';
  const path = params.get('path')?.trim() || '';
  if (!bucket || !path) return null;
  return { bucket, path };
}

export function isViewerHash(hash = window.location.hash): boolean {
  return hash.replace(/^#/, '').startsWith('/viewer');
}

/** Absolute URL that Shellui can open in its centered modal. */
export function buildViewerModalUrl(bucket: string, path: string): string {
  const base =
    `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '') ||
    window.location.origin;
  const params = new URLSearchParams({ bucket, path });
  return `${base}/#/viewer?${params.toString()}`;
}

export function setViewerHash(bucket: string, path: string): void {
  const params = new URLSearchParams({ bucket, path });
  const next = `#/viewer?${params.toString()}`;
  if (window.location.hash === next) return;
  window.location.hash = next;
}
