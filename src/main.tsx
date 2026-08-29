import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { shellui } from '@shellui/sdk';
import { LangProvider, getLangFromSettings } from '@/contexts/LangContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { getAppearanceFromSettings, applyThemeToDocument } from '@/lib/theme';
import { isEmbeddedInShell } from '@/lib/embed';
import { StandaloneNotice } from '@/components/StandaloneNotice';
import { App } from '@/App';
import i18n, { i18nInit } from '@/i18n';
import '@/index.css';

async function bootstrap() {
  await i18nInit;

  if (!isEmbeddedInShell()) {
    await i18n.changeLanguage(i18n.language || 'en');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <StandaloneNotice />
      </StrictMode>,
    );
    return;
  }

  await shellui.init();
  const initialLang = getLangFromSettings(shellui.initialSettings) || i18n.language || 'en';
  await i18n.changeLanguage(initialLang);
  const initialTheme = getAppearanceFromSettings(shellui.initialSettings);
  applyThemeToDocument(initialTheme);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <ThemeProvider initialAppearance={initialTheme}>
          <LangProvider>
            <App />
          </LangProvider>
        </ThemeProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

void bootstrap();
