import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MoveFileDialog, moveTargetFromPath } from '@/components/MoveFileDialog';
import { useShelluiAccessSession } from '@/hooks/useShelluiAccessToken';
import { closeAppModal, parseMoveHash } from '@/lib/modalRoutes';

export function MoveFilePage() {
  const { t } = useTranslation();
  const { token, sessionExpired } = useShelluiAccessSession();
  const [route, setRoute] = useState(() => parseMoveHash());
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseMoveHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const target = useMemo(() => {
    if (!route) return null;
    return moveTargetFromPath(route.bucket, route.path, route.resourceType);
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
        {t('moveFileMissingParams')}
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
    <MoveFileDialog
      token={token}
      target={target}
      rootLabel={route.bucket}
      onClose={handleClose}
      onAuthError={() => setAuthFailed(true)}
      variant="embedded"
    />
  );
}
