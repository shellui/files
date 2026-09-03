import { describe, expect, it } from 'vitest';
import { accessLabelKey, accessRowLabel } from '@/lib/accessLabel';

describe('accessLabelKey', () => {
  it('maps known audiences', () => {
    expect(accessLabelKey('company')).toBe('accessCompany');
    expect(accessLabelKey('restricted')).toBe('accessRestricted');
    expect(accessLabelKey('mystery')).toBe('accessUnknown');
  });
});

describe('accessRowLabel', () => {
  const t = (key: string, opts?: Record<string, unknown>) =>
    opts?.count != null ? `${key}:${opts.count}` : key;

  it('uses restricted user count when present', () => {
    expect(
      accessRowLabel(
        { audience: 'restricted', readers: '', writers: '', allowed_user_ids: ['1', '2'] },
        undefined,
        t,
      ),
    ).toBe('accessRestrictedUsers:2');
  });

  it('falls back to audience key', () => {
    expect(accessRowLabel(undefined, 'owner', t)).toBe('accessOwner');
  });
});
