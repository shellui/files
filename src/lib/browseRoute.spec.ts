import { describe, expect, it, vi } from 'vitest';

vi.mock('@shellui/sdk', () => ({
  shellui: {
    storage: {
      from: () => ({
        list: async () => ({ data: [] }),
        createFolder: async () => ({ data: {} }),
      }),
    },
  },
}));

import {
  buildBrowsePath,
  isBrowseFolderId,
  parseBrowseRest,
  parseLegacyBrowseSearch,
} from '@/lib/browseRoute';

describe('isBrowseFolderId', () => {
  it('accepts UUID folder ids', () => {
    expect(isBrowseFolderId('2c7e1f3a-9b4d-4e8a-a1c0-0d5e6f7a8b9c')).toBe(true);
    expect(isBrowseFolderId('company')).toBe(false);
  });
});

describe('buildBrowsePath', () => {
  it('encodes bucket and optional folder id', () => {
    expect(buildBrowsePath('company')).toBe('/company');
    expect(buildBrowsePath('company', '2c7e1f3a-9b4d-4e8a-a1c0-0d5e6f7a8b9c')).toBe(
      '/company/2c7e1f3a-9b4d-4e8a-a1c0-0d5e6f7a8b9c',
    );
  });
});

describe('parseBrowseRest', () => {
  it('treats a UUID as folder id and other segments as legacy path', () => {
    expect(parseBrowseRest('2c7e1f3a-9b4d-4e8a-a1c0-0d5e6f7a8b9c')).toEqual({
      folderId: '2c7e1f3a-9b4d-4e8a-a1c0-0d5e6f7a8b9c',
      legacyPath: null,
    });
    expect(parseBrowseRest('invoices/2024')).toEqual({
      folderId: null,
      legacyPath: 'invoices/2024',
    });
  });
});

describe('parseLegacyBrowseSearch', () => {
  it('reads bucket and path query params', () => {
    expect(parseLegacyBrowseSearch('?bucket=company&path=/docs/')).toEqual({
      bucket: 'company',
      path: 'docs',
    });
    expect(parseLegacyBrowseSearch('')).toBeNull();
  });
});
