import { useEffect, useState } from 'react';
import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';
import { getJwtExpiryUnix, isJwtExpired } from '@/lib/jwt';

function tokenFromSettings(settings: Settings | null | undefined): string | null {
  return settings?.accessToken ?? null;
}

export type ShelluiAccessSession = {
  /** Non-expired JWT, or null when missing/expired. */
  token: string | null;
  /** True when a JWT string is present but past its `exp` claim. */
  sessionExpired: boolean;
};

/**
 * JWT from parent ShellUI settings (`Authorization: Bearer`).
 * Treats expired tokens as unauthenticated and flips `sessionExpired` when `exp` elapses
 * even if the parent has not pushed a settings update yet.
 */
export function useShelluiAccessSession(): ShelluiAccessSession {
  const [rawToken, setRawToken] = useState<string | null>(() =>
    tokenFromSettings(shellui.initialSettings),
  );
  const [, setExpiryTick] = useState(0);

  useEffect(() => {
    setRawToken(tokenFromSettings(shellui.initialSettings));

    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      setRawToken(tokenFromSettings(settings));
    };
    const offSettings = addMessageListener('SHELLUI_SETTINGS', apply);
    const offUpdated = addMessageListener('SHELLUI_SETTINGS_UPDATED', apply);
    return () => {
      offSettings();
      offUpdated();
    };
  }, []);

  useEffect(() => {
    if (!rawToken) return;
    const expUnix = getJwtExpiryUnix(rawToken);
    if (expUnix == null) return;
    const delayMs = expUnix * 1000 - Date.now();
    if (delayMs <= 0) {
      setExpiryTick((n) => n + 1);
      return;
    }
    const id = window.setTimeout(() => setExpiryTick((n) => n + 1), delayMs + 50);
    return () => window.clearTimeout(id);
  }, [rawToken]);

  const sessionExpired = Boolean(rawToken && isJwtExpired(rawToken));
  return {
    token: sessionExpired ? null : rawToken,
    sessionExpired,
  };
}

/** Valid JWT only (null when missing or expired). Prefer `useShelluiAccessSession` for expiry UX. */
export function useShelluiAccessToken(): string | null {
  return useShelluiAccessSession().token;
}
