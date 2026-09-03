import { describe, expect, it } from 'vitest';
import { decodeJwtPayload, getJwtSessionClaims, isJwtExpired } from '@/lib/jwt';

function unsignedJwt(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `hdr.${b64}.sig`;
}

describe('decodeJwtPayload', () => {
  it('returns null for malformed tokens', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });

  it('decodes the payload', () => {
    const payload = decodeJwtPayload(unsignedJwt({ user_id: 9, company_id: 2 }));
    expect(payload).toMatchObject({ user_id: 9, company_id: 2 });
  });
});

describe('getJwtSessionClaims', () => {
  it('reads numeric ids and metadata flags', () => {
    const claims = getJwtSessionClaims(
      unsignedJwt({
        user_id: 3,
        company_id: '12',
        user_metadata: { is_staff: true, is_company_owner: true },
      }),
    );
    expect(claims).toEqual({
      userId: 3,
      companyId: 12,
      isCompanyOwner: true,
      isStaff: true,
    });
  });
});

describe('isJwtExpired', () => {
  it('treats missing exp as not expired', () => {
    expect(isJwtExpired(unsignedJwt({ user_id: 1 }), 1_000)).toBe(false);
  });

  it('applies 30s leeway', () => {
    expect(isJwtExpired(unsignedJwt({ exp: 1_020 }), 1_000)).toBe(true);
    expect(isJwtExpired(unsignedJwt({ exp: 1_031 }), 1_000)).toBe(false);
  });
});
