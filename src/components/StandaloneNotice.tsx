import { useTranslation } from 'react-i18next';

export function StandaloneNotice() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="font-heading text-xl font-semibold">{t('standaloneTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('standaloneDescription')}</p>
        <p className="mt-4 text-sm text-muted-foreground">{t('standaloneStepRun')}</p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-muted/40 p-4 font-mono text-xs text-foreground">
          {t('standaloneConfigSnippet')}
        </pre>
      </div>
    </div>
  );
}
