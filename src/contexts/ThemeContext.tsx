import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { shellui } from '@shellui/sdk';
import { getAppearanceFromPayload, applyThemeToDocument } from '@/lib/theme';

const ThemeContext = createContext<import('@shellui/sdk').Appearance | null>(null);

function getPayloadFromMessage(message: { payload?: unknown }) {
  const payload = message?.payload;
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (p.settings != null) return payload as { settings: import('@shellui/sdk').Settings };
  if (p.appearance != null) return { settings: payload as import('@shellui/sdk').Settings };
  return null;
}

export function ThemeProvider({
  initialAppearance,
  children,
}: {
  initialAppearance?: import('@shellui/sdk').Appearance | null;
  children: ReactNode;
}) {
  const [appearance, setAppearance] = useState(
    () => initialAppearance ?? shellui.initialSettings?.appearance ?? null,
  );

  useEffect(() => {
    const apply = (next: import('@shellui/sdk').Appearance | null) => {
      applyThemeToDocument(next);
      setAppearance(next);
    };

    const handleSettings = (message: Parameters<typeof getPayloadFromMessage>[0]) => {
      const payload = getPayloadFromMessage(message);
      if (payload) apply(getAppearanceFromPayload(payload));
    };

    apply(initialAppearance ?? shellui.initialSettings?.appearance ?? null);

    const cleanupUpdated = shellui.addMessageListener('SHELLUI_SETTINGS_UPDATED', handleSettings);
    const cleanupSettings = shellui.addMessageListener('SHELLUI_SETTINGS', handleSettings);

    return () => {
      cleanupUpdated();
      cleanupSettings();
    };
  }, [initialAppearance]);

  return <ThemeContext.Provider value={appearance}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext) ?? null;
}
