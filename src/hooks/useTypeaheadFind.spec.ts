import { describe, expect, it } from 'vitest';
import { filterItemsByPrefix } from '@/hooks/useTypeaheadFind';

describe('filterItemsByPrefix', () => {
  it('returns all items when query is empty', () => {
    const items = [{ name: 'a' }, { name: 'b' }];
    expect(filterItemsByPrefix(items, '')).toEqual(items);
  });

  it('filters case-insensitively by substring', () => {
    const items = [{ name: 'Report.pdf' }, { name: 'notes.txt' }];
    expect(filterItemsByPrefix(items, 'report').map((i) => i.name)).toEqual(['Report.pdf']);
  });
});
