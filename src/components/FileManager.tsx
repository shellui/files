import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import shellui from '@shellui/sdk';
import {
  ChevronRight,
  Download,
  Eye,
  File as FileIcon,
  Folder,
  FolderPlus,
  Link2,
  Loader2,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import { useShelluiAccessSession } from '@/hooks/useShelluiAccessToken';
import { subscribeFilesListChanged } from '@/lib/filesEvents';
import { formatBytes, isValidFolderName, joinPath } from '@/lib/format';
import {
  buildPermissionsModalUrl,
  buildShareModalUrl,
} from '@/lib/modalRoutes';
import {
  createFolder,
  deleteFolder,
  deleteObject,
  downloadObject,
  getFolderStats,
  getStorageBaseUrl,
  isStorageAccessDenied,
  isStorageAuthError,
  listBuckets,
  listObjects,
  pickDefaultBucket,
  renameFolder,
  type Bucket,
  type StorageListItem,
  uploadObject,
} from '@/lib/storageApi';
import { buildViewerModalUrl } from '@/lib/viewerRoute';

function accessLabelKey(audience: string | undefined): string {
  if (audience === 'company') return 'accessCompany';
  if (audience === 'owner') return 'accessOwner';
  if (audience === 'connector') return 'accessConnector';
  if (audience === 'restricted') return 'accessRestricted';
  if (audience === 'limited') return 'accessLimited';
  return 'accessUnknown';
}

function accessRowLabel(
  access: StorageListItem['access'] | undefined,
  fallbackAudience: string | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const audience = access?.audience || fallbackAudience;
  if (audience === 'restricted') {
    const n = access?.allowed_user_ids?.length ?? 0;
    if (n > 0) return t('accessRestrictedUsers', { count: n });
    return t('accessRestricted');
  }
  if (audience === 'limited') {
    const grants = access?.grant_count ?? 0;
    if (grants > 0) return t('accessLimitedGrants', { count: grants });
    return t('accessLimited');
  }
  return t(accessLabelKey(audience));
}

export function FileManager() {
  const { t } = useTranslation();
  const { token, sessionExpired } = useShelluiAccessSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [bucket, setBucket] = useState<string>('');
  const [prefix, setPrefix] = useState('');
  const [items, setItems] = useState<StorageListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingName, setRenamingName] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyName, setBusyName] = useState<string | null>(null);

  const selectedBucket = useMemo(
    () => buckets.find((b) => b.name === bucket) ?? null,
    [buckets, bucket],
  );

  const canWrite = selectedBucket?.access?.can_write !== false;
  const grantsEnabled = selectedBucket?.access?.grants_enabled === true;
  const shareable = selectedBucket?.access?.shareable === true && canWrite;
  const showLocations = buckets.length > 1;

  const crumbs = useMemo(() => {
    const rootLabel = selectedBucket?.display_name || bucket || t('pathRoot');
    const parts = prefix.split('/').filter(Boolean);
    const out: { label: string; path: string }[] = [{ label: rootLabel, path: '' }];
    let acc = '';
    for (const part of parts) {
      acc = joinPath(acc, part);
      out.push({ label: part, path: acc });
    }
    return out;
  }, [bucket, prefix, selectedBucket, t]);

  const clearSessionData = useCallback(() => {
    setBuckets([]);
    setBucket('');
    setItems([]);
  }, []);

  function openShelluiOrHash(url: string, hash: string) {
    if (typeof window !== 'undefined' && window.parent !== window) {
      shellui.openModal(url);
      return;
    }
    window.location.hash = hash;
  }

  const handleApiError = useCallback(
    (err: unknown) => {
      if (isStorageAuthError(err)) {
        clearSessionData();
        setError(t('sessionExpired'));
        return;
      }
      if (isStorageAccessDenied(err)) {
        setError(t('accessDenied'));
        return;
      }
      setError(err instanceof Error ? err.message : t('error'));
    },
    [clearSessionData, t],
  );

  const loadBuckets = useCallback(async () => {
    if (!token) {
      setBuckets([]);
      setBucket('');
      return;
    }
    try {
      const list = await listBuckets(token);
      setBuckets(list);
      setBucket((current) => {
        if (current && list.some((b) => b.name === current)) return current;
        return pickDefaultBucket(list);
      });
      setError(null);
    } catch (err) {
      handleApiError(err);
    }
  }, [token, handleApiError]);

  const loadObjects = useCallback(async () => {
    if (!token || !bucket) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listObjects(token, bucket, prefix);
      setItems(list);
    } catch (err) {
      handleApiError(err);
      if (isStorageAuthError(err)) setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, bucket, prefix, handleApiError]);

  /** Refresh listing without the full-page loading flash (e.g. after access edits). */
  const refreshObjectsQuietly = useCallback(async () => {
    if (!token || !bucket) return;
    try {
      const list = await listObjects(token, bucket, prefix);
      setItems(list);
    } catch (err) {
      handleApiError(err);
      if (isStorageAuthError(err)) setItems([]);
    }
  }, [token, bucket, prefix, handleApiError]);

  useEffect(() => {
    if (!token) {
      clearSessionData();
      if (sessionExpired) {
        setError(t('sessionExpired'));
      }
      return;
    }
    void loadBuckets();
  }, [token, sessionExpired, loadBuckets, clearSessionData, t]);

  useEffect(() => {
    void loadObjects();
  }, [loadObjects]);

  useEffect(() => {
    return subscribeFilesListChanged((event) => {
      if (event.reason !== 'access') return;
      if (event.bucket !== bucket) return;
      void refreshObjectsQuietly();
    });
  }, [bucket, refreshObjectsQuietly]);

  useEffect(() => {
    setCreatingFolder(false);
    setNewFolderName('');
    setRenamingName(null);
    setRenameValue('');
  }, [bucket, prefix]);

  function startRenameFolder(folderName: string) {
    setCreatingFolder(false);
    setRenamingName(folderName);
    setRenameValue(folderName);
    setError(null);
  }

  function cancelRenameFolder() {
    setRenamingName(null);
    setRenameValue('');
  }

  async function handleRenameFolder() {
    if (!token || !bucket || !canWrite || !renamingName) return;
    const nextName = renameValue.trim();
    if (!isValidFolderName(nextName)) {
      setError(t('invalidFolderName'));
      return;
    }
    if (nextName === renamingName) {
      cancelRenameFolder();
      return;
    }
    const conflict = items.some(
      (item) =>
        item.id == null &&
        item.name !== renamingName &&
        item.name.toLowerCase() === nextName.toLowerCase(),
    );
    if (conflict) {
      setError(t('folderExists', { name: nextName }));
      return;
    }

    const fromPath = joinPath(prefix, renamingName);
    const toPath = joinPath(prefix, nextName);
    setBusyName(fromPath);
    setError(null);
    try {
      await renameFolder(token, bucket, fromPath, toPath);
      cancelRenameFolder();
      await loadObjects();
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusyName(null);
    }
  }

  async function handleCreateFolder() {
    if (!token || !bucket || !canWrite) return;
    const name = newFolderName.trim();
    if (!isValidFolderName(name)) {
      setError(t('invalidFolderName'));
      return;
    }
    const existing = items.some(
      (item) => item.id == null && item.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      setError(t('folderExists', { name }));
      return;
    }
    setBusyName('__create_folder__');
    setError(null);
    try {
      const folderPath = await createFolder(token, bucket, prefix, name);
      setCreatingFolder(false);
      setNewFolderName('');
      setPrefix(folderPath);
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusyName(null);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!token || !bucket || !canWrite || !files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      const path = joinPath(prefix, file.name);
      setBusyName(path);
      try {
        await uploadObject(token, bucket, path, file);
      } catch (err) {
        handleApiError(err);
        break;
      }
    }
    setBusyName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await loadObjects();
  }

  async function confirmDeleteFile(item: StorageListItem): Promise<boolean> {
    if (typeof window === 'undefined' || window.parent === window) {
      return window.confirm(t('deleteConfirm', { name: item.name }));
    }
    return await new Promise<boolean>((resolve) => {
      shellui.dialog({
        title: t('deleteConfirmTitle'),
        description: t('deleteConfirm', { name: item.name }),
        mode: 'delete',
        size: 'sm',
        okLabel: t('delete'),
        cancelLabel: t('cancel'),
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }

  async function confirmDeleteFolder(
    item: StorageListItem,
    fileCount: number,
  ): Promise<boolean> {
    const description = t('deleteFolderConfirm', { name: item.name, count: fileCount });
    if (typeof window === 'undefined' || window.parent === window) {
      return window.confirm(description);
    }
    return await new Promise<boolean>((resolve) => {
      shellui.dialog({
        title: t('deleteFolderConfirmTitle'),
        description,
        mode: 'delete',
        size: 'sm',
        okLabel: t('delete'),
        cancelLabel: t('cancel'),
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }

  async function handleDelete(item: StorageListItem) {
    if (!token || !bucket || !canWrite) return;
    const path = joinPath(prefix, item.name);
    const isFolder = item.id == null;

    if (isFolder) {
      setBusyName(path);
      setError(null);
      try {
        const stats = await getFolderStats(token, bucket, path);
        // Empty folders (placeholder only) delete immediately; content needs confirm.
        if (stats.file_count > 0) {
          setBusyName(null);
          const confirmed = await confirmDeleteFolder(item, stats.file_count);
          if (!confirmed) return;
          setBusyName(path);
        }
        await deleteFolder(token, bucket, path);
        await loadObjects();
      } catch (err) {
        handleApiError(err);
      } finally {
        setBusyName(null);
      }
      return;
    }

    const confirmed = await confirmDeleteFile(item);
    if (!confirmed) return;
    setBusyName(path);
    setError(null);
    try {
      await deleteObject(token, bucket, path);
      await loadObjects();
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusyName(null);
    }
  }

  async function handleDownload(item: StorageListItem) {
    if (!token || !bucket || item.id == null) return;
    const path = joinPath(prefix, item.name);
    setBusyName(path);
    setError(null);
    try {
      const blob = await downloadObject(token, bucket, path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusyName(null);
    }
  }

  function openFolder(folderName: string) {
    setPrefix(joinPath(prefix, folderName));
  }

  function openViewer(item: StorageListItem) {
    if (item.id == null || !bucket) return;
    const path = joinPath(prefix, item.name);
    const url = buildViewerModalUrl(bucket, path);
    openShelluiOrHash(
      url,
      `#/viewer?${new URLSearchParams({ bucket, path }).toString()}`,
    );
  }

  function openPermissions(item: StorageListItem) {
    if (!bucket || !grantsEnabled) return;
    const path = joinPath(prefix, item.name);
    const resourceType = item.id == null ? 'folder' : 'object';
    const url = buildPermissionsModalUrl(bucket, path, resourceType);
    openShelluiOrHash(
      url,
      `#/permissions?${new URLSearchParams({
        bucket,
        path,
        type: resourceType,
      }).toString()}`,
    );
  }

  function openShare(item: StorageListItem) {
    if (!bucket || item.id == null || !shareable) return;
    const path = joinPath(prefix, item.name);
    const url = buildShareModalUrl(bucket, path);
    openShelluiOrHash(
      url,
      `#/share?${new URLSearchParams({ bucket, path }).toString()}`,
    );
  }

  if (!token) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center p-6 text-sm ${
          sessionExpired ? 'text-destructive' : 'text-muted-foreground'
        }`}
      >
        {sessionExpired ? t('sessionExpired') : t('noToken')}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="font-heading text-lg font-semibold">{t('appTitle')}</h1>
        <span className="text-xs text-muted-foreground">
          {t('storageUrl')}: {getStorageBaseUrl()}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent"
            onClick={() => void loadObjects()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            onClick={() => setCreatingFolder((v) => !v)}
            disabled={!bucket || !canWrite}
            title={!canWrite ? t('readOnlyLocation') : undefined}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            {t('createFolder')}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={!bucket || !canWrite}
            title={!canWrite ? t('readOnlyLocation') : undefined}
          >
            <Upload className="h-3.5 w-3.5" />
            {t('upload')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => void handleUpload(e.target.files)}
          />
        </div>
      </header>

      {creatingFolder ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
          <FolderPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            className="min-w-[12rem] flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            placeholder={t('folderNamePlaceholder')}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreateFolder();
            }}
            autoFocus
          />
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            onClick={() => void handleCreateFolder()}
            disabled={busyName === '__create_folder__'}
          >
            {t('create')}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm"
            onClick={() => {
              setCreatingFolder(false);
              setNewFolderName('');
            }}
          >
            {t('cancel')}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!canWrite && bucket ? (
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          {t('readOnlyLocation')}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {showLocations ? (
          <aside className="w-52 shrink-0 border-r border-border bg-card/40 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('locations')}
            </div>
            <ul className="space-y-1">
              {buckets.map((b) => (
                <li key={b.name}>
                  <button
                    type="button"
                    className={`w-full rounded-md px-2 py-1.5 text-left ${
                      bucket === b.name
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      setBucket(b.name);
                      setPrefix('');
                    }}
                  >
                    <span className="block text-sm">{b.display_name || b.name}</span>
                    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                      {t(accessLabelKey(b.access?.audience))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col">
          <nav
            className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2 text-sm"
            aria-label={t('breadcrumb')}
          >
            {crumbs.map((crumb, index) => (
              <span
                key={crumb.path || 'root'}
                className="inline-flex items-center gap-1"
              >
                {index > 0 ? (
                  <ChevronRight
                    className="h-3.5 w-3.5 text-muted-foreground"
                    aria-hidden
                  />
                ) : (
                  <Folder className="mr-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                )}
                <button
                  type="button"
                  className={`rounded px-1.5 py-0.5 hover:bg-muted ${
                    index === crumbs.length - 1 ? 'font-medium' : 'text-muted-foreground'
                  }`}
                  onClick={() => setPrefix(crumb.path)}
                  aria-current={index === crumbs.length - 1 ? 'location' : undefined}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
            {selectedBucket?.access ? (
              <span
                className="ml-auto rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                title={selectedBucket.access.description}
              >
                {t(accessLabelKey(selectedBucket.access.audience))}
              </span>
            ) : null}
          </nav>

          <div className="min-h-0 flex-1 overflow-auto p-2">
            {loading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('loading')}
              </div>
            ) : !bucket ? (
              <p className="p-4 text-sm text-muted-foreground">{t('emptyBuckets')}</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{t('emptyBucket')}</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-medium">{t('name')}</th>
                    <th className="px-3 py-2 font-medium">{t('access')}</th>
                    <th className="px-3 py-2 font-medium">{t('type')}</th>
                    <th className="px-3 py-2 font-medium">{t('size')}</th>
                    <th className="px-3 py-2 font-medium">{t('modified')}</th>
                    <th className="px-3 py-2 font-medium">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isFolder = item.id == null;
                    const path = joinPath(prefix, item.name);
                    const busy = busyName === path;
                    return (
                      <tr
                        key={`${isFolder ? 'dir' : 'file'}:${item.name}`}
                        className="border-b border-border/70"
                      >
                        <td className="px-3 py-2">
                          {isFolder && renamingName === item.name ? (
                            <div className="flex min-w-[12rem] flex-wrap items-center gap-2">
                              <Folder className="h-4 w-4 shrink-0 text-primary" />
                              <input
                                className="min-w-[8rem] flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void handleRenameFolder();
                                  if (e.key === 'Escape') cancelRenameFolder();
                                }}
                                autoFocus
                                disabled={busy}
                              />
                              <button
                                type="button"
                                className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                                onClick={() => void handleRenameFolder()}
                                disabled={busy}
                              >
                                {t('renameSave')}
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-border px-2 py-1 text-xs"
                                onClick={cancelRenameFolder}
                                disabled={busy}
                              >
                                {t('cancel')}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 hover:underline"
                              onClick={() => {
                                if (isFolder) openFolder(item.name);
                                else openViewer(item);
                              }}
                            >
                              {isFolder ? (
                                <Folder className="h-4 w-4 text-primary" />
                              ) : (
                                <FileIcon className="h-4 w-4 text-muted-foreground" />
                              )}
                              {item.name}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <span title={item.access?.description || selectedBucket?.access?.description}>
                            {accessRowLabel(item.access, selectedBucket?.access?.audience, t)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {isFolder ? t('folder') : item.metadata?.mimetype || t('file')}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {isFolder ? '—' : formatBytes(item.metadata?.size)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {item.updated_at
                            ? new Date(item.updated_at).toLocaleString()
                            : item.metadata?.lastModified
                              ? new Date(item.metadata.lastModified).toLocaleString()
                              : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {!isFolder ? (
                              <>
                                <button
                                  type="button"
                                  className="rounded p-1.5 hover:bg-muted disabled:opacity-50"
                                  title={t('view')}
                                  onClick={() => openViewer(item)}
                                  disabled={busy}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1.5 hover:bg-muted disabled:opacity-50"
                                  title={t('download')}
                                  onClick={() => void handleDownload(item)}
                                  disabled={busy}
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                                {shareable ? (
                                  <button
                                    type="button"
                                    className="rounded p-1.5 hover:bg-muted disabled:opacity-50"
                                    title={t('share')}
                                    onClick={() => openShare(item)}
                                    disabled={busy}
                                  >
                                    <Link2 className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </>
                            ) : (
                              <button
                                type="button"
                                className="rounded px-2 py-1 text-xs hover:bg-muted"
                                onClick={() => openFolder(item.name)}
                              >
                                {t('open')}
                              </button>
                            )}
                            {isFolder && canWrite ? (
                              <button
                                type="button"
                                className="rounded p-1.5 hover:bg-muted disabled:opacity-50"
                                title={t('renameFolder')}
                                onClick={() => startRenameFolder(item.name)}
                                disabled={busy || renamingName === item.name}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            ) : null}
                            {grantsEnabled ? (
                              <button
                                type="button"
                                className="rounded p-1.5 hover:bg-muted disabled:opacity-50"
                                title={t('permissions')}
                                onClick={() => openPermissions(item)}
                                disabled={busy}
                              >
                                <Shield className="h-4 w-4" />
                              </button>
                            ) : null}
                            {canWrite ? (
                              <button
                                type="button"
                                className="rounded p-1.5 text-destructive hover:bg-muted disabled:opacity-50"
                                title={isFolder ? t('deleteFolder') : t('delete')}
                                onClick={() => void handleDelete(item)}
                                disabled={busy}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
