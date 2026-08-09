import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { FileViewer, type ViewerTarget } from '@/components/FileViewer';
import { useShelluiAccessSession } from '@/hooks/useShelluiAccessToken';
import { joinPath } from '@/lib/format';
import { closeAppModal } from '@/lib/modalRoutes';
import { isStorageAccessDenied, isStorageAuthError, listObjects } from '@/lib/storageApi';
import { parseViewerHash, setViewerHash } from '@/lib/viewerRoute';

export function ViewerPage() {
  const { t } = useTranslation();
  const { token, sessionExpired } = useShelluiAccessSession();
  const [route, setRoute] = useState(() => parseViewerHash());
  const [siblings, setSiblings] = useState<ViewerTarget[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseViewerHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const prefix = useMemo(() => {
    if (!route?.path) return '';
    const parts = route.path.split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
  }, [route?.path]);

  const fileName = useMemo(() => {
    if (!route?.path) return '';
    const parts = route.path.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }, [route?.path]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token || !route?.bucket || !route.path) {
        setSiblings([]);
        setLoadingList(false);
        if (sessionExpired) {
          setAuthFailed(true);
          setError(t('sessionExpired'));
        }
        return;
      }
      setLoadingList(true);
      setError(null);
      setAuthFailed(false);
      try {
        const items = await listObjects(token, route.bucket, prefix);
        if (cancelled) return;
        const next = items
          .filter((item) => item.id != null)
          .map((item) => ({
            item,
            path: joinPath(prefix, item.name),
          }));
        setSiblings(next);
      } catch (err) {
        if (!cancelled) {
          setSiblings([]);
          if (isStorageAuthError(err) || sessionExpired) {
            setAuthFailed(true);
            setError(t('sessionExpired'));
          } else if (isStorageAccessDenied(err)) {
            setError(t('accessDenied'));
          } else {
            setError(err instanceof Error ? err.message : t('error'));
          }
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, sessionExpired, route?.bucket, route?.path, prefix, t]);

  const target = useMemo(() => {
    // Never synthesize a preview target after auth failure — that would retry blob fetch.
    if (authFailed) return null;
    if (!route?.path || !fileName) return null;
    const fromList = siblings.find((s) => s.path === route.path);
    if (fromList) return fromList;
    if (error) return null;
    return {
      item: {
        id: 'pending',
        name: fileName,
        metadata: null,
      },
      path: route.path,
    } satisfies ViewerTarget;
  }, [authFailed, error, route?.path, fileName, siblings]);

  const handleClose = useCallback(() => {
    closeAppModal();
  }, []);

  const handleNavigate = useCallback(
    (next: ViewerTarget) => {
      if (!route?.bucket) return;
      setViewerHash(route.bucket, next.path);
    },
    [route?.bucket],
  );

  if (!route?.bucket || !route.path) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
        {t('viewerMissingParams')}
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

  if (loadingList && siblings.length === 0) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('viewerLoading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!target) return null;

  return (
    <FileViewer
      token={token}
      bucket={route.bucket}
      target={target}
      siblings={siblings.length > 0 ? siblings : [target]}
      onClose={handleClose}
      onNavigate={handleNavigate}
      variant="embedded"
    />
  );
}
