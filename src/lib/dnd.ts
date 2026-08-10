/** Internal MIME type for dragging items between folders in the file manager. */
export const DND_FILE_MIME = 'application/x-shellui-file';

export type DragItemKind = 'file' | 'folder';

export type DragItemPayload = {
  path: string;
  name: string;
  parentPrefix: string;
  kind: DragItemKind;
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

export function readDragItemPayload(dt: DataTransfer): DragItemPayload | null {
  const raw = dt.getData(DND_FILE_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DragItemPayload>;
    if (!parsed?.path || !parsed?.name) return null;
    return {
      path: parsed.path,
      name: parsed.name,
      parentPrefix: parsed.parentPrefix || '',
      kind: parsed.kind === 'folder' ? 'folder' : 'file',
    };
  } catch {
    return null;
  }
}

/** @deprecated Use readDragItemPayload */
export const readDragFilePayload = readDragItemPayload;

export function dropTargetKey(
  kind: 'folder' | 'crumb' | 'current',
  path: string,
): string {
  return `${kind}:${path}`;
}
