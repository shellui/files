import { useRef, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { File as FileIcon, Folder, Loader2 } from 'lucide-react';
import type { FileSelection } from '@/hooks/useFileSelection';
import { accessRowLabel } from '@/lib/accessLabel';
import { dropTargetKey, type DragItemPayload } from '@/lib/dnd';
import { fileItemKey, isFolderItem } from '@/lib/fileSelection';
import { formatBytes, joinPath } from '@/lib/format';
import type { StorageListItem } from '@/lib/storageApi';

/** Used on breadcrumbs and the listing pane (not table rows). */
export const dropHighlightClass = 'bg-primary/10 ring-1 ring-inset ring-primary/35';
/** Backgrounds on `<td>` — collapsed tables paint row box-shadow on the next row. */
const dropRowClass = 'bg-primary/10 [&>td]:bg-primary/10';
const selectedRowClass = 'bg-primary/15 [&>td]:bg-primary/15';

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

type FileListProps = {
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
};

function modifierSelectEvent(e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) {
  return {
    additive: e.metaKey || e.ctrlKey,
    range: e.shiftKey,
  };
}

/**
 * Shared file table with checkbox multi-select. FileManager and a future
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
}: FileListProps) {
  const { t } = useTranslation();
  const suppressClickRef = useRef(false);
  const showAccess = columns?.access !== false;
  const showType = columns?.type !== false;
  const showSize = columns?.size !== false;
  const showModified = columns?.modified !== false;
  const showActions = columns?.actions !== false && Boolean(renderActions);
  const canSelect = selection.mode !== 'none';
  const draggingPaths = new Set((dnd?.draggingItems ?? []).map((item) => item.path));

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  if (items.length === 0) {
    return empty ?? null;
  }

  return (
    <table
      className="w-full border-separate border-spacing-0 select-none text-left text-sm"
      aria-multiselectable={canSelect}
    >
      <thead className="text-xs uppercase text-muted-foreground">
        <tr className="[&>th]:border-b [&>th]:border-border">
          {canSelect ? (
            <th className="w-10 px-2 py-2 align-middle font-medium">
              {selection.mode === 'multiple' ? (
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={selection.allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = selection.someSelected;
                  }}
                  onChange={() => {
                    if (selection.allSelected) selection.clear();
                    else selection.selectAll();
                  }}
                  aria-label={t('selectAll')}
                  title={t('selectAll')}
                />
              ) : (
                <span className="sr-only">{t('select')}</span>
              )}
            </th>
          ) : null}
          <th className="w-full max-w-0 px-3 py-2 font-medium">{t('name')}</th>
          {showAccess ? (
            <th className="hidden whitespace-nowrap px-3 py-2 font-medium lg:table-cell">
              {t('access')}
            </th>
          ) : null}
          {showType ? (
            <th className="hidden whitespace-nowrap px-3 py-2 font-medium xl:table-cell">
              {t('type')}
            </th>
          ) : null}
          {showSize ? (
            <th className="hidden whitespace-nowrap px-3 py-2 font-medium md:table-cell">
              {t('size')}
            </th>
          ) : null}
          {showModified ? (
            <th className="hidden whitespace-nowrap px-3 py-2 font-medium lg:table-cell">
              {t('modified')}
            </th>
          ) : null}
          {showActions ? (
            <th className="whitespace-nowrap px-2 py-2 text-right font-medium 2xl:px-3">
              <span className="sr-only 2xl:not-sr-only">{t('actions')}</span>
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const isFolder = isFolderItem(item);
          const path = joinPath(prefix, item.name);
          const busy = busyName === path || busyName === '__bulk__';
          const selected = selection.isSelected(item);
          const renaming =
            renamingName === item.name && renamingIsFolder === isFolder;
          const folderDropActive =
            Boolean(dnd?.enabled) &&
            isFolder &&
            dnd?.dropTarget === dropTargetKey('folder', path) &&
            !draggingPaths.has(path);
          const rowDragging = draggingPaths.has(path);
          const canDrag = Boolean(dnd?.enabled) && !renaming;

          return (
            <tr
              key={fileItemKey(item)}
              aria-selected={selected}
              className={`[&>td]:border-b [&>td]:border-border/70 ${
                selected ? selectedRowClass : 'hover:bg-muted/60 [&>td]:hover:bg-muted/60'
              } ${folderDropActive ? dropRowClass : ''} ${
                rowDragging ? 'opacity-50' : ''
              } ${canDrag ? 'cursor-grab active:cursor-grabbing' : canSelect ? 'cursor-pointer' : ''}`}
              draggable={canDrag}
              onClick={(e) => {
                if (!canSelect || suppressClickRef.current) return;
                const target = e.target as HTMLElement;
                if (target.closest('button, a, input, label, [data-no-select]')) return;
                selection.select(item, modifierSelectEvent(e));
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
                dnd?.enabled && isFolder
                  ? (e) => dnd.onFolderDragLeave(e, path)
                  : undefined
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
                </td>
              ) : null}
              <td className="max-w-0 w-full min-w-0 overflow-hidden px-3 py-2">
                {renaming && renderName ? (
                  renderName(item, { isFolder, path, busy, selected, renaming })
                ) : (
                  <button
                    type="button"
                    className={`flex w-full min-w-0 items-center gap-2 text-left hover:underline ${
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
    </table>
  );
}
