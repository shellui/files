import { describe, expect, it } from 'vitest';
import { formatBytes, isValidFileName, isValidFolderName, joinPath } from '@/lib/format';

describe('formatBytes', () => {
  it('formats missing values', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytes(undefined)).toBe('—');
  });

  it('uses binary units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KiB');
  });
});

describe('joinPath', () => {
  it('strips slashes and joins segments', () => {
    expect(joinPath('/a/', 'b/', '/c')).toBe('a/b/c');
  });
});

describe('isValidFolderName', () => {
  it('rejects empty, path separators, and reserved names', () => {
    expect(isValidFolderName('  ')).toBe(false);
    expect(isValidFolderName('a/b')).toBe(false);
    expect(isValidFolderName('..')).toBe(false);
    expect(isValidFolderName('.emptyFolderPlaceholder')).toBe(false);
  });

  it('accepts a normal name', () => {
    expect(isValidFolderName('Reports')).toBe(true);
    expect(isValidFileName('notes.txt')).toBe(true);
  });
});
