import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal } from 'lucide-react';

export type ItemAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

type ItemActionsProps = {
  actions: ItemAction[];
  busy?: boolean;
};

/** Icon toolbar on 2xl+; compact ⋯ menu below that. */
export function ItemActions({ actions, busy = false }: ItemActionsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div className="flex justify-end">
      <div className="relative 2xl:hidden" ref={rootRef}>
        <button
          type="button"
          className="rounded p-1.5 hover:bg-muted disabled:opacity-50"
          title={t('moreActions')}
          aria-label={t('moreActions')}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          disabled={busy}
          onClick={() => setOpen((value) => !value)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {open ? (
          <div
            id={menuId}
            role="menu"
            className="absolute right-0 z-30 mt-1 min-w-[11rem] rounded-md border border-border bg-card py-1 shadow-lg"
          >
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50 ${
                  action.destructive ? 'text-destructive' : ''
                }`}
                disabled={busy || action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
              >
                <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="hidden shrink-0 items-center justify-end gap-1 2xl:flex">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={`shrink-0 rounded p-1.5 hover:bg-muted disabled:opacity-50 ${
              action.destructive ? 'text-destructive' : ''
            }`}
            title={action.label}
            aria-label={action.label}
            disabled={busy || action.disabled}
            onClick={action.onClick}
          >
            {action.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
