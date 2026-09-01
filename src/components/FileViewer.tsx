import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  File as FileIcon,
  Loader2,
  X,
} from 'lucide-react';
import { formatBytes, joinPath } from '@/lib/format';
import { unwrapStorage } from '@/lib/shellStorage';
import {
  isStorageAccessDenied,
  isStorageAuthError,
  resolveStorageError,
  type StorageListItem,
} from '@/lib/storageApi';
import { shellui } from '@shellui/sdk';
import {
  formatJsonText,
  isTextTooLarge,
  renderMarkdownLite,
  resolveViewerKind,
  type ViewerKind,
} from '@/lib/viewer';

export type ViewerTarget = {
  item: StorageListItem;
  path: string;
};

type FileViewerProps = {
  bucket: string;
  target: ViewerTarget;
  siblings: ViewerTarget[];
  onClose: () => void;
  onNavigate: (target: ViewerTarget) => void;
  /** `overlay` = in-app fullscreen; `embedded` = fill ShellUI drawer iframe */
  variant?: 'overlay' | 'embedded';
};

function kindLabel(kind: ViewerKind, t: (key: string) => string): string {
  switch (kind) {
    case 'image':
      return t('viewerKindImage');
    case 'pdf':
      return t('viewerKindPdf');
    case 'video':
      return t('viewerKindVideo');
    case 'audio':
      return t('viewerKindAudio');
    case 'text':
      return t('viewerKindText');
    case 'markdown':
      return t('viewerKindMarkdown');
    case 'json':
      return t('viewerKindJson');
    default:
      return t('viewerKindUnsupported');
  }
}

export function FileViewer({
  bucket,
  target,
  siblings,
  onClose,
  onNavigate,
  variant = 'overlay',
}: FileViewerProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [resolvedMime, setResolvedMime] = useState(
    target.item.metadata?.mimetype || 'application/octet-stream',
  );
  const [downloading, setDownloading] = useState(false);

  const mimeHint = target.item.metadata?.mimetype || '';
  const kind = useMemo(
    () => resolveViewerKind(resolvedMime || mimeHint, target.item.name),
    [resolvedMime, mimeHint, target.item.name],
  );

  const index = siblings.findIndex((s) => s.path === target.path);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && prev) onNavigate(prev);
      if (e.key === 'ArrowRight' && next) onNavigate(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate, prev, next]);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    async function load() {
      setLoading(true);
      setError(null);
      setAuthFailed(false);
      setTextContent(null);
      setObjectUrl(null);

      const listedMime = target.item.metadata?.mimetype || '';
      const previewKind = resolveViewerKind(listedMime, target.item.name);
      if (previewKind === 'unsupported') {
        setResolvedMime(listedMime || 'application/octet-stream');
        setLoading(false);
        return;
      }

      if (
        (previewKind === 'text' || previewKind === 'markdown' || previewKind === 'json') &&
        isTextTooLarge(target.item.metadata?.size)
      ) {
        setResolvedMime(listedMime || 'text/plain');
        setError(t('viewerTextTooLarge'));
        setLoading(false);
        return;
      }

      try {
        const blob = unwrapStorage(
          await shellui.storage.from(bucket).download(target.path),
        );
        if (cancelled) return;
        const mime = listedMime || blob.type || 'application/octet-stream';
        setResolvedMime(mime);
        const loadedKind = resolveViewerKind(mime, target.item.name);

        if (loadedKind === 'text' || loadedKind === 'markdown' || loadedKind === 'json') {
          const raw = await blob.text();
          if (cancelled) return;
          setTextContent(loadedKind === 'json' ? formatJsonText(raw) : raw);
        } else {
          createdUrl = URL.createObjectURL(blob);
          setObjectUrl(createdUrl);
        }
      } catch (err) {
        if (!cancelled) {
          if (isStorageAuthError(err)) {
            setAuthFailed(true);
            setError(resolveStorageError(err, t));
            setTextContent(null);
            setObjectUrl(null);
          } else if (isStorageAccessDenied(err)) {
            setError(t('accessDenied'));
            setTextContent(null);
            setObjectUrl(null);
          } else {
            setError(err instanceof Error ? err.message : t('error'));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [bucket, target.path, target.item.metadata?.mimetype, target.item.metadata?.size, target.item.name, t]);

  const handleDownload = useCallback(async () => {
    if (authFailed) return;
    setDownloading(true);
    try {
      const blob = unwrapStorage(
        await shellui.storage.from(bucket).download(target.path),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = target.item.name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      if (isStorageAuthError(err)) {
        setAuthFailed(true);
        setError(resolveStorageError(err, t));
        setTextContent(null);
        setObjectUrl(null);
      } else if (isStorageAccessDenied(err)) {
        setError(t('accessDenied'));
      } else {
        setError(err instanceof Error ? err.message : t('error'));
      }
    } finally {
      setDownloading(false);
    }
  }, [authFailed, bucket, target.path, target.item.name, t]);

  const markdownHtml = useMemo(
    () => (kind === 'markdown' && textContent != null ? renderMarkdownLite(textContent) : null),
    [kind, textContent],
  );

  const embedded = variant === 'embedded';
  const mediaMaxClass = embedded
    ? 'max-h-full max-w-full'
    : 'max-h-[calc(100vh-12rem)] max-w-full';

  const shell = (
    <div
      className={
        embedded
          ? 'flex h-full min-h-0 w-full flex-col bg-card'
          : 'relative z-10 m-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl md:m-6'
      }
    >
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-heading text-base font-semibold tracking-tight md:text-lg">
                {target.item.name}
              </h2>
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                {kindLabel(kind, t)}
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {joinPath(bucket, target.path)}
              {' · '}
              {formatBytes(target.item.metadata?.size)}
              {resolvedMime ? ` · ${resolvedMime}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              title={t('viewerPrevious')}
              onClick={() => prev && onNavigate(prev)}
              disabled={!prev}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              title={t('viewerNext')}
              onClick={() => next && onNavigate(next)}
              disabled={!next}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              onClick={() => void handleDownload()}
              disabled={downloading || authFailed}
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t('download')}
            </button>
            <button
              type="button"
              className="rounded-md p-2 hover:bg-muted"
              title={t('viewerClose')}
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-auto bg-muted/20">
          {loading ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('viewerLoading')}
            </div>
          ) : error && kind !== 'unsupported' ? (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-3 p-8 text-center">
              <EyeOff className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-destructive">{error}</p>
              {!authFailed ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                  onClick={() => void handleDownload()}
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('download')}
                </button>
              ) : null}
            </div>
          ) : kind === 'image' && objectUrl ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center p-4 md:p-6">
              <img
                src={objectUrl}
                alt={target.item.name}
                className={`${mediaMaxClass} rounded-lg object-contain shadow-md`}
              />
            </div>
          ) : kind === 'pdf' && objectUrl ? (
            <iframe
              title={target.item.name}
              src={objectUrl}
              className="h-full min-h-[20rem] w-full border-0 bg-background"
            />
          ) : kind === 'video' && objectUrl ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center p-4 md:p-6">
              <video
                src={objectUrl}
                controls
                className={`${mediaMaxClass} rounded-lg shadow-md`}
              >
                <track kind="captions" />
              </video>
            </div>
          ) : kind === 'audio' && objectUrl ? (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-6 p-8">
              <div className="flex size-24 items-center justify-center rounded-full bg-muted">
                <FileIcon className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="font-heading text-lg font-medium">{target.item.name}</p>
              <audio
                src={objectUrl}
                controls
                className="w-full max-w-md"
              />
            </div>
          ) : kind === 'markdown' && markdownHtml != null ? (
            <article
              className="viewer-md mx-auto max-w-3xl px-5 py-8 md:px-8"
              dangerouslySetInnerHTML={{ __html: markdownHtml }}
            />
          ) : (kind === 'text' || kind === 'json') && textContent != null ? (
            <pre className="h-full overflow-auto p-4 font-mono text-[13px] leading-relaxed text-foreground md:p-6">
              <code>{textContent}</code>
            </pre>
          ) : (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                <EyeOff className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-heading text-base font-medium">{t('viewerUnsupportedTitle')}</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {t('viewerUnsupportedDescription', {
                    type: resolvedMime || mimeHint || t('file'),
                  })}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                onClick={() => void handleDownload()}
              >
                <Download className="h-3.5 w-3.5" />
                {t('download')}
              </button>
            </div>
          )}
        </div>

        {siblings.length > 1 ? (
          <footer className="shrink-0 border-t border-border px-4 py-2 text-center font-mono text-[11px] text-muted-foreground">
            {t('viewerPosition', { current: Math.max(index, 0) + 1, total: siblings.length })}
            {' · '}
            {t('viewerShortcuts')}
          </footer>
        ) : null}
    </div>
  );

  if (embedded) {
    return (
      <div
        className="flex h-full min-h-0 w-full flex-col"
        role="dialog"
        aria-label={t('viewerTitle', { name: target.item.name })}
      >
        {shell}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('viewerTitle', { name: target.item.name })}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('viewerClose')}
        onClick={onClose}
      />
      {shell}
    </div>
  );
}

