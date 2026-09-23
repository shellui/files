import { useTranslation } from 'react-i18next';

export function KeyboardHintsFooter() {
  const { t } = useTranslation();

  return (
    <footer className="hidden shrink-0 border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground sm:block sm:px-6">
      <p>{t('keyboardHints')}</p>
    </footer>
  );
}
