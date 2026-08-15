import { Shield, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type SelectionToolbarProps = {
  count: number;
  canWrite: boolean;
  grantsEnabled: boolean;
  busy?: boolean;
  onClear: () => void;
  onDelete?: () => void;
  onPermissions?: () => void;
};

/** Compact bulk-actions bar, overlaid at the bottom so the listing does not jump. */
export function SelectionToolbar({
  count,
  canWrite,
  grantsEnabled,
  busy = false,
  onClear,
  onDelete,
  onPermissions,
}: SelectionToolbarProps) {
  const { t } = useTranslation();
  if (count <= 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-3">
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 py-1 pl-3 pr-1 shadow-lg backdrop-blur-sm"
        role="toolbar"
        aria-label={t('selectedCount', { count })}
      >
        <span className="pr-2 text-xs font-medium text-muted-foreground">
          {t('selectedCount', { count })}
        </span>
        {grantsEnabled && onPermissions ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
            onClick={onPermissions}
            disabled={busy}
          >
            <Shield className="h-3.5 w-3.5" />
            {t('permissions')}
          </button>
        ) : null}
        {canWrite && onDelete ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
            onClick={onDelete}
            disabled={busy}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('delete')}
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
          onClick={onClear}
          disabled={busy}
          title={t('clearSelection')}
          aria-label={t('clearSelection')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
