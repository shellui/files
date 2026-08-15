import { joinPath } from '@/lib/format';
import type { StorageListItem } from '@/lib/storageApi';
import type { DragItemKind, DragItemPayload } from '@/lib/dnd';

/** Stable key for a listing row (unique within a prefix). */
export function fileItemKey(item: Pick<StorageListItem, 'id' | 'name'>): string {
  return `${item.id == null ? 'folder' : 'file'}:${item.name}`;
}

export function isFolderItem(item: Pick<StorageListItem, 'id'>): boolean {
  return item.id == null;
}

export function itemKind(item: Pick<StorageListItem, 'id'>): DragItemKind {
  return item.id == null ? 'folder' : 'file';
}

export function toDragPayload(
  item: Pick<StorageListItem, 'id' | 'name'>,
  prefix: string,
): DragItemPayload {
  return {
    path: joinPath(prefix, item.name),
    name: item.name,
    parentPrefix: prefix,
    kind: itemKind(item),
  };
}

export function itemsByKey(
  items: StorageListItem[],
  keys: ReadonlySet<string>,
): StorageListItem[] {
  if (keys.size === 0) return [];
  return items.filter((item) => keys.has(fileItemKey(item)));
}

/** Inclusive range of keys between two rows, following `items` order. */
export function keysInRange(
  items: StorageListItem[],
  fromKey: string,
  toKey: string,
): string[] {
  const from = items.findIndex((item) => fileItemKey(item) === fromKey);
  const to = items.findIndex((item) => fileItemKey(item) === toKey);
  if (from < 0 && to < 0) return [];
  if (from < 0) return [toKey];
  if (to < 0) return [fromKey];
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  return items.slice(start, end + 1).map(fileItemKey);
}

export function selectableKeys(items: StorageListItem[]): string[] {
  return items.map(fileItemKey);
}
