import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import shellui from '@shellui/sdk';
import type { Settings } from '@shellui/sdk';
import i18n from '@/i18n';

const LangContext = createContext('en');

export function getLangFromSettings(settings: Settings | null | undefined) {
  const code = settings?.language?.code;
  return code === 'fr' || code === 'en' ? code : 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<string>(
    () => getLangFromSettings(shellui.initialSettings) || i18n.language || 'en',
  );

  useEffect(() => {
    const applyLang = (newLang: string) => {
      if (newLang !== i18n.language) void i18n.changeLanguage(newLang);
      setLang(newLang);
    };

    const handleSettings = (message: { payload?: unknown }) => {
      const payload = message.payload as { settings?: Settings } | undefined;
      const settings = payload?.settings;
      if (settings) applyLang(getLangFromSettings(settings));
    };

    applyLang(getLangFromSettings(shellui.initialSettings) || i18n.language || 'en');

    const cleanupUpdated = shellui.addMessageListener('SHELLUI_SETTINGS_UPDATED', handleSettings);
    const cleanupSettings = shellui.addMessageListener('SHELLUI_SETTINGS', handleSettings);

    return () => {
      cleanupUpdated();
      cleanupSettings();
    };
  }, []);

  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext) ?? 'en';
}
