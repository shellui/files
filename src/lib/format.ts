export function formatBytes(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  let value = n;
  for (const unit of ['B', 'KiB', 'MiB', 'GiB', 'TiB']) {
    if (value < 1024 || unit === 'TiB') {
      return unit === 'B' ? `${value} ${unit}` : `${value.toFixed(1)} ${unit}`;
    }
    value /= 1024;
  }
  return `${n} B`;
}

export function joinPath(...parts: string[]): string {
  return parts
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

/** Marker object used so empty folders appear in prefix-based listings. */
export const FOLDER_PLACEHOLDER = '.emptyFolderPlaceholder';

export function isValidFolderName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (trimmed.includes('/') || trimmed.includes('\\')) return false;
  if (trimmed === '.' || trimmed === '..') return false;
  if (trimmed === FOLDER_PLACEHOLDER) return false;
  return true;
}
