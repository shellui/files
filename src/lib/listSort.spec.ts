import { describe, expect, it } from 'vitest';
import { sortListItems, toggleSortField, type SortState } from '@/lib/listSort';
import type { StorageListItem } from '@/lib/storageApi';

function file(name: string, extra: Partial<StorageListItem> = {}): StorageListItem {
  return { name, id: `id-${name}`, metadata: { size: 100 }, ...extra };
}

function folder(name: string): StorageListItem {
  return { name, id: null, metadata: {} };
}

describe('sortListItems', () => {
  it('keeps folders before files when sorting by name', () => {
    const items = [file('b.txt'), folder('a'), file('a.txt')];
    const sorted = sortListItems(items, { field: 'name', direction: 'asc' });
    expect(sorted.map((i) => i.name)).toEqual(['a', 'a.txt', 'b.txt']);
  });

  it('sorts by name descending', () => {
    const items = [file('a'), file('c'), file('b')];
    const sorted = sortListItems(items, { field: 'name', direction: 'desc' });
    expect(sorted.map((i) => i.name)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by modified time', () => {
    const items = [
      file('old', { updated_at: '2020-01-01T00:00:00Z' }),
      file('new', { updated_at: '2024-06-01T00:00:00Z' }),
    ];
    const sorted = sortListItems(items, { field: 'modified', direction: 'desc' });
    expect(sorted[0].name).toBe('new');
  });
});

describe('toggleSortField', () => {
  it('flips direction on same field', () => {
    const state: SortState = { field: 'name', direction: 'asc' };
    expect(toggleSortField(state, 'name')).toEqual({ field: 'name', direction: 'desc' });
  });

  it('defaults modified to desc', () => {
    expect(toggleSortField({ field: 'name', direction: 'asc' }, 'modified')).toEqual({
      field: 'modified',
      direction: 'desc',
    });
  });
});
