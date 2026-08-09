import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { PermissionsDialog } from '@/components/PermissionsDialog';
import { useShelluiAccessSession } from '@/hooks/useShelluiAccessToken';
import { getJwtSessionClaims } from '@/lib/jwt';
import {
  closeAppModal,
  fileNameFromPath,
  parsePermissionsHash,
} from '@/lib/modalRoutes';

export function PermissionsPage() {
  const { t } = useTranslation();
  const { token, sessionExpired } = useShelluiAccessSession();
  const [route, setRoute] = useState(() => parsePermissionsHash());
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parsePermissionsHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const claims = useMemo(
    () => (token ? getJwtSessionClaims(token) : null),
    [token],
  );

  const target = useMemo(() => {
    if (!route) return null;
    return {
      bucket: route.bucket,
      path: route.path,
      name: fileNameFromPath(route.path),
      resourceType: route.resourceType,
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
        {t('permissionsMissingParams')}
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
    <PermissionsDialog
      token={token}
      target={target}
      companyId={claims?.companyId ?? null}
      currentUserId={claims?.userId ?? null}
      canManageDeny={Boolean(claims?.isCompanyOwner || claims?.isStaff)}
      onClose={handleClose}
      onAuthError={() => setAuthFailed(true)}
      variant="embedded"
    />
  );
}
