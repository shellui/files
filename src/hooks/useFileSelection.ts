import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fileItemKey,
  itemsByKey,
  keysInRange,
  selectableKeys,
} from '@/lib/fileSelection';
import type { StorageListItem } from '@/lib/storageApi';

export type FileSelectionMode = 'none' | 'single' | 'multiple';

export type FileSelectionEvent = {
  /** Cmd/Ctrl — toggle this row without clearing others (multiple mode). */
  additive?: boolean;
  /** Shift — select the range from the last anchor row. */
  range?: boolean;
};

type UseFileSelectionOptions = {
  items: StorageListItem[];
  /** Reset selection when the listing identity changes (bucket + prefix). */
  listingKey: string;
  mode?: FileSelectionMode;
};

/**
 * Multi-select state for a file listing. Shared by the manager and a future
 * file-picker modal (`mode: 'single' | 'multiple'`).
 */
export function useFileSelection({
  items,
  listingKey,
  mode = 'multiple',
}: UseFileSelectionOptions) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const anchorKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedKeys(new Set());
    anchorKeyRef.current = null;
  }, [listingKey]);

  useEffect(() => {
    const valid = new Set(selectableKeys(items));
    setSelectedKeys((current) => {
      let changed = false;
      const next = new Set<string>();
      for (const key of current) {
        if (valid.has(key)) next.add(key);
        else changed = true;
      }
      if (anchorKeyRef.current && !valid.has(anchorKeyRef.current)) {
        anchorKeyRef.current = null;
      }
      return changed ? next : current;
    });
  }, [items]);

  const selectedItems = useMemo(
    () => itemsByKey(items, selectedKeys),
    [items, selectedKeys],
  );

  const selectedCount = selectedKeys.size;
  const allSelected = items.length > 0 && selectedCount === items.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const isSelected = useCallback(
    (item: StorageListItem) => selectedKeys.has(fileItemKey(item)),
    [selectedKeys],
  );

  const clear = useCallback(() => {
    setSelectedKeys(new Set());
    anchorKeyRef.current = null;
  }, []);

  const selectAll = useCallback(() => {
    if (mode === 'none' || items.length === 0) return;
    if (mode === 'single') {
      const last = items[items.length - 1];
      const key = fileItemKey(last);
      setSelectedKeys(new Set([key]));
      anchorKeyRef.current = key;
      return;
    }
    const keys = selectableKeys(items);
    setSelectedKeys(new Set(keys));
    anchorKeyRef.current = keys[keys.length - 1] ?? null;
  }, [items, mode]);

  const select = useCallback(
    (item: StorageListItem, event: FileSelectionEvent = {}) => {
      if (mode === 'none') return;
      const key = fileItemKey(item);

      if (mode === 'single') {
        setSelectedKeys(new Set([key]));
        anchorKeyRef.current = key;
        return;
      }

      if (event.range && anchorKeyRef.current) {
        const range = keysInRange(items, anchorKeyRef.current, key);
        if (event.additive) {
          setSelectedKeys((current) => {
            const next = new Set(current);
            for (const k of range) next.add(k);
            return next;
          });
        } else {
          setSelectedKeys(new Set(range));
        }
        return;
      }

      if (event.additive) {
        setSelectedKeys((current) => {
          const next = new Set(current);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        anchorKeyRef.current = key;
        return;
      }

      setSelectedKeys(new Set([key]));
      anchorKeyRef.current = key;
    },
    [items, mode],
  );

  const toggle = useCallback(
    (item: StorageListItem) => {
      select(item, { additive: true });
    },
    [select],
  );

  return {
    mode,
    selectedKeys,
    selectedItems,
    selectedCount,
    allSelected,
    someSelected,
    isSelected,
    select,
    toggle,
    selectAll,
    clear,
  };
}

export type FileSelection = ReturnType<typeof useFileSelection>;
