import { useEffect, useState } from 'react';
import shellui, { addMessageListener } from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';

function tokenFromSettings(settings: Settings | null | undefined): string | null {
  return settings?.accessToken ?? null;
}

/** JWT from parent ShellUI settings (`Authorization: Bearer`). */
export function useShelluiAccessToken(): string | null {
  const [token, setToken] = useState<string | null>(() =>
    tokenFromSettings(shellui.initialSettings),
  );

  useEffect(() => {
    const apply = (message: { payload?: unknown }) => {
      const settings = (message.payload as { settings?: Settings } | undefined)?.settings;
      setToken(tokenFromSettings(settings));
    };
    const offSettings = addMessageListener('SHELLUI_SETTINGS', apply);
    const offUpdated = addMessageListener('SHELLUI_SETTINGS_UPDATED', apply);
    return () => {
      offSettings();
      offUpdated();
    };
  }, []);

  return token;
}
