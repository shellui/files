import { ChevronRight, Folder, MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { dropHighlightClass } from '@/components/FileList';

export type BreadcrumbCrumb = {
  label: string;
  path: string;
};

type BreadcrumbTrailProps = {
  crumbs: BreadcrumbCrumb[];
  onNavigate: (path: string) => void;
  dropTargetKeyForPath?: (path: string) => string | null;
  activeDropKey?: string | null;
  canDropOnCrumb?: (path: string) => boolean;
  onCrumbDragOver?: (e: React.DragEvent, path: string, key: string) => void;
  onCrumbDragLeave?: (e: React.DragEvent, key: string) => void;
  onCrumbDrop?: (e: React.DragEvent, path: string) => void;
};

const MAX_VISIBLE = 4;

function CrumbButton({
  crumb,
  index,
  isLast,
  active,
  acceptsDrop,
  onNavigate,
  onCrumbDragOver,
  onCrumbDragLeave,
  onCrumbDrop,
  dropKey,
}: {
  crumb: BreadcrumbCrumb;
  index: number;
  isLast: boolean;
  active: boolean;
  acceptsDrop: boolean;
  onNavigate: (path: string) => void;
  onCrumbDragOver?: (e: React.DragEvent, path: string, key: string) => void;
  onCrumbDragLeave?: (e: React.DragEvent, key: string) => void;
  onCrumbDrop?: (e: React.DragEvent, path: string) => void;
  dropKey: string | null;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {index > 0 ? (
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : (
        <Folder
          className="mr-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      )}
      <button
        type="button"
        className={`max-w-[10rem] truncate rounded px-1.5 py-0.5 hover:bg-muted sm:max-w-[14rem] ${
          isLast ? 'font-medium text-foreground' : 'text-muted-foreground'
        } ${active ? dropHighlightClass : ''}`}
        onClick={() => onNavigate(crumb.path)}
        aria-current={isLast ? 'location' : undefined}
        title={crumb.label}
        onDragOver={
          acceptsDrop && dropKey && onCrumbDragOver
            ? (e) => onCrumbDragOver(e, crumb.path, dropKey)
            : undefined
        }
        onDragLeave={
          acceptsDrop && dropKey && onCrumbDragLeave
            ? (e) => onCrumbDragLeave(e, dropKey)
            : undefined
        }
        onDrop={
          acceptsDrop && onCrumbDrop ? (e) => void onCrumbDrop(e, crumb.path) : undefined
        }
      >
        {crumb.label}
      </button>
    </span>
  );
}

/** Breadcrumbs with middle collapse when the path is deep. */
export function BreadcrumbTrail({
  crumbs,
  onNavigate,
  dropTargetKeyForPath,
  activeDropKey,
  canDropOnCrumb,
  onCrumbDragOver,
  onCrumbDragLeave,
  onCrumbDrop,
}: BreadcrumbTrailProps) {
  const { t } = useTranslation();

  let visible: { crumb: BreadcrumbCrumb; index: number }[];
  let showEllipsis = false;

  if (crumbs.length <= MAX_VISIBLE) {
    visible = crumbs.map((crumb, index) => ({ crumb, index }));
  } else {
    showEllipsis = true;
    const tail = crumbs.slice(-2);
    visible = [
      { crumb: crumbs[0], index: 0 },
      ...tail.map((crumb, i) => ({ crumb, index: crumbs.length - 2 + i })),
    ];
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {visible.map(({ crumb, index }, pos) => (
        <span
          key={`${crumb.path}-${index}`}
          className="contents"
        >
          {showEllipsis && pos === 1 ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-muted-foreground"
              title={t('pathCollapsed')}
            >
              <ChevronRight
                className="h-3.5 w-3.5"
                aria-hidden
              />
              <MoreHorizontal
                className="h-4 w-4"
                aria-hidden
              />
              <ChevronRight
                className="h-3.5 w-3.5"
                aria-hidden
              />
            </span>
          ) : null}
          <CrumbButton
            crumb={crumb}
            index={index}
            isLast={index === crumbs.length - 1}
            active={Boolean(
              dropTargetKeyForPath &&
                activeDropKey &&
                dropTargetKeyForPath(crumb.path) === activeDropKey,
            )}
            acceptsDrop={canDropOnCrumb?.(crumb.path) ?? false}
            onNavigate={onNavigate}
            onCrumbDragOver={onCrumbDragOver}
            onCrumbDragLeave={onCrumbDragLeave}
            onCrumbDrop={onCrumbDrop}
            dropKey={dropTargetKeyForPath?.(crumb.path) ?? null}
          />
        </span>
      ))}
    </div>
  );
}
