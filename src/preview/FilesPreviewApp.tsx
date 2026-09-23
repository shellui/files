import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { FileList } from '@/components/FileList';
import { BreadcrumbTrail } from '@/components/BreadcrumbTrail';
import { KeyboardHintsFooter } from '@/components/KeyboardHintsFooter';
import { useFileSelection } from '@/hooks/useFileSelection';
import { useListDensity } from '@/hooks/useListDensity';
import { useTranslation } from 'react-i18next';
import { demoItems } from '@/preview/mockStorage';
import { sortListItems, toggleSortField, type SortState } from '@/lib/listSort';
import { useMemo, useState } from 'react';
import { RefreshCw, Rows3, Upload } from 'lucide-react';

/** Dev-only static preview of the file manager chrome (no live storage). */
export function FilesPreviewApp() {
  const { t } = useTranslation();
  const [sort, setSort] = useState<SortState>({ field: 'name', direction: 'asc' });
  const { density, toggle: toggleDensity } = useListDensity();
  const sorted = useMemo(() => sortListItems(demoItems, sort), [sort]);
  const selection = useFileSelection({
    items: sorted,
    listingKey: 'preview',
    mode: 'multiple',
  });

  const crumbs = [
    { label: 'Company files', path: '' },
    { label: 'Projects', path: 'Projects' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5 sm:px-6">
        <h1 className="font-heading text-base font-semibold tracking-tight sm:text-lg">
          {t('appTitle')}
        </h1>
        <span className="hidden text-sm text-muted-foreground sm:inline">Company files</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-2.5"
            onClick={toggleDensity}
            aria-label={t('densityToggle')}
          >
            <Rows3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('refresh')}</span>
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
          >
            <Upload className="h-3.5 w-3.5" />
            {t('upload')}
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <nav className="flex min-h-10 shrink-0 items-center gap-1 border-b border-border px-4 py-1.5 sm:px-6">
          <BreadcrumbTrail
            crumbs={crumbs}
            onNavigate={() => undefined}
          />
          <span className="ml-auto text-xs text-muted-foreground">
            {t('itemCount', { count: sorted.length })}
          </span>
        </nav>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          <FileList
            items={sorted}
            prefix="Projects"
            selection={selection}
            onOpen={() => undefined}
            sort={sort}
            onSortField={(field) => setSort((s) => toggleSortField(s, field))}
            stickyHeader
            density={density}
            focusIndex={1}
            renderActions={() => (
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs hover:bg-muted"
              >
                ···
              </button>
            )}
          />
        </div>
      </main>

      <div className="border-t border-border px-4 py-2 text-center text-[10px] text-muted-foreground">
        Dev preview · ?preview=1
      </div>
      <KeyboardHintsFooter />
    </div>
  );
}

export function FilesPreviewRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="*"
          element={<FilesPreviewApp />}
        />
      </Routes>
    </BrowserRouter>
  );
}
