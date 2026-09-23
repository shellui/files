import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { shellui } from '@shellui/sdk';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Download,
  Eye,
  File as FileIcon,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Link2,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  Rows3,
  Upload,
} from 'lucide-react';
import { BreadcrumbTrail } from '@/components/BreadcrumbTrail';
import { FileFindBar } from '@/components/FileFindBar';
import { FileList, dropHighlightClass } from '@/components/FileList';
import { ItemActions, type ItemAction } from '@/components/ItemActions';
import { SelectionToolbar } from '@/components/SelectionToolbar';
import { useFileSelection } from '@/hooks/useFileSelection';
import { useListKeyboardNav } from '@/hooks/useListKeyboardNav';
import { useListDensity } from '@/hooks/useListDensity';
import { filterItemsByPrefix, useTypeaheadFind } from '@/hooks/useTypeaheadFind';
import { DropUploadOverlay } from '@/components/DropUploadOverlay';
import { KeyboardHintsFooter } from '@/components/KeyboardHintsFooter';
import { useShelluiAccessSession } from '@/hooks/useShelluiAccessToken';
import { accessLabelKey } from '@/lib/accessLabel';
import {
  canMoveAnyToPrefix,
  canMoveToPrefix,
  dropTargetKey,
  isAcceptableDrop,
  isAlreadyInPrefix,
  isInternalFileDrag,
  readDragItemsPayload,
  setDragCountImage,
  writeDragItemsPayload,
  type DragItemPayload,
} from '@/lib/dnd';
import {
  buildBrowsePath,
  isBrowseFolderId,
  parseBrowseRest,
  parseLegacyBrowseSearch,
  resolveFolderIdForPath,
} from '@/lib/browseRoute';
import { isFolderItem, toDragPayload } from '@/lib/fileSelection';
import { subscribeFilesListChanged } from '@/lib/filesEvents';
import { isValidFileName, isValidFolderName, joinPath } from '@/lib/format';
import { buildMoveModalUrl, buildPermissionsModalUrl, buildShareModalUrl } from '@/lib/modalRoutes';
import { unwrapStorage } from '@/lib/shellStorage';
import {
  isStorageAuthError,
  pickDefaultBucket,
  resolveStorageError,
  type Bucket,
  type StorageListItem,
} from '@/lib/storageApi';
import { sortListItems, toggleSortField, type SortState } from '@/lib/listSort';
import { buildViewerModalUrl } from '@/lib/viewerRoute';

export function FileManager() {
  const { t } = useTranslation();
  const { token, sessionExpired } = useShelluiAccessSession();
  const navigate = useNavigate();
  const params = useParams();
  const bucket = params.bucket ?? '';
  const { folderId: folderIdFromRoute, legacyPath } = parseBrowseRest(params['*']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [bucketsLoading, setBucketsLoading] = useState(false);
  /** Storage list prefix resolved from the folder id in the URL. */
  const [prefix, setPrefix] = useState('');
  /** False until the URL folder id (or root) has been resolved to a prefix. */
  const [locationReady, setLocationReady] = useState(false);
  const [items, setItems] = useState<StorageListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingName, setRenamingName] = useState<string | null>(null);
  const [renamingIsFolder, setRenamingIsFolder] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [busyName, setBusyName] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [draggingItems, setDraggingItems] = useState<DragItemPayload[] | null>(null);
  const hoverNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverNavPathRef = useRef<string | null>(null);

  const HOVER_OPEN_MS = 700;
  const [sort, setSort] = useState<SortState>({ field: 'name', direction: 'asc' });
  const { density, toggle: toggleDensity } = useListDensity();
  const [externalFileDrag, setExternalFileDrag] = useState(false);
  const externalDragDepthRef = useRef(0);

  const sortedItems = useMemo(() => sortListItems(items, sort), [items, sort]);

  const typeahead = useTypeaheadFind(!renamingName && !creatingFolder);
  const displayItems = useMemo(
    () => filterItemsByPrefix(sortedItems, typeahead.query),
    [sortedItems, typeahead.query],
  );

  const selection = useFileSelection({
    items: displayItems,
    listingKey: `${bucket}\0${prefix}`,
    mode: 'multiple',
  });

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
    setItems([]);
  }, []);

  const goTo = useCallback(
    (nextBucket: string, nextFolderId: string | null, replace = false) => {
      if (!nextBucket) return;
      const to = buildBrowsePath(nextBucket, nextFolderId);
      if (window.location.pathname === to) return;
      navigate(to, { replace });
    },
    [navigate],
  );

  /** Navigate to a folder path by resolving/ensuring its stable id. */
  const goToFolderPath = useCallback(
    async (nextBucket: string, folderPath: string, replace = false) => {
      if (!nextBucket) return;
      const normalized = folderPath.replace(/^\/+|\/+$/g, '');
      if (!normalized) {
        goTo(nextBucket, null, replace);
        return;
      }
      const id = await resolveFolderIdForPath(nextBucket, normalized);
      if (id) {
        goTo(nextBucket, id, replace);
        return;
      }
      setError(t('error'));
    },
    [goTo, t],
  );

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
      }
      setError(resolveStorageError(err, t));
    },
    [clearSessionData, t],
  );

  const loadBuckets = useCallback(async () => {
    if (!token) {
      setBuckets([]);
      setBucketsLoading(false);
      return;
    }
    setBucketsLoading(true);
    try {
      const list = unwrapStorage(await shellui.storage.listBuckets()) as Bucket[];
      setBuckets(list);

      if (bucket && list.some((b) => b.name === bucket)) {
        setError(null);
        return;
      }

      const fallback = pickDefaultBucket(list);
      if (fallback) {
        goTo(fallback, null, true);
      }
      setError(null);
    } catch (err) {
      handleApiError(err);
    } finally {
      setBucketsLoading(false);
    }
  }, [token, bucket, goTo, handleApiError]);

  // Migrate legacy query / path URLs → `/{bucket}/{folderId}`.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function migrateLegacy() {
      const legacySearch = parseLegacyBrowseSearch();
      if (legacySearch) {
        const id = legacySearch.path
          ? await resolveFolderIdForPath(legacySearch.bucket, legacySearch.path)
          : null;
        if (cancelled) return;
        goTo(legacySearch.bucket, id, true);
        return;
      }
      if (bucket && legacyPath) {
        const id = await resolveFolderIdForPath(bucket, legacyPath);
        if (cancelled) return;
        goTo(bucket, id, true);
      }
    }

    if (legacyPath || parseLegacyBrowseSearch()) {
      setLocationReady(false);
      void migrateLegacy();
    }

    return () => {
      cancelled = true;
    };
  }, [token, bucket, legacyPath, goTo]);

  // Resolve folder id → storage prefix for listing.
  useEffect(() => {
    if (!token || !bucket) {
      setLocationReady(false);
      return;
    }
    if (legacyPath || parseLegacyBrowseSearch()) {
      setLocationReady(false);
      return;
    }

    let cancelled = false;

    async function resolvePrefix() {
      setLocationReady(false);
      if (!folderIdFromRoute) {
        setPrefix('');
        if (!cancelled) setLocationReady(true);
        return;
      }
      setLoading(true);
      try {
        const resolved = unwrapStorage(await shellui.storage.get(folderIdFromRoute));
        if (cancelled) return;
        if (resolved.type !== 'folder') {
          const parent = resolved.path.includes('/')
            ? resolved.path.slice(0, resolved.path.lastIndexOf('/'))
            : '';
          if (parent) {
            const parentId = await resolveFolderIdForPath(resolved.bucket, parent);
            if (cancelled) return;
            goTo(resolved.bucket, parentId, true);
            return;
          }
          goTo(resolved.bucket, null, true);
          return;
        }
        if (resolved.bucket !== bucket) {
          goTo(resolved.bucket, resolved.id, true);
          return;
        }
        setPrefix(resolved.path);
        setError(null);
        setLocationReady(true);
      } catch (err) {
        if (cancelled) return;
        handleApiError(err);
        goTo(bucket, null, true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void resolvePrefix();
    return () => {
      cancelled = true;
    };
  }, [token, bucket, folderIdFromRoute, legacyPath, goTo, handleApiError]);

  const loadObjects = useCallback(async () => {
    if (!token || !bucket || !locationReady) {
      setItems([]);
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
      if (isStorageAuthError(err)) setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, bucket, prefix, locationReady, handleApiError]);

  /** Refresh listing without the full-page loading flash (e.g. after access edits). */
  const refreshObjectsQuietly = useCallback(async () => {
    if (!token || !bucket || !locationReady) return;
    try {
      const list = unwrapStorage(
        await shellui.storage.from(bucket).list(prefix, { limit: 200 }),
      ) as StorageListItem[];
      setItems(list);
    } catch (err) {
      handleApiError(err);
      if (isStorageAuthError(err)) setItems([]);
    }
  }, [token, bucket, prefix, locationReady, handleApiError]);

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
      if (event.reason !== 'access' && event.reason !== 'move') return;
      if (event.bucket !== bucket) return;
      void refreshObjectsQuietly();
    });
  }, [bucket, refreshObjectsQuietly]);

  useEffect(() => {
    setCreatingFolder(false);
    setNewFolderName('');
    setRenamingName(null);
    setRenamingIsFolder(false);
    setRenameValue('');
    setDropTarget(null);
    setDraggingItems(null);
    if (hoverNavTimerRef.current != null) {
      clearTimeout(hoverNavTimerRef.current);
      hoverNavTimerRef.current = null;
    }
    hoverNavPathRef.current = null;
  }, [prefix]);

  useEffect(() => {
    setCreatingFolder(false);
    setNewFolderName('');
    setRenamingName(null);
    setRenamingIsFolder(false);
    setRenameValue('');
    setDropTarget(null);
    setDraggingItems(null);
    if (hoverNavTimerRef.current != null) {
      clearTimeout(hoverNavTimerRef.current);
      hoverNavTimerRef.current = null;
    }
    hoverNavPathRef.current = null;
  }, [bucket]);

  useEffect(() => {
    return () => {
      if (hoverNavTimerRef.current != null) {
        clearTimeout(hoverNavTimerRef.current);
      }
    };
  }, []);

  const { clear: clearSelection, selectAll } = selection;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'Escape' && !inField) {
        clearSelection();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && !inField) {
        e.preventDefault();
        selectAll();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection, selectAll]);

  function startRename(itemName: string, isFolder: boolean) {
    setCreatingFolder(false);
    setRenamingName(itemName);
    setRenamingIsFolder(isFolder);
    setRenameValue(itemName);
    setError(null);
  }

  function cancelRename() {
    setRenamingName(null);
    setRenamingIsFolder(false);
    setRenameValue('');
  }

  async function handleRename() {
    if (!token || !bucket || !canWrite || !renamingName) return;
    const nextName = renameValue.trim();
    if (renamingIsFolder) {
      if (!isValidFolderName(nextName)) {
        setError(t('invalidFolderName'));
        return;
      }
    } else if (!isValidFileName(nextName)) {
      setError(t('invalidFileName'));
      return;
    }
    if (nextName === renamingName) {
      cancelRename();
      return;
    }
    const conflict = items.some(
      (item) =>
        (item.id == null) === renamingIsFolder &&
        item.name !== renamingName &&
        item.name.toLowerCase() === nextName.toLowerCase(),
    );
    if (conflict) {
      setError(t(renamingIsFolder ? 'folderExists' : 'fileExists', { name: nextName }));
      return;
    }

    const fromPath = joinPath(prefix, renamingName);
    const toPath = joinPath(prefix, nextName);
    setBusyName(fromPath);
    setError(null);
    try {
      if (renamingIsFolder) {
        unwrapStorage(
          await shellui.storage.from(bucket).rename(fromPath, toPath, { folder: true }),
        );
      } else {
        unwrapStorage(await shellui.storage.from(bucket).rename(fromPath, toPath));
      }
      cancelRename();
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
      const created = unwrapStorage(
        await shellui.storage.from(bucket).createFolder(joinPath(prefix, name)),
      ) as { path: string; id?: string };
      setCreatingFolder(false);
      setNewFolderName('');
      if (created.id && isBrowseFolderId(created.id)) {
        goTo(bucket, created.id);
      } else {
        await goToFolderPath(bucket, created.path);
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusyName(null);
    }
  }

  async function handleUpload(files: FileList | null) {
    await handleUploadToPrefix(files, prefix);
  }

  async function handleUploadToPrefix(files: FileList | File[] | null, destPrefix: string) {
    if (
      !token ||
      !bucket ||
      !canWrite ||
      !files ||
      (Array.isArray(files) ? !files.length : !files.length)
    ) {
      return;
    }
    const list = Array.isArray(files) ? files : Array.from(files);
    setError(null);
    for (const file of list) {
      const path = joinPath(destPrefix, file.name);
      setBusyName(path);
      try {
        unwrapStorage(await shellui.storage.from(bucket).upload(path, file, { upsert: true }));
      } catch (err) {
        handleApiError(err);
        break;
      }
    }
    setBusyName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await loadObjects();
  }

  async function moveItemsToPrefix(payloads: DragItemPayload[], destPrefix: string) {
    if (!token || !bucket || !canWrite) return;
    const movable = payloads.filter(
      (payload) =>
        payload.path !== destPrefix &&
        !isAlreadyInPrefix(payload, destPrefix) &&
        canMoveToPrefix(payload, destPrefix),
    );
    if (movable.length === 0) return;

    setBusyName(movable.length === 1 ? movable[0].path : '__bulk__');
    setError(null);
    try {
      const destEntries = unwrapStorage(
        await shellui.storage.from(bucket).list(destPrefix, { limit: 200 }),
      ) as StorageListItem[];
      for (const payload of movable) {
        const movingFolder = payload.kind === 'folder';
        const conflict = destEntries.some(
          (item) =>
            (item.id == null) === movingFolder &&
            item.name.toLowerCase() === payload.name.toLowerCase(),
        );
        if (conflict) {
          setError(t(movingFolder ? 'folderExists' : 'fileExists', { name: payload.name }));
          return;
        }
      }
      for (const payload of movable) {
        const toPath = joinPath(destPrefix, payload.name);
        if (payload.kind === 'folder') {
          unwrapStorage(
            await shellui.storage.from(bucket).move(payload.path, toPath, { folder: true }),
          );
        } else {
          unwrapStorage(await shellui.storage.from(bucket).move(payload.path, toPath));
        }
      }
      selection.clear();
      await loadObjects();
    } catch (err) {
      handleApiError(err);
      await loadObjects();
    } finally {
      setBusyName(null);
    }
  }

  function clearHoverNavigate() {
    if (hoverNavTimerRef.current != null) {
      clearTimeout(hoverNavTimerRef.current);
      hoverNavTimerRef.current = null;
    }
    hoverNavPathRef.current = null;
  }

  function clearDropState() {
    setDropTarget(null);
    clearHoverNavigate();
  }

  function isValidDestForDrag(destPrefix: string): boolean {
    if (!canWrite) return false;
    if (draggingItems?.length) {
      if (draggingItems.some((item) => item.path === destPrefix)) return false;
      return canMoveAnyToPrefix(draggingItems, destPrefix);
    }
    return true;
  }

  function canHoverNavigateInto(folderPath: string): boolean {
    if (folderPath === prefix) return false;
    if (draggingItems?.some((item) => item.path === folderPath)) return false;
    if (draggingItems?.length) return canMoveAnyToPrefix(draggingItems, folderPath);
    return true;
  }

  function scheduleHoverNavigate(folderPath: string) {
    if (!canHoverNavigateInto(folderPath)) {
      clearHoverNavigate();
      return;
    }
    if (hoverNavPathRef.current === folderPath) return;
    clearHoverNavigate();
    hoverNavPathRef.current = folderPath;
    hoverNavTimerRef.current = setTimeout(() => {
      hoverNavTimerRef.current = null;
      hoverNavPathRef.current = null;
      setDropTarget(dropTargetKey('current', folderPath));
      void goToFolderPath(bucket, folderPath);
    }, HOVER_OPEN_MS);
  }

  function allowDrop(e: DragEvent, destPrefix: string) {
    if (!isAcceptableDrop(e.dataTransfer, canWrite)) return false;
    if (isInternalFileDrag(e.dataTransfer) && !isValidDestForDrag(destPrefix)) {
      return false;
    }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = isInternalFileDrag(e.dataTransfer) ? 'move' : 'copy';
    return true;
  }

  function onDropTargetOver(e: DragEvent, key: string, destPrefix: string) {
    if (!allowDrop(e, destPrefix)) {
      clearHoverNavigate();
      return;
    }
    setDropTarget(key);
    scheduleHoverNavigate(destPrefix);
  }

  function onDropTargetLeave(e: DragEvent, key: string) {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDropTarget((current) => (current === key ? null : current));
    clearHoverNavigate();
  }

  async function handleDropOnPrefix(e: DragEvent, destPrefix: string) {
    e.preventDefault();
    e.stopPropagation();
    clearDropState();
    if (!canWrite || !token || !bucket) return;

    const payloads = readDragItemsPayload(e.dataTransfer);
    if (payloads.length) {
      await moveItemsToPrefix(payloads, destPrefix);
      return;
    }
    if (e.dataTransfer.files?.length) {
      await handleUploadToPrefix(e.dataTransfer.files, destPrefix);
    }
  }

  function onItemDragStart(e: DragEvent<HTMLTableRowElement>, item: StorageListItem) {
    if (!canWrite || renamingName === item.name) {
      e.preventDefault();
      return;
    }
    const payloads =
      selection.isSelected(item) && selection.selectedCount > 0
        ? selection.selectedItems.map((selected) => toDragPayload(selected, prefix))
        : [toDragPayload(item, prefix)];
    writeDragItemsPayload(e.dataTransfer, payloads);
    e.dataTransfer.effectAllowed = 'move';
    setDragCountImage(e.dataTransfer, payloads);
    setDraggingItems(payloads);
  }

  function onItemDragEnd() {
    setDraggingItems(null);
    clearDropState();
  }

  useEffect(() => {
    function endDragUi() {
      setDraggingItems(null);
      setDropTarget(null);
      if (hoverNavTimerRef.current != null) {
        clearTimeout(hoverNavTimerRef.current);
        hoverNavTimerRef.current = null;
      }
      hoverNavPathRef.current = null;
    }
    document.addEventListener('dragend', endDragUi, true);
    document.addEventListener('drop', endDragUi, true);
    window.addEventListener('blur', endDragUi);
    return () => {
      document.removeEventListener('dragend', endDragUi, true);
      document.removeEventListener('drop', endDragUi, true);
      window.removeEventListener('blur', endDragUi);
    };
  }, []);

  function onListDragOver(e: DragEvent) {
    if (!allowDrop(e, prefix)) return;
    clearHoverNavigate();
    setDropTarget(dropTargetKey('current', prefix));
  }

  function onListDragLeave(e: DragEvent) {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    clearHoverNavigate();
    setDropTarget((current) => (current === dropTargetKey('current', prefix) ? null : current));
  }

  async function onListDrop(e: DragEvent) {
    await handleDropOnPrefix(e, prefix);
  }

  async function confirmDelete(description: string, title: string): Promise<boolean> {
    if (typeof window === 'undefined' || window.parent === window) {
      return window.confirm(description);
    }
    return await new Promise<boolean>((resolve) => {
      shellui.dialog({
        title,
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

  async function confirmDeleteFile(item: StorageListItem): Promise<boolean> {
    return confirmDelete(t('deleteConfirm', { name: item.name }), t('deleteConfirmTitle'));
  }

  async function confirmDeleteFolder(item: StorageListItem, fileCount: number): Promise<boolean> {
    return confirmDelete(
      t('deleteFolderConfirm', { name: item.name, count: fileCount }),
      t('deleteFolderConfirmTitle'),
    );
  }

  async function handleDelete(item: StorageListItem) {
    if (!token || !bucket || !canWrite) return;
    const path = joinPath(prefix, item.name);
    const isFolder = item.id == null;

    if (isFolder) {
      setBusyName(path);
      setError(null);
      try {
        const stats = unwrapStorage(await shellui.storage.from(bucket).folderStats(path));
        // Empty folders (placeholder only) delete immediately; content needs confirm.
        if (stats.file_count > 0) {
          setBusyName(null);
          const confirmed = await confirmDeleteFolder(item, stats.file_count);
          if (!confirmed) return;
          setBusyName(path);
        }
        unwrapStorage(await shellui.storage.from(bucket).removeFolder(path));
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
      unwrapStorage(await shellui.storage.from(bucket).remove([path]));
      await loadObjects();
    } catch (err) {
      handleApiError(err);
    } finally {
      setBusyName(null);
    }
  }

  async function handleDeleteSelected() {
    const selected = selection.selectedItems;
    if (!token || !bucket || !canWrite || selected.length === 0) return;
    if (selected.length === 1) {
      await handleDelete(selected[0]);
      return;
    }

    const folderCount = selected.filter(isFolderItem).length;
    const description =
      folderCount > 0
        ? t('deleteSelectedConfirmWithFolders', {
            count: selected.length,
            folderCount,
          })
        : t('deleteSelectedConfirm', { count: selected.length });
    const confirmed = await confirmDelete(
      description,
      t('deleteSelectedTitle', { count: selected.length }),
    );
    if (!confirmed) return;

    setBusyName('__bulk__');
    setError(null);
    try {
      const files = selected.filter((item) => !isFolderItem(item));
      const folders = selected.filter(isFolderItem);
      if (files.length) {
        unwrapStorage(
          await shellui.storage
            .from(bucket)
            .remove(files.map((item) => joinPath(prefix, item.name))),
        );
      }
      for (const folder of folders) {
        unwrapStorage(
          await shellui.storage.from(bucket).removeFolder(joinPath(prefix, folder.name)),
        );
      }
      selection.clear();
      await loadObjects();
    } catch (err) {
      handleApiError(err);
      await loadObjects();
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
      const blob = unwrapStorage(await shellui.storage.from(bucket).download(path));
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

  async function openFolder(item: StorageListItem) {
    if (!bucket || !isFolderItem(item)) return;
    if (item.folder_id && isBrowseFolderId(item.folder_id)) {
      goTo(bucket, item.folder_id);
      return;
    }
    await goToFolderPath(bucket, joinPath(prefix, item.name));
  }

  function openViewer(item: StorageListItem) {
    if (item.id == null || !bucket) return;
    const path = joinPath(prefix, item.name);
    const url = buildViewerModalUrl(bucket, path);
    const hash = `#/viewer?${new URLSearchParams({ bucket, path }).toString()}`;
    if (typeof window !== 'undefined' && window.parent !== window) {
      // Pass via a variable: published @shellui/sdk OpenDrawerOptions (GitHub main)
      // does not yet declare showCloseButton; newer hosts still honor it at runtime.
      const drawerOptions = {
        url,
        position: 'right' as const,
        size: '60vw',
        showCloseButton: false,
      };
      shellui.openDrawer(drawerOptions);
      return;
    }
    window.location.hash = hash;
  }

  function openPermissionsFor(list: StorageListItem[]) {
    if (!bucket || !grantsEnabled || list.length === 0) return;
    const payload = list.map((item) => ({
      path: joinPath(prefix, item.name),
      resourceType: (item.id == null ? 'folder' : 'object') as 'folder' | 'object',
    }));
    const url = buildPermissionsModalUrl(bucket, payload);
    const params = new URLSearchParams({ bucket });
    for (const item of payload) {
      params.append('path', item.path);
      params.append('type', item.resourceType);
    }
    openShelluiOrHash(url, `#/permissions?${params.toString()}`);
  }

  function openPermissions(item: StorageListItem) {
    openPermissionsFor([item]);
  }

  function openShare(item: StorageListItem) {
    if (!bucket || item.id == null || !shareable) return;
    const path = joinPath(prefix, item.name);
    const url = buildShareModalUrl(bucket, path);
    openShelluiOrHash(url, `#/share?${new URLSearchParams({ bucket, path }).toString()}`);
  }

  function openMove(item: StorageListItem) {
    if (!bucket || !canWrite) return;
    const path = joinPath(prefix, item.name);
    const resourceType = item.id == null ? 'folder' : 'object';
    const url = buildMoveModalUrl(bucket, path, resourceType);
    openShelluiOrHash(
      url,
      `#/move?${new URLSearchParams({
        bucket,
        path,
        type: resourceType,
      }).toString()}`,
    );
  }

  function openItem(item: StorageListItem) {
    if (isFolderItem(item)) void openFolder(item);
    else openViewer(item);
  }

  const goUpOneFolder = useCallback(() => {
    if (!prefix) return;
    const parts = prefix.split('/').filter(Boolean);
    parts.pop();
    const parent = parts.join('/');
    if (!parent) goTo(bucket, null);
    else void goToFolderPath(bucket, parent);
  }, [prefix, bucket, goTo, goToFolderPath]);

  const keyboardNav = useListKeyboardNav({
    items: displayItems,
    listingKey: `${bucket}\0${prefix}\0${typeahead.query}`,
    enabled: !renamingName && !creatingFolder,
    onOpen: openItem,
    onDelete: (item) => void handleDelete(item),
    onRename: canWrite
      ? (item) => startRename(item.name, isFolderItem(item))
      : undefined,
    onGoUp: prefix ? goUpOneFolder : undefined,
    selection,
  });

  function actionsForItem(item: StorageListItem): ItemAction[] {
    const isFolder = isFolderItem(item);
    const renaming = renamingName === item.name && renamingIsFolder === isFolder;
    const actions: ItemAction[] = [];
    if (isFolder) {
      actions.push({
        key: 'open',
        label: t('open'),
        icon: <FolderOpen className="h-4 w-4" />,
        onClick: () => void openFolder(item),
      });
      if (canWrite) {
        actions.push({
          key: 'move',
          label: t('moveFolder'),
          icon: <FolderInput className="h-4 w-4" />,
          onClick: () => openMove(item),
        });
      }
    } else {
      actions.push({
        key: 'view',
        label: t('view'),
        icon: <Eye className="h-4 w-4" />,
        onClick: () => openViewer(item),
      });
      actions.push({
        key: 'download',
        label: t('download'),
        icon: <Download className="h-4 w-4" />,
        onClick: () => void handleDownload(item),
      });
      if (shareable) {
        actions.push({
          key: 'share',
          label: t('share'),
          icon: <Link2 className="h-4 w-4" />,
          onClick: () => openShare(item),
        });
      }
      if (canWrite) {
        actions.push({
          key: 'move',
          label: t('moveFile'),
          icon: <FolderInput className="h-4 w-4" />,
          onClick: () => openMove(item),
        });
      }
    }
    if (canWrite) {
      actions.push({
        key: 'rename',
        label: isFolder ? t('renameFolder') : t('renameFile'),
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => startRename(item.name, isFolder),
        disabled: renaming,
      });
    }
    if (grantsEnabled) {
      actions.push({
        key: 'permissions',
        label: t('permissions'),
        icon: <Shield className="h-4 w-4" />,
        onClick: () => openPermissions(item),
      });
    }
    if (canWrite) {
      actions.push({
        key: 'delete',
        label: isFolder ? t('deleteFolder') : t('delete'),
        icon: <Trash2 className="h-4 w-4" />,
        onClick: () => void handleDelete(item),
        destructive: true,
      });
    }
    return actions;
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
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 sm:px-6">
        <h1 className="font-heading text-base font-semibold tracking-tight sm:text-lg">
          {t('appTitle')}
        </h1>
        {selectedBucket ? (
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {selectedBucket.display_name || bucket}
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-sm hover:bg-accent disabled:opacity-40"
            onClick={() => navigate(-1)}
            title={t('goBack')}
            aria-label={t('goBack')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-sm hover:bg-accent disabled:opacity-40"
            onClick={() => navigate(1)}
            title={t('goForward')}
            aria-label={t('goForward')}
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-sm hover:bg-accent"
            onClick={toggleDensity}
            title={t('densityToggle')}
            aria-label={t('densityToggle')}
            aria-pressed={density === 'compact'}
          >
            <Rows3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm hover:bg-accent"
            onClick={() => void loadObjects()}
            disabled={loading}
            title={t('refresh')}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('refresh')}</span>
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm hover:bg-accent disabled:opacity-50"
            onClick={() => setCreatingFolder((v) => !v)}
            disabled={!bucket || !canWrite}
            title={!canWrite ? t('readOnlyLocation') : undefined}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('createFolder')}</span>
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
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
        <div className="flex flex-wrap items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive sm:px-6">
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            className="shrink-0 rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-medium hover:bg-destructive/10"
            onClick={() => {
              setError(null);
              void loadBuckets();
              void loadObjects();
            }}
          >
            {t('retry')}
          </button>
        </div>
      ) : null}

      {!canWrite && bucket ? (
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          {t('readOnlyLocation')}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {showLocations ? (
          <aside className="hidden w-52 shrink-0 border-r border-border bg-muted/30 p-3 md:block">
            <div className="mb-2 text-xs font-medium text-muted-foreground">{t('locations')}</div>
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
                    onClick={() => goTo(b.name, null)}
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
            className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-1 gap-y-1 border-b border-border px-4 py-1.5 text-sm sm:px-6"
            aria-label={t('breadcrumb')}
          >
            {prefix ? (
              <button
                type="button"
                className="mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                title={t('goUp')}
                aria-label={t('goUp')}
                onClick={goUpOneFolder}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            ) : null}
            <BreadcrumbTrail
              crumbs={crumbs}
              onNavigate={(path) => {
                if (!path) goTo(bucket, null);
                else void goToFolderPath(bucket, path);
              }}
              dropTargetKeyForPath={(path) => dropTargetKey('crumb', path)}
              activeDropKey={dropTarget}
              canDropOnCrumb={(path) => canWrite && isValidDestForDrag(path)}
              onCrumbDragOver={(e, path, key) => onDropTargetOver(e, key, path)}
              onCrumbDragLeave={(e, key) => onDropTargetLeave(e, key)}
              onCrumbDrop={(e, path) => void handleDropOnPrefix(e, path)}
            />
            <div className="flex shrink-0 items-center gap-2">
              {!loading && bucket && items.length > 0 ? (
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {t('itemCount', { count: items.length })}
                </span>
              ) : null}
            </div>
          </nav>

          {selection.selectedCount > 0 ? (
            <div className="flex shrink-0 items-center border-b border-border bg-muted/40 px-4 py-1.5 sm:px-6">
              <SelectionToolbar
                  count={selection.selectedCount}
                  canWrite={canWrite}
                  grantsEnabled={grantsEnabled}
                  busy={busyName === '__bulk__'}
                  onClear={selection.clear}
                  onDelete={canWrite ? () => void handleDeleteSelected() : undefined}
                  onPermissions={
                    grantsEnabled ? () => openPermissionsFor(selection.selectedItems) : undefined
                  }
                />
            </div>
          ) : selectedBucket?.access ? (
            <div className="flex shrink-0 items-center border-b border-border px-4 py-1 sm:px-6">
              <span
                className="text-xs text-muted-foreground"
                title={selectedBucket.access.description}
              >
                {t(accessLabelKey(selectedBucket.access.audience))}
              </span>
            </div>
          ) : null}

          <FileFindBar
            query={typeahead.query}
            matchCount={displayItems.length}
            totalCount={sortedItems.length}
            onClear={typeahead.clear}
          />

          <div
            className={`relative min-h-0 flex-1 overflow-auto p-2 transition-colors ${
              dropTarget === dropTargetKey('current', prefix) ? dropHighlightClass : ''
            }`}
            onClick={(e) => {
              if (e.target === e.currentTarget) selection.clear();
            }}
            onDragEnter={
              canWrite
                ? (e) => {
                    if (isInternalFileDrag(e.dataTransfer)) return;
                    if (e.dataTransfer?.types.includes('Files')) {
                      externalDragDepthRef.current += 1;
                      setExternalFileDrag(true);
                    }
                  }
                : undefined
            }
            onDragOver={canWrite ? onListDragOver : undefined}
            onDragLeave={
              canWrite
                ? (e) => {
                    onListDragLeave(e);
                    if (isInternalFileDrag(e.dataTransfer)) return;
                    externalDragDepthRef.current = Math.max(
                      0,
                      externalDragDepthRef.current - 1,
                    );
                    if (externalDragDepthRef.current === 0) setExternalFileDrag(false);
                  }
                : undefined
            }
            onDrop={
              canWrite
                ? (e) => {
                    externalDragDepthRef.current = 0;
                    setExternalFileDrag(false);
                    void onListDrop(e);
                  }
                : undefined
            }
          >
            <DropUploadOverlay visible={externalFileDrag && canWrite} />
            {bucketsLoading ? (
              <div className="flex min-h-[12rem] items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <RefreshCw
                  className="h-4 w-4 animate-spin"
                  aria-hidden
                />
                {t('loading')}
              </div>
            ) : !bucket && !error ? (
              <p className="p-4 text-sm text-muted-foreground">{t('emptyBuckets')}</p>
            ) : bucket ? (
              <FileList
                items={displayItems}
                prefix={prefix}
                loading={loading}
                selection={selection}
                onOpen={openItem}
                sort={sort}
                onSortField={(field) => setSort((current) => toggleSortField(current, field))}
                focusIndex={keyboardNav.focusIndex}
                onRowFocus={keyboardNav.focusItem}
                stickyHeader
                density={density}
                busyName={busyName}
                renamingName={renamingName}
                renamingIsFolder={renamingIsFolder}
                accessFallbackAudience={selectedBucket?.access?.audience}
                accessFallbackDescription={selectedBucket?.access?.description}
                empty={
                  typeahead.query ? (
                    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 p-8 text-center">
                      <p className="text-sm font-medium">{t('findNoMatches')}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('findMatchCount', { match: 0, total: sortedItems.length })}
                      </p>
                      <button
                        type="button"
                        className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                        onClick={typeahead.clear}
                      >
                        {t('findClear')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex min-h-[14rem] flex-col items-center justify-center gap-3 p-8 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                        <FolderOpen className="h-7 w-7 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t('emptyBucket')}</p>
                        {canWrite ? (
                          <p className="mt-1 text-xs text-muted-foreground">{t('dropUploadHint')}</p>
                        ) : null}
                      </div>
                      {canWrite ? (
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {t('upload')}
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                            onClick={() => setCreatingFolder(true)}
                          >
                            {t('createFolder')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )
                }
                dnd={
                  canWrite
                    ? {
                        enabled: true,
                        draggingItems,
                        dropTarget,
                        onItemDragStart,
                        onItemDragEnd,
                        onFolderDragOver: (e, folderPath) => {
                          onDropTargetOver(e, dropTargetKey('folder', folderPath), folderPath);
                        },
                        onFolderDragLeave: (e, folderPath) => {
                          onDropTargetLeave(e, dropTargetKey('folder', folderPath));
                        },
                        onFolderDrop: (e, folderPath) => {
                          void handleDropOnPrefix(e, folderPath);
                        },
                      }
                    : undefined
                }
                renderName={(_item, ctx) => (
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {ctx.isFolder ? (
                      <Folder className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <input
                      className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRename();
                        if (e.key === 'Escape') cancelRename();
                      }}
                      autoFocus
                      disabled={ctx.busy}
                    />
                    <button
                      type="button"
                      className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                      onClick={() => void handleRename()}
                      disabled={ctx.busy}
                    >
                      {t('renameSave')}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-xs"
                      onClick={cancelRename}
                      disabled={ctx.busy}
                    >
                      {t('cancel')}
                    </button>
                  </div>
                )}
                renderActions={(item, ctx) => (
                  <ItemActions
                    actions={actionsForItem(item)}
                    busy={ctx.busy}
                  />
                )}
              />
            ) : null}
          </div>
        </main>
      </div>
      <KeyboardHintsFooter />
    </div>
  );
}
