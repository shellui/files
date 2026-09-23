import { useCallback, useEffect, useState } from 'react';
import type { StorageListItem } from '@/lib/storageApi';

type UseListKeyboardNavOptions = {
  items: StorageListItem[];
  listingKey: string;
  enabled?: boolean;
  onOpen: (item: StorageListItem) => void;
  onDelete?: (item: StorageListItem) => void;
  onRename?: (item: StorageListItem) => void;
  onGoUp?: () => void;
  selection: {
    isSelected: (item: StorageListItem) => boolean;
    select: (item: StorageListItem, event?: { additive?: boolean; range?: boolean }) => void;
    clear: () => void;
    selectedItems: StorageListItem[];
  };
};

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
}

/**
 * Arrow-key roving focus, Enter to open, Delete on selection.
 */
export function useListKeyboardNav({
  items,
  listingKey,
  enabled = true,
  onOpen,
  onDelete,
  onRename,
  onGoUp,
  selection,
}: UseListKeyboardNavOptions) {
  const [focusIndex, setFocusIndex] = useState<number>(-1);

  useEffect(() => {
    setFocusIndex(-1);
  }, [listingKey]);

  useEffect(() => {
    if (focusIndex >= items.length) setFocusIndex(items.length > 0 ? items.length - 1 : -1);
  }, [items.length, focusIndex]);

  const moveFocus = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      setFocusIndex((current) => {
        const start = current < 0 ? (delta > 0 ? 0 : items.length - 1) : current + delta;
        const next = Math.max(0, Math.min(items.length - 1, start));
        const item = items[next];
        if (item) selection.select(item);
        return next;
      });
    },
    [items, selection],
  );

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      if (e.key === 'ArrowUp' && e.altKey && onGoUp) {
        e.preventDefault();
        onGoUp();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveFocus(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveFocus(-1);
        return;
      }
      if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < items.length) {
        e.preventDefault();
        onOpen(items[focusIndex]);
        return;
      }
      if (e.key === ' ' && focusIndex >= 0 && focusIndex < items.length) {
        e.preventDefault();
        selection.select(items[focusIndex], { additive: true });
        return;
      }
      if (e.key === 'F2' && onRename && focusIndex >= 0 && focusIndex < items.length) {
        e.preventDefault();
        onRename(items[focusIndex]);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && onDelete) {
        const targets =
          selection.selectedItems.length > 0
            ? selection.selectedItems
            : focusIndex >= 0
              ? [items[focusIndex]]
              : [];
        if (targets.length === 0) return;
        e.preventDefault();
        if (targets.length === 1) void onDelete(targets[0]);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, focusIndex, items, moveFocus, onDelete, onGoUp, onOpen, onRename, selection]);

  const focusItem = useCallback((index: number) => {
    setFocusIndex(index);
  }, []);

  return { focusIndex, focusItem, clearFocus: () => setFocusIndex(-1) };
}
