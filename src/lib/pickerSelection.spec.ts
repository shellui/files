import { describe, expect, it } from 'vitest';
import { currentFolderItem, pickedKey } from '@/lib/pickerSelection';

describe('pickedKey', () => {
  it('is unique per bucket, type, and path', () => {
    expect(pickedKey({ bucket: 'company', type: 'file', path: 'a/b.txt' })).toBe(
      'company:file:a/b.txt',
    );
  });
});

describe('currentFolderItem', () => {
  it('builds a folder pick for the current prefix', () => {
    expect(currentFolderItem('company', 'docs/q1', 'q1')).toEqual({
      bucket: 'company',
      path: 'docs/q1',
      name: 'q1',
      type: 'folder',
      id: null,
    });
  });
});
