import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ShareLinkDialog } from '@/components/ShareLinkDialog';
import { useShelluiAccessSession } from '@/hooks/useShelluiAccessToken';
import { closeAppModal, fileNameFromPath, parseShareHash } from '@/lib/modalRoutes';

export function ShareLinkPage() {
  const { t } = useTranslation();
  const { token, sessionExpired } = useShelluiAccessSession();
  const [route, setRoute] = useState(() => parseShareHash());
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseShareHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const target = useMemo(() => {
    if (!route) return null;
    return {
      bucket: route.bucket,
      path: route.path,
      name: fileNameFromPath(route.path),
    };
  }, [route]);

  const handleClose = useCallback(() => {
    closeAppModal();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  if (!route || !target) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
        {t('shareMissingParams')}
      </div>
    );
  }

  if (sessionExpired) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center p-6 text-sm text-destructive">
        {t('sessionExpired')}
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center p-6 text-sm text-destructive">
        {authError}
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
    <ShareLinkDialog
      token={token}
      target={target}
      onClose={handleClose}
      onAuthError={setAuthError}
      variant="embedded"
    />
  );
}
