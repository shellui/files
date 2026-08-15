import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { StoragePickerDialog } from '@/components/StoragePickerDialog';
import { useShelluiAccessSession } from '@/hooks/useShelluiAccessToken';
import { parseSelectHash, sendSelectResult } from '@/lib/modalRoutes';

export function StoragePickerPage() {
  const { t } = useTranslation();
  const { token, sessionExpired } = useShelluiAccessSession();
  const [route, setRoute] = useState(() => parseSelectHash());
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseSelectHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const handleCancel = useCallback(() => {
    if (route?.requestId) {
      sendSelectResult({ id: route.requestId, cancelled: true });
    }
  }, [route?.requestId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCancel]);

  if (!route) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
        {t('pickerMissingParams')}
      </div>
    );
  }

  if (sessionExpired || authFailed) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center p-6 text-sm text-destructive">
        {t('sessionExpired')}
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('waitingSession')}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0">
      <StoragePickerDialog
        route={route}
        onAuthError={() => setAuthFailed(true)}
      />
    </div>
  );
}
