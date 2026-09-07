import { describe, expect, it } from 'vitest';
import { isEmbeddedInShell } from '@/lib/embed';

describe('isEmbeddedInShell', () => {
  it('is false when this window is the top window', () => {
    expect(isEmbeddedInShell()).toBe(false);
  });
});
