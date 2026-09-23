import { isFolderItem } from '@/lib/fileSelection';
import type { StorageListItem } from '@/lib/storageApi';

export type SortField = 'name' | 'modified' | 'size' | 'type';
export type SortDirection = 'asc' | 'desc';

export type SortState = {
  field: SortField;
  direction: SortDirection;
};

function itemModifiedMs(item: StorageListItem): number {
  if (item.updated_at) return new Date(item.updated_at).getTime();
  if (item.metadata?.lastModified) return new Date(item.metadata.lastModified).getTime();
  return 0;
}

function itemSize(item: StorageListItem): number {
  if (isFolderItem(item)) return -1;
  return item.metadata?.size ?? 0;
}

function itemTypeKey(item: StorageListItem): string {
  if (isFolderItem(item)) return '\0folder';
  return (item.metadata?.mimetype ?? '').toLowerCase();
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

/** Folders always sort before files; then by the active field. */
export function sortListItems(
  items: StorageListItem[],
  { field, direction }: SortState,
): StorageListItem[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const aFolder = isFolderItem(a);
    const bFolder = isFolderItem(b);
    if (aFolder !== bFolder) return aFolder ? -1 : 1;

    let cmp = 0;
    switch (field) {
      case 'name':
        cmp = compareStrings(a.name, b.name);
        break;
      case 'modified':
        cmp = itemModifiedMs(a) - itemModifiedMs(b);
        break;
      case 'size':
        cmp = itemSize(a) - itemSize(b);
        break;
      case 'type':
        cmp = compareStrings(itemTypeKey(a), itemTypeKey(b));
        if (cmp === 0) cmp = compareStrings(a.name, b.name);
        break;
      default:
        cmp = compareStrings(a.name, b.name);
    }
    if (cmp === 0) cmp = compareStrings(a.name, b.name);
    return cmp * sign;
  });
}

export function toggleSortField(current: SortState, field: SortField): SortState {
  if (current.field === field) {
    return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  const defaultDesc = field === 'modified' || field === 'size';
  return { field, direction: defaultDesc ? 'desc' : 'asc' };
}
