import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Folder, FolderInput, Loader2, X } from 'lucide-react';
import { isInvalidMoveDestination } from '@/lib/dnd';
import { joinPath } from '@/lib/format';
import { notifyFilesListChanged } from '@/lib/filesEvents';
import { fileNameFromPath } from '@/lib/modalRoutes';
import { unwrapStorage } from '@/lib/shellStorage';
import {
  isStorageAccessDenied,
  isStorageAuthError,
  resolveStorageError,
  type StorageListItem,
} from '@/lib/storageApi';
import { shellui } from '@shellui/sdk';

export type MoveItemTarget = {
  bucket: string;
  path: string;
  name: string;
  /** Parent folder prefix of the item ('' = root). */
  parentPrefix: string;
  resourceType: 'folder' | 'object';
};

/** @deprecated Use MoveItemTarget */
export type MoveFileTarget = MoveItemTarget;

type MoveFileDialogProps = {
  target: MoveItemTarget;
  rootLabel: string;
  onClose: () => void;
  onAuthError: (message: string) => void;
  /** `embedded` fills a Shellui modal iframe; `overlay` is a local backdrop. */
  variant?: 'overlay' | 'embedded';
};

export function parentPrefixFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join('/');
}

export function moveTargetFromPath(
  bucket: string,
  path: string,
  resourceType: 'folder' | 'object' = 'object',
): MoveItemTarget {
  return {
    bucket,
    path,
    name: fileNameFromPath(path),
    parentPrefix: parentPrefixFromPath(path),
    resourceType,
  };
}

export function MoveFileDialog({
  target,
  rootLabel,
  onClose,
  onAuthError,
  variant = 'overlay',
}: MoveFileDialogProps) {
  const { t } = useTranslation();
  const isFolder = target.resourceType === 'folder';
  const [browsePrefix, setBrowsePrefix] = useState(target.parentPrefix);
  const [folders, setFolders] = useState<StorageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crumbs = useMemo(() => {
    const parts = browsePrefix.split('/').filter(Boolean);
    const out: { label: string; path: string }[] = [{ label: rootLabel, path: '' }];
    let acc = '';
    for (const part of parts) {
      acc = joinPath(acc, part);
      out.push({ label: part, path: acc });
    }
    return out;
  }, [browsePrefix, rootLabel]);

  const sameLocation = browsePrefix === target.parentPrefix;
  const invalidDest = isInvalidMoveDestination(
    target.path,
    isFolder ? 'folder' : 'file',
    browsePrefix,
  );
  const canMoveHere = !sameLocation && !invalidDest;
  const destinationPath = joinPath(browsePrefix, target.name);

  const loadFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = unwrapStorage(
        await shellui.storage.from(target.bucket).list(browsePrefix, { limit: 200 }),
      ) as StorageListItem[];
      setFolders(
        entries.filter((item) => {
          if (item.id != null) return false;
          const folderPath = joinPath(browsePrefix, item.name);
          if (!isFolder) return true;
          return !isInvalidMoveDestination(target.path, 'folder', folderPath);
        }),
      );
    } catch (err) {
      if (isStorageAuthError(err)) {
        onAuthError(resolveStorageError(err, t));
        return;
      }
      if (isStorageAccessDenied(err)) {
        setError(t('accessDenied'));
      } else {
        setError(err instanceof Error ? err.message : t('error'));
      }
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [target.bucket, target.path, browsePrefix, isFolder, onAuthError, t]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  async function handleMove() {
    if (!canMoveHere || busy) return;
    setBusy(true);
    setError(null);
    try {
      const destEntries = unwrapStorage(
        await shellui.storage.from(target.bucket).list(browsePrefix, { limit: 200 }),
      ) as StorageListItem[];
      const conflict = destEntries.some(
        (item) =>
          (item.id == null) === isFolder && item.name.toLowerCase() === target.name.toLowerCase(),
      );
      if (conflict) {
        setError(t(isFolder ? 'folderExists' : 'fileExists', { name: target.name }));
        setBusy(false);
        return;
      }
      if (isFolder) {
        unwrapStorage(
          await shellui.storage
            .from(target.bucket)
            .move(target.path, destinationPath, { folder: true }),
        );
      } else {
        unwrapStorage(await shellui.storage.from(target.bucket).move(target.path, destinationPath));
      }
      notifyFilesListChanged({
        reason: 'move',
        bucket: target.bucket,
        path: destinationPath,
      });
      onClose();
    } catch (err) {
      if (isStorageAuthError(err)) {
        onAuthError(resolveStorageError(err, t));
        return;
      }
      if (isStorageAccessDenied(err)) {
        setError(t('accessDenied'));
      } else {
        setError(err instanceof Error ? err.message : t('error'));
      }
    } finally {
      setBusy(false);
    }
  }

  const embedded = variant === 'embedded';
  const shell = (
    <div
      className={
        embedded
          ? 'flex h-full min-h-0 w-full flex-col bg-card'
          : 'flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-lg'
      }
    >
      <header
        className={`flex items-start gap-3 border-b border-border px-4 py-3 ${
          embedded ? 'pr-14' : ''
        }`}
      >
        <FolderInput
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2
            id="move-file-title"
            className="font-heading text-base font-semibold"
          >
            {t(isFolder ? 'moveFolderTitle' : 'moveFileTitle')}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {t(isFolder ? 'moveFolderSubtitle' : 'moveFileSubtitle', {
              name: target.name,
            })}
          </p>
        </div>
        {!embedded ? (
          <button
            type="button"
            className="rounded p-1.5 hover:bg-muted"
            onClick={onClose}
            aria-label={t('close')}
            disabled={busy}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <nav
          className="flex flex-wrap items-center gap-0.5 text-sm"
          aria-label={t('breadcrumb')}
        >
          {crumbs.map((crumb, index) => {
            const crumbInvalid = isInvalidMoveDestination(
              target.path,
              isFolder ? 'folder' : 'file',
              crumb.path,
            );
            return (
              <span
                key={crumb.path || 'root'}
                className="inline-flex items-center gap-0.5"
              >
                {index > 0 ? (
                  <ChevronRight
                    className="h-3.5 w-3.5 text-muted-foreground"
                    aria-hidden
                  />
                ) : null}
                <button
                  type="button"
                  className={`rounded px-1.5 py-0.5 hover:bg-muted ${
                    index === crumbs.length - 1 ? 'font-medium' : 'text-muted-foreground'
                  }`}
                  onClick={() => setBrowsePrefix(crumb.path)}
                  disabled={busy || loading || crumbInvalid}
                >
                  {crumb.label}
                </button>
              </span>
            );
          })}
        </nav>

        <p className="text-xs text-muted-foreground">
          {invalidDest
            ? t('moveFolderIntoSelf')
            : sameLocation
              ? t('moveFileSameLocation')
              : t('moveFileDestination', {
                  path: browsePrefix ? `/${browsePrefix}` : '/',
                })}
        </p>

        <div className="min-h-[12rem] flex-1 overflow-auto rounded-md border border-border">
          {loading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : folders.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t('moveFileNoFolders')}</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {folders.map((folder) => (
                <li key={folder.name}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                    onClick={() => setBrowsePrefix(joinPath(browsePrefix, folder.name))}
                    disabled={busy}
                  >
                    <Folder className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{folder.name}</span>
                    <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          onClick={onClose}
          disabled={busy}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          onClick={() => void handleMove()}
          disabled={busy || loading || !canMoveHere}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {t('moveFileSave')}
        </button>
      </footer>
    </div>
  );

  if (embedded) {
    return (
      <div
        className="flex h-full min-h-screen w-full flex-col"
        role="dialog"
        aria-labelledby="move-file-title"
      >
        {shell}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-file-title"
    >
      {shell}
    </div>
  );
}
