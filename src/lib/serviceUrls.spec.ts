import { describe, expect, it } from 'vitest';
import { resolveStorageServiceUrl } from '@/lib/serviceUrls';

describe('resolveStorageServiceUrl', () => {
  it('prefers host settings over env', () => {
    expect(resolveStorageServiceUrl('http://settings.example/')).toBe('http://settings.example');
  });

  it('strips trailing slashes from settings', () => {
    expect(resolveStorageServiceUrl('http://localhost:8002///')).toBe('http://localhost:8002');
  });

  it('returns empty when settings and env are unset', () => {
    expect(resolveStorageServiceUrl(undefined)).toBe('');
    expect(resolveStorageServiceUrl('')).toBe('');
  });
});
