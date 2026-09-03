import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, File as FileIcon, Folder, FolderCheck, Loader2, X } from 'lucide-react';
import { FileList } from '@/components/FileList';
import type { FileSelection } from '@/hooks/useFileSelection';
import { isFolderItem, keysInRange, fileItemKey } from '@/lib/fileSelection';
import { joinPath } from '@/lib/format';
import {
  currentFolderItem,
  fromListItem,
  pickedKey,
  type PickedStorageItem,
} from '@/lib/pickerSelection';
import { sendSelectResult, type SelectRoute } from '@/lib/modalRoutes';
import { unwrapStorage } from '@/lib/shellStorage';
import {
  isStorageAccessDenied,
  isStorageAuthError,
  pickDefaultBucket,
  resolveStorageError,
  type Bucket,
  type StorageListItem,
} from '@/lib/storageApi';
import { shellui } from '@shellui/sdk';

type StoragePickerDialogProps = {
  route: SelectRoute;
  onAuthError: (message: string) => void;
};

export function StoragePickerDialog({ route, onAuthError }: StoragePickerDialogProps) {
  const { t } = useTranslation();
  const allowFolders = route.mode === 'folders' || route.mode === 'any';
  const allowFiles = route.mode === 'files' || route.mode === 'any';

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [bucket, setBucket] = useState('');
  const [prefix, setPrefix] = useState('');
  const [items, setItems] = useState<StorageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedStorageItem[]>([]);

  const selectedBucket = useMemo(
    () => buckets.find((entry) => entry.name === bucket) ?? null,
    [buckets, bucket],
  );
  const showLocations = buckets.length > 1;
  const rootLabel = selectedBucket?.display_name || bucket || t('pathRoot');

  const crumbs = useMemo(() => {
    const parts = prefix.split('/').filter(Boolean);
    const out: { label: string; path: string }[] = [{ label: rootLabel, path: '' }];
    let acc = '';
    for (const part of parts) {
      acc = joinPath(acc, part);
      out.push({ label: part, path: acc });
    }
    return out;
  }, [prefix, rootLabel]);

  const visibleItems = useMemo(() => {
    if (route.mode === 'folders') return items.filter(isFolderItem);
    return items;
  }, [items, route.mode]);

  const canSelectItem = useCallback(
    (item: StorageListItem) => (isFolderItem(item) ? allowFolders : allowFiles),
    [allowFolders, allowFiles],
  );

  const handleApiError = useCallback(
    (err: unknown) => {
      if (isStorageAuthError(err)) {
        onAuthError(resolveStorageError(err, t));
        return;
      }
      if (isStorageAccessDenied(err)) {
        setError(t('accessDenied'));
        return;
      }
      setError(err instanceof Error ? err.message : t('error'));
    },
    [onAuthError, t],
  );

  const loadBuckets = useCallback(async () => {
    try {
      const list = unwrapStorage(await shellui.storage.listBuckets()) as Bucket[];
      setBuckets(list);
      setBucket((current) => {
        if (current && list.some((entry) => entry.name === current)) return current;
        return pickDefaultBucket(list);
      });
      setError(null);
    } catch (err) {
      handleApiError(err);
    }
  }, [handleApiError]);

  const loadObjects = useCallback(async () => {
    if (!bucket) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = unwrapStorage(
        await shellui.storage.from(bucket).list(prefix, { limit: 200 }),
      ) as StorageListItem[];
      setItems(list);
    } catch (err) {
      handleApiError(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [bucket, prefix, handleApiError]);

  useEffect(() => {
    void loadBuckets();
  }, [loadBuckets]);

  useEffect(() => {
    void loadObjects();
  }, [loadObjects]);

  const pickedKeys = useMemo(() => new Set(picked.map(pickedKey)), [picked]);

  const isPicked = useCallback(
    (item: PickedStorageItem) => pickedKeys.has(pickedKey(item)),
    [pickedKeys],
  );

  const removePicked = useCallback((item: PickedStorageItem) => {
    const key = pickedKey(item);
    setPicked((current) => current.filter((entry) => pickedKey(entry) !== key));
  }, []);

  const togglePicked = useCallback(
    (item: PickedStorageItem) => {
      setPicked((current) => {
        const key = pickedKey(item);
        if (current.some((entry) => pickedKey(entry) === key)) {
          return current.filter((entry) => pickedKey(entry) !== key);
        }
        return route.multiple ? [...current, item] : [item];
      });
    },
    [route.multiple],
  );

  const listingSelection = useMemo<FileSelection>(() => {
    const selectable = visibleItems.filter(canSelectItem);
    const selectedItems = selectable.filter((item) => isPicked(fromListItem(item, bucket, prefix)));
    const selectedKeys = new Set(selectedItems.map(fileItemKey));
    const selectedCount = selectedItems.length;
    const allSelected = selectable.length > 0 && selectedCount === selectable.length;
    const someSelected = selectedCount > 0 && !allSelected;

    const isSelected = (item: StorageListItem) => isPicked(fromListItem(item, bucket, prefix));

    const select: FileSelection['select'] = (item, event = {}) => {
      if (!canSelectItem(item)) return;
      const pickedItem = fromListItem(item, bucket, prefix);
      if (!route.multiple) {
        setPicked([pickedItem]);
        return;
      }
      if (event.range) {
        const last = picked[picked.length - 1];
        const fromKey = last
          ? fileItemKey({
              id: last.type === 'folder' ? null : last.id,
              name: last.name,
            })
          : fileItemKey(item);
        const toKey = fileItemKey(item);
        const rangeKeys = new Set(keysInRange(visibleItems, fromKey, toKey));
        setPicked((current) => {
          const next = event.additive ? [...current] : [];
          const seen = new Set(next.map(pickedKey));
          for (const row of visibleItems) {
            if (!rangeKeys.has(fileItemKey(row))) continue;
            if (!canSelectItem(row)) continue;
            const mapped = fromListItem(row, bucket, prefix);
            const key = pickedKey(mapped);
            if (seen.has(key)) continue;
            next.push(mapped);
            seen.add(key);
          }
          return next;
        });
        return;
      }
      if (event.additive) {
        togglePicked(pickedItem);
        return;
      }
      setPicked([pickedItem]);
    };

    return {
      mode: route.multiple ? 'multiple' : 'single',
      selectedKeys,
      selectedItems,
      selectedCount,
      allSelected,
      someSelected,
      isSelected,
      select,
      toggle: (item) => {
        if (!canSelectItem(item)) return;
        togglePicked(fromListItem(item, bucket, prefix));
      },
      selectAll: () => {
        if (!route.multiple) {
          const last = selectable[selectable.length - 1];
          if (last) setPicked([fromListItem(last, bucket, prefix)]);
          return;
        }
        setPicked((current) => {
          const next = [...current];
          const seen = new Set(next.map(pickedKey));
          for (const row of selectable) {
            const mapped = fromListItem(row, bucket, prefix);
            const key = pickedKey(mapped);
            if (seen.has(key)) continue;
            next.push(mapped);
            seen.add(key);
          }
          return next;
        });
      },
      clear: () => {
        const listing = new Set(
          selectable.map((item) => pickedKey(fromListItem(item, bucket, prefix))),
        );
        setPicked((current) => current.filter((entry) => !listing.has(pickedKey(entry))));
      },
    };
  }, [bucket, canSelectItem, isPicked, picked, prefix, route.multiple, togglePicked, visibleItems]);

  const currentFolder = useMemo(
    () => currentFolderItem(bucket, prefix, crumbs[crumbs.length - 1]?.label || rootLabel),
    [bucket, crumbs, prefix, rootLabel],
  );
  const currentFolderPicked = Boolean(bucket) && isPicked(currentFolder);

  function cancel() {
    sendSelectResult({ id: route.requestId, cancelled: true });
  }

  async function confirm() {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const itemsOut = [];
      for (const item of picked) {
        let id = item.id;
        if (item.type === 'folder' && !id) {
          try {
            const created = unwrapStorage(
              await shellui.storage.from(item.bucket).createFolder(item.path),
            ) as { path: string; id?: string };
            id = created.id ?? null;
          } catch (err) {
            if (isStorageAuthError(err)) {
              onAuthError(resolveStorageError(err, t));
              return;
            }
          }
        }
        if (!id) {
          id = `${item.bucket}:${item.path}`;
        }
        itemsOut.push({
          id,
          bucket: item.bucket,
          path: item.path,
          name: item.name,
          type: item.type,
        });
      }
      sendSelectResult({ id: route.requestId, items: itemsOut });
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusy(false);
    }
  }

  const title =
    route.mode === 'folders'
      ? t(route.multiple ? 'pickerTitleFoldersMany' : 'pickerTitleFolders')
      : route.mode === 'files'
        ? t(route.multiple ? 'pickerTitleFilesMany' : 'pickerTitleFiles')
        : t(route.multiple ? 'pickerTitleAnyMany' : 'pickerTitleAny');

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col bg-card"
      role="dialog"
      aria-labelledby="storage-picker-title"
    >
      <header className="flex items-start gap-3 border-b border-border px-4 py-3 pr-14">
        <FolderCheck
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2
            id="storage-picker-title"
            className="font-heading text-base font-semibold"
          >
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{t('pickerSubtitle')}</p>
        </div>
      </header>

      {error ? (
        <p className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showLocations ? (
            <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
              {buckets.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                    bucket === entry.name
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'border border-border hover:bg-muted'
                  }`}
                  onClick={() => {
                    setBucket(entry.name);
                    setPrefix('');
                  }}
                >
                  {entry.display_name || entry.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1">
            {showLocations ? (
              <aside className="hidden w-44 shrink-0 overflow-auto border-r border-border bg-card/40 p-2 md:block">
                <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('locations')}
                </div>
                <ul className="space-y-0.5">
                  {buckets.map((entry) => (
                    <li key={entry.name}>
                      <button
                        type="button"
                        className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                          bucket === entry.name
                            ? 'bg-accent font-medium text-accent-foreground'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => {
                          setBucket(entry.name);
                          setPrefix('');
                        }}
                      >
                        {entry.display_name || entry.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}

            <div className="flex min-w-0 flex-1 flex-col">
              <nav
                className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2 text-sm"
                aria-label={t('breadcrumb')}
              >
                {crumbs.map((crumb, index) => (
                  <span
                    key={crumb.path || 'root'}
                    className="inline-flex items-center gap-0.5"
                  >
                    {index > 0 ? (
                      <ChevronRight
                        className="h-3.5 w-3.5 text-muted-foreground"
                        aria-hidden
                      />
                    ) : (
                      <Folder
                        className="h-3.5 w-3.5 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                    <button
                      type="button"
                      className={`rounded px-1.5 py-0.5 hover:bg-muted ${
                        index === crumbs.length - 1 ? 'font-medium' : 'text-muted-foreground'
                      }`}
                      onClick={() => setPrefix(crumb.path)}
                    >
                      {crumb.label}
                    </button>
                  </span>
                ))}
                {allowFolders && bucket ? (
                  <button
                    type="button"
                    className="ml-auto rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                    onClick={() => togglePicked(currentFolder)}
                  >
                    {currentFolderPicked ? t('pickerCurrentSelected') : t('pickerSelectCurrent')}
                  </button>
                ) : null}
              </nav>

              <div className="min-h-0 flex-1 overflow-auto">
                {!bucket && !error ? (
                  <p className="p-4 text-sm text-muted-foreground">{t('emptyBuckets')}</p>
                ) : bucket ? (
                  <FileList
                    items={visibleItems}
                    prefix={prefix}
                    loading={loading}
                    selection={listingSelection}
                    onOpen={(item) => {
                      if (isFolderItem(item)) setPrefix(joinPath(prefix, item.name));
                      else if (allowFiles) togglePicked(fromListItem(item, bucket, prefix));
                    }}
                    canSelectItem={canSelectItem}
                    columns={{
                      access: false,
                      type: false,
                      size: false,
                      modified: false,
                      actions: true,
                    }}
                    renderActions={(item) =>
                      isFolderItem(item) ? (
                        <ChevronRight
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden
                        />
                      ) : null
                    }
                    empty={
                      <p className="p-4 text-sm text-muted-foreground">
                        {route.mode === 'folders' ? t('pickerNoFolders') : t('emptyBucket')}
                      </p>
                    }
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <aside className="flex max-h-48 shrink-0 flex-col border-t border-border md:max-h-none md:w-56 md:border-l md:border-t-0 lg:w-64">
          <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('pickerSelected', { count: picked.length })}
          </div>
          <ul className="min-h-0 flex-1 overflow-auto">
            {picked.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                {t('pickerSelectedEmpty')}
              </li>
            ) : (
              picked.map((item) => (
                <li
                  key={pickedKey(item)}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                >
                  {item.type === 'folder' ? (
                    <Folder
                      className="h-4 w-4 shrink-0 text-primary"
                      aria-hidden
                    />
                  ) : (
                    <FileIcon
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <span
                    className="min-w-0 flex-1 truncate"
                    title={item.path || item.name}
                  >
                    {item.name}
                  </span>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => removePicked(item)}
                    aria-label={t('pickerRemove', { name: item.name })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          onClick={cancel}
          disabled={busy}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          onClick={() => void confirm()}
          disabled={busy || loading || picked.length === 0}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {t('pickerConfirm', { count: picked.length })}
        </button>
      </footer>
    </div>
  );
}
