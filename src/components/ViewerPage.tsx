import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import shellui from '@shellui/sdk';
import { Loader2 } from 'lucide-react';
import { FileViewer, type ViewerTarget } from '@/components/FileViewer';
import { useShelluiAccessToken } from '@/hooks/useShelluiAccessToken';
import { joinPath } from '@/lib/format';
import { listObjects } from '@/lib/storageApi';
import { parseViewerHash, setViewerHash } from '@/lib/viewerRoute';

export function ViewerPage() {
  const { t } = useTranslation();
  const token = useShelluiAccessToken();
  const [route, setRoute] = useState(() => parseViewerHash());
  const [siblings, setSiblings] = useState<ViewerTarget[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        return;
      }
      setLoadingList(true);
      setError(null);
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
          setError(err instanceof Error ? err.message : t('error'));
          setSiblings([]);
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, route?.bucket, route?.path, prefix, t]);

  const target = useMemo(() => {
    if (!route?.path || !fileName) return null;
    const fromList = siblings.find((s) => s.path === route.path);
    if (fromList) return fromList;
    return {
      item: {
        id: 'pending',
        name: fileName,
        metadata: null,
      },
      path: route.path,
    } satisfies ViewerTarget;
  }, [route?.path, fileName, siblings]);

  const handleClose = useCallback(() => {
    shellui.closeModal();
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

  if (error && !target) {
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
