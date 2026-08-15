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

/** Inline bulk actions for the breadcrumb row. */
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
    <div
      className="flex items-center gap-1"
      role="toolbar"
      aria-label={t('selectedCount', { count })}
    >
      <span className="whitespace-nowrap px-1.5 text-xs font-medium text-muted-foreground">
        {t('selectedCount', { count })}
      </span>
      {grantsEnabled && onPermissions ? (
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm hover:bg-muted disabled:opacity-50"
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
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          onClick={onDelete}
          disabled={busy}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('delete')}
        </button>
      ) : null}
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50"
        onClick={onClear}
        disabled={busy}
        title={t('clearSelection')}
        aria-label={t('clearSelection')}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
