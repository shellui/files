import { useCallback, useEffect, useState } from 'react';

const IDLE_MS = 1200;

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
}

/**
 * Finder-style type-ahead: type letters to filter the current listing by name prefix.
 */
export function useTypeaheadFind(enabled = true) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!query) return;
    const timer = window.setTimeout(() => setQuery(''), IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (query) {
          e.preventDefault();
          setQuery('');
        }
        return;
      }

      if (e.key === 'Backspace') {
        if (query) {
          e.preventDefault();
          setQuery((q) => q.slice(0, -1));
        }
        return;
      }

      if (e.key.length === 1 && /[\w\s.-]/i.test(e.key)) {
        e.preventDefault();
        setQuery((q) => q + e.key);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, query]);

  const clear = useCallback(() => setQuery(''), []);

  return { query, clear };
}

export function filterItemsByPrefix<T extends { name: string }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => item.name.toLowerCase().includes(q));
}
