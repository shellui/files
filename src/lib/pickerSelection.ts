import { joinPath } from '@/lib/format';
import { isFolderItem } from '@/lib/fileSelection';
import type { StorageListItem } from '@/lib/storageApi';

export type PickedStorageItem = {
  bucket: string;
  path: string;
  name: string;
  type: 'file' | 'folder';
  id: string | null;
};

export function pickedKey(item: Pick<PickedStorageItem, 'bucket' | 'type' | 'path'>): string {
  return `${item.bucket}:${item.type}:${item.path}`;
}

export function fromListItem(
  item: StorageListItem,
  bucket: string,
  prefix: string,
): PickedStorageItem {
  const folder = isFolderItem(item);
  return {
    bucket,
    path: joinPath(prefix, item.name),
    name: item.name,
    type: folder ? 'folder' : 'file',
    id: folder ? item.folder_id ?? null : item.id,
  };
}

export function currentFolderItem(
  bucket: string,
  prefix: string,
  name: string,
): PickedStorageItem {
  return {
    bucket,
    path: prefix,
    name,
    type: 'folder',
    id: null,
  };
}
