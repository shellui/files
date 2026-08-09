/** Decode JWT payload without verifying the signature (client-side UX only). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    const payload = JSON.parse(json) as unknown;
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Unix seconds when the access token expires, or null if `exp` is missing/invalid. */
export function getJwtExpiryUnix(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  return typeof exp === 'number' && Number.isFinite(exp) ? exp : null;
}

/**
 * Whether the JWT is past its `exp` claim.
 * Uses a small clock-skew leeway so we treat near-expiry as expired for UX.
 */
export function isJwtExpired(token: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const exp = getJwtExpiryUnix(token);
  if (exp == null) return false;
  return exp <= nowSeconds + 30;
}
