/** Internal MIME type for dragging items between folders in the file manager. */
export const DND_FILE_MIME = 'application/x-shellui-file';

export type DragItemKind = 'file' | 'folder';

export type DragItemPayload = {
  path: string;
  name: string;
  parentPrefix: string;
  kind: DragItemKind;
};

export type DragItemsPayload = {
  items: DragItemPayload[];
};

/** @deprecated Use DragItemPayload */
export type DragFilePayload = DragItemPayload;

export function dragTypes(dt: DataTransfer | null | undefined): string[] {
  return dt ? Array.from(dt.types || []) : [];
}

export function isOsFileDrag(dt: DataTransfer | null | undefined): boolean {
  return dragTypes(dt).includes('Files');
}

export function isInternalFileDrag(dt: DataTransfer | null | undefined): boolean {
  return dragTypes(dt).includes(DND_FILE_MIME);
}

export function isAcceptableDrop(
  dt: DataTransfer | null | undefined,
  canWrite: boolean,
): boolean {
  if (!canWrite || !dt) return false;
  return isOsFileDrag(dt) || isInternalFileDrag(dt);
}

/** True if dest is the item itself or inside it (folder into self/descendant). */
export function isInvalidMoveDestination(
  sourcePath: string,
  kind: DragItemKind,
  destPrefix: string,
): boolean {
  if (kind !== 'folder') return false;
  if (destPrefix === sourcePath) return true;
  return destPrefix.startsWith(`${sourcePath}/`);
}

export function canMoveToPrefix(
  payload: Pick<DragItemPayload, 'path' | 'parentPrefix' | 'kind'>,
  destPrefix: string,
): boolean {
  if (payload.parentPrefix === destPrefix) return false;
  return !isInvalidMoveDestination(payload.path, payload.kind, destPrefix);
}

export function canMoveAnyToPrefix(
  payloads: Pick<DragItemPayload, 'path' | 'parentPrefix' | 'kind'>[],
  destPrefix: string,
): boolean {
  return payloads.some((payload) => canMoveToPrefix(payload, destPrefix));
}

function normalizePayload(parsed: Partial<DragItemPayload>): DragItemPayload | null {
  if (!parsed?.path || !parsed?.name) return null;
  return {
    path: parsed.path,
    name: parsed.name,
    parentPrefix: parsed.parentPrefix || '',
    kind: parsed.kind === 'folder' ? 'folder' : 'file',
  };
}

export function writeDragItemsPayload(dt: DataTransfer, items: DragItemPayload[]): void {
  const payload: DragItemsPayload = { items };
  dt.setData(DND_FILE_MIME, JSON.stringify(payload));
}

export function readDragItemsPayload(dt: DataTransfer): DragItemPayload[] {
  const raw = dt.getData(DND_FILE_MIME);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DragItemsPayload | Partial<DragItemPayload>;
    if (parsed && Array.isArray((parsed as DragItemsPayload).items)) {
      return (parsed as DragItemsPayload).items
        .map((item) => normalizePayload(item))
        .filter((item): item is DragItemPayload => item != null);
    }
    const single = normalizePayload(parsed as Partial<DragItemPayload>);
    return single ? [single] : [];
  } catch {
    return [];
  }
}

export function readDragItemPayload(dt: DataTransfer): DragItemPayload | null {
  return readDragItemsPayload(dt)[0] ?? null;
}

/** @deprecated Use readDragItemPayload */
export const readDragFilePayload = readDragItemPayload;

export function dropTargetKey(
  kind: 'folder' | 'crumb' | 'current',
  path: string,
): string {
  return `${kind}:${path}`;
}

const dragGhostId = 'shellui-files-drag-ghost';

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Custom drag image: first item name plus a count badge when moving several.
 * The ghost is positioned off-screen; the browser snapshots it on dragstart.
 */
export function setDragCountImage(
  dt: DataTransfer,
  items: Pick<DragItemPayload, 'name'>[],
): void {
  if (typeof document === 'undefined' || items.length === 0) return;
  document.getElementById(dragGhostId)?.remove();

  const ghost = document.createElement('div');
  ghost.id = dragGhostId;
  ghost.setAttribute('aria-hidden', 'true');
  const bg = cssVar('--card', '#ffffff');
  const fg = cssVar('--foreground', '#0a0a0a');
  const border = cssVar('--border', '#e5e5e5');
  const primary = cssVar('--primary', '#171717');
  const primaryFg = cssVar('--primary-foreground', '#fafafa');

  ghost.style.cssText = [
    'position:absolute',
    'top:-1000px',
    'left:0',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'max-width:16rem',
    'padding:6px 10px',
    `background:${bg}`,
    `color:${fg}`,
    `border:1px solid ${border}`,
    'border-radius:8px',
    'box-shadow:0 8px 24px rgba(0,0,0,0.18)',
    'font:600 13px/1.2 system-ui,sans-serif',
    'pointer-events:none',
    'white-space:nowrap',
    'z-index:0',
  ].join(';');

  const label = document.createElement('span');
  label.textContent = items[0]?.name || '';
  label.style.cssText = 'overflow:hidden;text-overflow:ellipsis';
  ghost.appendChild(label);

  if (items.length > 1) {
    const badge = document.createElement('span');
    badge.textContent = String(items.length);
    badge.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'min-width:1.25rem',
      'height:1.25rem',
      'padding:0 6px',
      'border-radius:999px',
      `background:${primary}`,
      `color:${primaryFg}`,
      'font-size:11px',
      'font-weight:700',
      'flex-shrink:0',
    ].join(';');
    ghost.appendChild(badge);
  }

  document.body.appendChild(ghost);
  dt.setDragImage(ghost, 16, 16);
  window.setTimeout(() => ghost.remove(), 0);
}
