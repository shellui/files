import { useEffect, useRef, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, File as FileIcon, Folder } from 'lucide-react';
import type { ListDensity } from '@/hooks/useListDensity';
import type { SortField, SortState } from '@/lib/listSort';
import type { FileSelection } from '@/hooks/useFileSelection';
import { accessRowLabel } from '@/lib/accessLabel';
import { dropTargetKey, type DragItemPayload } from '@/lib/dnd';
import { fileItemKey, isFolderItem } from '@/lib/fileSelection';
import { formatBytes, joinPath } from '@/lib/format';
import type { StorageListItem } from '@/lib/storageApi';

/** Used on breadcrumbs and the listing pane (not table rows). */
export const dropHighlightClass = 'bg-primary/10 ring-1 ring-inset ring-primary/35';

export type FileListColumns = {
  access?: boolean;
  type?: boolean;
  size?: boolean;
  modified?: boolean;
  actions?: boolean;
};

export type FileListDnd = {
  enabled: boolean;
  draggingItems: DragItemPayload[] | null;
  dropTarget: string | null;
  onItemDragStart: (e: DragEvent<HTMLTableRowElement>, item: StorageListItem) => void;
  onItemDragEnd: () => void;
  onFolderDragOver: (e: DragEvent<HTMLTableRowElement>, folderPath: string) => void;
  onFolderDragLeave: (e: DragEvent<HTMLTableRowElement>, folderPath: string) => void;
  onFolderDrop: (e: DragEvent<HTMLTableRowElement>, folderPath: string) => void;
};

export type FileListNameContext = {
  isFolder: boolean;
  path: string;
  busy: boolean;
  selected: boolean;
  renaming: boolean;
};

export type FileListProps = {
  items: StorageListItem[];
  prefix: string;
  loading?: boolean;
  empty?: ReactNode;
  selection: FileSelection;
  onOpen: (item: StorageListItem) => void;
  columns?: FileListColumns;
  renderName?: (item: StorageListItem, ctx: FileListNameContext) => ReactNode;
  renderActions?: (item: StorageListItem, ctx: { busy: boolean }) => ReactNode;
  dnd?: FileListDnd;
  busyName?: string | null;
  accessFallbackAudience?: string;
  accessFallbackDescription?: string;
  /** Disable row drag while this item is being renamed. */
  renamingName?: string | null;
  renamingIsFolder?: boolean;
  /** When set, only these items show a checkbox / participate in select-all. */
  canSelectItem?: (item: StorageListItem) => boolean;
  sort?: SortState;
  onSortField?: (field: SortField) => void;
  focusIndex?: number;
  onRowFocus?: (index: number) => void;
  stickyHeader?: boolean;
  density?: ListDensity;
};

function modifierSelectEvent(e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) {
  return {
    additive: e.metaKey || e.ctrlKey,
    range: e.shiftKey,
  };
}

const SKELETON_ROW_COUNT = 8;

function SkeletonBar({ className }: { className?: string }) {
  return (
    <span
      className={`block animate-pulse rounded-md bg-muted ${className ?? ''}`}
      aria-hidden
    />
  );
}

type FileListHeaderProps = {
  loading: boolean;
  canSelect: boolean;
  selectionMode: FileSelection['mode'];
  showAccess: boolean;
  showType: boolean;
  showSize: boolean;
  showModified: boolean;
  showActions: boolean;
  allSelectableSelected: boolean;
  someSelectableSelected: boolean;
  onToggleSelectAll: () => void;
  sort?: SortState;
  onSortField?: (field: SortField) => void;
  stickyHeader?: boolean;
};

function SortHeaderButton({
  field,
  label,
  sort,
  onSortField,
}: {
  field: SortField;
  label: string;
  sort?: SortState;
  onSortField?: (field: SortField) => void;
}) {
  const active = sort?.field === field;
  const Icon = sort?.direction === 'desc' ? ArrowDown : ArrowUp;
  if (!onSortField) {
    return <span>{label}</span>;
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 -mx-1 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? 'text-foreground' : ''
      }`}
      onClick={() => onSortField(field)}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      {active ? (
        <Icon
          className="h-3 w-3 shrink-0"
          aria-hidden
        />
      ) : null}
    </button>
  );
}

function FileListHeader({
  loading,
  canSelect,
  selectionMode,
  showAccess,
  showType,
  showSize,
  showModified,
  showActions,
  allSelectableSelected,
  someSelectableSelected,
  onToggleSelectAll,
  sort,
  onSortField,
  stickyHeader,
}: FileListHeaderProps) {
  const { t } = useTranslation();

  return (
    <thead
      className={`text-xs text-muted-foreground ${stickyHeader ? 'file-list-sticky-head' : ''} ${loading ? 'pointer-events-none opacity-50' : ''}`}
    >
      <tr className="file-list-row">
        {canSelect ? (
          <th className="w-10 px-2 py-2 align-middle font-medium">
            {selectionMode === 'multiple' ? (
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={allSelectableSelected}
                disabled={loading}
                ref={(el) => {
                  if (el) el.indeterminate = someSelectableSelected;
                }}
                onChange={onToggleSelectAll}
                aria-label={t('selectAll')}
                title={t('selectAll')}
              />
            ) : (
              <span className="sr-only">{t('select')}</span>
            )}
          </th>
        ) : null}
        <th className="w-full max-w-0 px-3 py-2 font-medium tracking-wide">
          <SortHeaderButton
            field="name"
            label={t('name')}
            sort={sort}
            onSortField={onSortField}
          />
        </th>
        {showAccess ? (
          <th className="hidden whitespace-nowrap px-3 py-2 font-medium tracking-wide lg:table-cell">
            {t('access')}
          </th>
        ) : null}
        {showType ? (
          <th className="hidden whitespace-nowrap px-3 py-2 font-medium tracking-wide xl:table-cell">
            <SortHeaderButton
              field="type"
              label={t('type')}
              sort={sort}
              onSortField={onSortField}
            />
          </th>
        ) : null}
        {showSize ? (
          <th className="hidden whitespace-nowrap px-3 py-2 font-medium tracking-wide md:table-cell">
            <SortHeaderButton
              field="size"
              label={t('size')}
              sort={sort}
              onSortField={onSortField}
            />
          </th>
        ) : null}
        {showModified ? (
          <th className="hidden whitespace-nowrap px-3 py-2 font-medium tracking-wide lg:table-cell">
            <SortHeaderButton
              field="modified"
              label={t('modified')}
              sort={sort}
              onSortField={onSortField}
            />
          </th>
        ) : null}
        {showActions ? (
          <th className="whitespace-nowrap px-2 py-2 text-right font-medium 2xl:px-3">
            <span className="sr-only 2xl:not-sr-only">{t('actions')}</span>
          </th>
        ) : null}
      </tr>
    </thead>
  );
}

type FileListSkeletonBodyProps = {
  rowCount: number;
  canSelect: boolean;
  showAccess: boolean;
  showType: boolean;
  showSize: boolean;
  showModified: boolean;
  showActions: boolean;
  loadingLabel: string;
};

function FileListSkeletonBody({
  rowCount,
  canSelect,
  showAccess,
  showType,
  showSize,
  showModified,
  showActions,
  loadingLabel,
}: FileListSkeletonBodyProps) {
  const nameWidths = ['max-w-[9rem]', 'max-w-[14rem]', 'max-w-[11rem]'];

  return (
    <tbody
      aria-busy="true"
      aria-label={loadingLabel}
    >
      {Array.from({ length: rowCount }, (_, index) => (
        <tr
          key={index}
          className="file-list-row"
          aria-hidden
        >
          {canSelect ? (
            <td className="w-10 border-l-2 border-l-transparent px-2 py-2 align-middle">
              <SkeletonBar className="mx-auto h-4 w-4 rounded-sm" />
            </td>
          ) : null}
          <td className="max-w-0 w-full min-w-0 px-3 py-2">
            <div className="flex items-center gap-2">
              <SkeletonBar className="h-4 w-4 shrink-0 rounded-sm" />
              <SkeletonBar className={`h-4 flex-1 ${nameWidths[index % nameWidths.length]}`} />
            </div>
          </td>
          {showAccess ? (
            <td className="hidden px-3 py-2 lg:table-cell">
              <SkeletonBar className="h-4 w-16" />
            </td>
          ) : null}
          {showType ? (
            <td className="hidden px-3 py-2 xl:table-cell">
              <SkeletonBar className="h-4 w-24" />
            </td>
          ) : null}
          {showSize ? (
            <td className="hidden px-3 py-2 md:table-cell">
              <SkeletonBar className="h-4 w-12" />
            </td>
          ) : null}
          {showModified ? (
            <td className="hidden px-3 py-2 lg:table-cell">
              <SkeletonBar className="h-4 w-28" />
            </td>
          ) : null}
          {showActions ? (
            <td className="px-2 py-2 2xl:px-3">
              <SkeletonBar className="ml-auto h-4 w-8" />
            </td>
          ) : null}
        </tr>
      ))}
    </tbody>
  );
}

/**
 * Shared file table with checkbox multi-select. FileManager and the storage
 * picker modal both render this so selection / highlight stay consistent.
 */
export function FileList({
  items,
  prefix,
  loading = false,
  empty,
  selection,
  onOpen,
  columns,
  renderName,
  renderActions,
  dnd,
  busyName,
  accessFallbackAudience,
  accessFallbackDescription,
  renamingName,
  renamingIsFolder,
  canSelectItem,
  sort,
  onSortField,
  focusIndex = -1,
  onRowFocus,
  stickyHeader = false,
  density = 'comfortable',
}: FileListProps) {
  const { t } = useTranslation();
  const compact = density === 'compact';
  const cellPy = compact ? 'py-1' : 'py-2';
  const tableText = compact ? 'text-xs' : 'text-sm';
  const suppressClickRef = useRef(false);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    if (focusIndex < 0 || !tbodyRef.current) return;
    const row = tbodyRef.current.querySelector<HTMLElement>(`tr[data-row-index="${focusIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);
  const showAccess = columns?.access !== false;
  const showType = columns?.type !== false;
  const showSize = columns?.size !== false;
  const showModified = columns?.modified !== false;
  const showActions = columns?.actions !== false && Boolean(renderActions);
  const canSelect = selection.mode !== 'none';
  const draggingPaths = new Set((dnd?.draggingItems ?? []).map((item) => item.path));
  const selectableItems = canSelectItem ? items.filter(canSelectItem) : items;
  const allSelectableSelected =
    selectableItems.length > 0 && selectableItems.every((item) => selection.isSelected(item));
  const someSelectableSelected =
    selectableItems.some((item) => selection.isSelected(item)) && !allSelectableSelected;

  useEffect(() => {
    function resetClickSuppress() {
      suppressClickRef.current = false;
    }
    document.addEventListener('dragend', resetClickSuppress, true);
    document.addEventListener('drop', resetClickSuppress, true);
    return () => {
      document.removeEventListener('dragend', resetClickSuppress, true);
      document.removeEventListener('drop', resetClickSuppress, true);
    };
  }, []);

  const showSkeleton = loading && items.length === 0;

  if (!loading && items.length === 0) {
    return empty ?? null;
  }

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      for (const item of selectableItems) {
        if (selection.isSelected(item)) selection.toggle(item);
      }
    } else {
      selection.selectAll();
    }
  };

  return (
    <table
      className={`w-full border-separate border-spacing-0 select-none text-left ${tableText}`}
      aria-multiselectable={canSelect}
      aria-busy={loading || undefined}
    >
      <FileListHeader
        loading={showSkeleton}
        canSelect={canSelect}
        selectionMode={selection.mode}
        showAccess={showAccess}
        showType={showType}
        showSize={showSize}
        showModified={showModified}
        showActions={showActions}
        allSelectableSelected={allSelectableSelected}
        someSelectableSelected={someSelectableSelected}
        onToggleSelectAll={toggleSelectAll}
        sort={sort}
        onSortField={onSortField}
        stickyHeader={stickyHeader}
      />
      {showSkeleton ? (
        <FileListSkeletonBody
          rowCount={SKELETON_ROW_COUNT}
          canSelect={canSelect}
          showAccess={showAccess}
          showType={showType}
          showSize={showSize}
          showModified={showModified}
          showActions={showActions}
          loadingLabel={t('loading')}
        />
      ) : (
        <tbody
          ref={tbodyRef}
          className={loading && items.length > 0 ? 'opacity-60' : undefined}
          aria-busy={loading || undefined}
        >
          {items.map((item, rowIndex) => {
            const isFolder = isFolderItem(item);
            const path = joinPath(prefix, item.name);
            const busy = busyName === path || busyName === '__bulk__';
            const selected = selection.isSelected(item);
            const renaming = renamingName === item.name && renamingIsFolder === isFolder;
            const folderDropActive =
              Boolean(dnd?.enabled) &&
              isFolder &&
              dnd?.dropTarget === dropTargetKey('folder', path) &&
              !draggingPaths.has(path);
            const rowDragging = draggingPaths.has(path);
            const canDrag = Boolean(dnd?.enabled) && !renaming;

            const itemSelectable = canSelectItem ? canSelectItem(item) : true;
            const rowFocused = focusIndex === rowIndex;

            return (
              <tr
                key={fileItemKey(item)}
                aria-selected={selected}
                data-row-index={rowIndex}
                className={`file-list-row ${selected ? 'file-list-row-selected' : ''} ${
                  rowFocused ? 'file-list-row-focus' : ''
                } ${folderDropActive ? 'file-list-row-drop' : ''} ${rowDragging ? 'opacity-50' : ''} ${
                  canDrag
                    ? 'cursor-grab active:cursor-grabbing'
                    : canSelect && itemSelectable
                      ? 'cursor-pointer'
                      : ''
                }`}
                draggable={canDrag}
                onClick={(e) => {
                  if (suppressClickRef.current) return;
                  const target = e.target as HTMLElement;
                  if (target.closest('button, a, input, label, [data-no-select]')) return;
                  onRowFocus?.(rowIndex);
                  if (canSelect && itemSelectable) {
                    selection.select(item, modifierSelectEvent(e));
                    return;
                  }
                  if (isFolder) onOpen(item);
                }}
                onDoubleClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('button, a, input, label, [data-no-select]')) return;
                  e.preventDefault();
                  onOpen(item);
                }}
                onDragStart={
                  dnd?.enabled && !renaming
                    ? (e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('input, button, a')) {
                          e.preventDefault();
                          return;
                        }
                        suppressClickRef.current = true;
                        dnd.onItemDragStart(e, item);
                      }
                    : undefined
                }
                onDragEnd={
                  dnd?.enabled && !renaming
                    ? () => {
                        dnd.onItemDragEnd();
                        window.setTimeout(() => {
                          suppressClickRef.current = false;
                        }, 0);
                      }
                    : undefined
                }
                onDragOver={
                  dnd?.enabled && isFolder
                    ? (e) => {
                        e.stopPropagation();
                        dnd.onFolderDragOver(e, path);
                      }
                    : undefined
                }
                onDragLeave={
                  dnd?.enabled && isFolder ? (e) => dnd.onFolderDragLeave(e, path) : undefined
                }
                onDrop={
                  dnd?.enabled && isFolder
                    ? (e) => {
                        e.stopPropagation();
                        dnd.onFolderDrop(e, path);
                      }
                    : undefined
                }
              >
                {canSelect ? (
                  <td
                    className={`w-10 overflow-hidden p-0 align-middle ${
                      selected ? 'border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'
                    }`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {itemSelectable ? (
                      <label className="flex min-h-10 cursor-pointer items-center justify-center px-2 py-2">
                        <input
                          type="checkbox"
                          draggable={false}
                          className="h-4 w-4 shrink-0 accent-primary"
                          checked={selected}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            selection.select(item, {
                              additive: true,
                              range: (e.nativeEvent as MouseEvent).shiftKey,
                            });
                          }}
                          aria-label={t('selectItem', { name: item.name })}
                        />
                      </label>
                    ) : (
                      <span className="block min-h-10" />
                    )}
                  </td>
                ) : null}
                <td className={`max-w-0 w-full min-w-0 overflow-hidden px-3 ${cellPy}`}>
                  {renaming && renderName ? (
                    renderName(item, { isFolder, path, busy, selected, renaming })
                  ) : (
                    <button
                      type="button"
                      className={`flex w-full min-w-0 items-center gap-2 text-left ${
                        selected ? 'font-medium' : ''
                      }`}
                      title={item.name}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey) {
                          e.preventDefault();
                          selection.select(item, modifierSelectEvent(e));
                          return;
                        }
                        onOpen(item);
                      }}
                    >
                      {isFolder ? (
                        <Folder className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{item.name}</span>
                    </button>
                  )}
                </td>
                {showAccess ? (
                  <td className="hidden whitespace-nowrap px-3 py-2 text-muted-foreground lg:table-cell">
                    <span title={item.access?.description || accessFallbackDescription}>
                      {accessRowLabel(item.access, accessFallbackAudience, t)}
                    </span>
                  </td>
                ) : null}
                {showType ? (
                  <td className="hidden max-w-[14rem] truncate px-3 py-2 text-muted-foreground xl:table-cell">
                    <span
                      className="block truncate"
                      title={isFolder ? t('folder') : item.metadata?.mimetype || t('file')}
                    >
                      {isFolder ? t('folder') : item.metadata?.mimetype || t('file')}
                    </span>
                  </td>
                ) : null}
                {showSize ? (
                  <td className="hidden whitespace-nowrap px-3 py-2 text-muted-foreground md:table-cell">
                    {isFolder ? '—' : formatBytes(item.metadata?.size)}
                  </td>
                ) : null}
                {showModified ? (
                  <td className="hidden whitespace-nowrap px-3 py-2 text-muted-foreground lg:table-cell">
                    {item.updated_at
                      ? new Date(item.updated_at).toLocaleString()
                      : item.metadata?.lastModified
                        ? new Date(item.metadata.lastModified).toLocaleString()
                        : '—'}
                  </td>
                ) : null}
                {showActions ? (
                  <td
                    className="whitespace-nowrap px-2 py-2 align-middle 2xl:px-3"
                    data-no-select
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderActions?.(item, { busy })}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      )}
    </table>
  );
}
