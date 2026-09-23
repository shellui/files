import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type FileFindBarProps = {
  query: string;
  matchCount: number;
  totalCount: number;
  onClear: () => void;
};

export function FileFindBar({ query, matchCount, totalCount, onClear }: FileFindBarProps) {
  const { t } = useTranslation();
  if (!query) return null;

  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/50 px-4 py-1.5 text-sm sm:px-6"
      role="status"
    >
      <Search
        className="h-3.5 w-3.5 text-muted-foreground"
        aria-hidden
      />
      <span className="font-medium">{query}</span>
      <span className="text-xs text-muted-foreground">
        {matchCount === 0
          ? t('findNoMatches')
          : t('findMatchCount', { match: matchCount, total: totalCount })}
      </span>
      <button
        type="button"
        className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        onClick={onClear}
        aria-label={t('findClear')}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
