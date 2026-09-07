import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Link2, Loader2, Trash2, X } from 'lucide-react';
import {
  absoluteShareUrl,
  createShareLink,
  isStorageAccessDenied,
  isStorageAuthError,
  listShareLinks,
  resolveStorageError,
  revokeShareLink,
  type ObjectShareLink,
} from '@/lib/storageApi';

export type ShareTarget = {
  bucket: string;
  path: string;
  name: string;
};

type ShareLinkDialogProps = {
  token: string;
  target: ShareTarget;
  onClose: () => void;
  onAuthError: (message: string) => void;
  /** `embedded` fills a Shellui modal iframe; `overlay` is a local backdrop. */
  variant?: 'overlay' | 'embedded';
};

function defaultExpiresLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function ShareLinkDialog({
  token,
  target,
  onClose,
  onAuthError,
  variant = 'overlay',
}: ShareLinkDialogProps) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<ObjectShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [useExpiry, setUseExpiry] = useState(true);
  const [expiresAt, setExpiresAt] = useState(defaultExpiresLocal);
  const [useMaxDownloads, setUseMaxDownloads] = useState(false);
  const [maxDownloads, setMaxDownloads] = useState('10');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listShareLinks(token, target.bucket, target.path);
      setLinks(list);
    } catch (err) {
      if (isStorageAuthError(err)) {
        onAuthError(resolveStorageError(err, t));
        return;
      }
      if (isStorageAccessDenied(err)) {
        setError(t('shareDenied'));
      } else {
        setError(err instanceof Error ? err.message : t('error'));
      }
    } finally {
      setLoading(false);
    }
  }, [token, target, onAuthError, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('shareCopyFailed'));
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!useExpiry && !useMaxDownloads) {
      setError(t('shareLimitRequired'));
      return;
    }
    let expiresIso: string | null = null;
    if (useExpiry) {
      const parsed = new Date(expiresAt);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setError(t('shareInvalidExpiry'));
        return;
      }
      expiresIso = parsed.toISOString();
    }
    let max: number | null = null;
    if (useMaxDownloads) {
      max = Number.parseInt(maxDownloads, 10);
      if (!Number.isFinite(max) || max < 1) {
        setError(t('shareInvalidMaxDownloads'));
        return;
      }
    }

    setBusy(true);
    setError(null);
    setCreatedUrl(null);
    try {
      const link = await createShareLink(token, target.bucket, target.path, {
        expires_at: expiresIso,
        max_downloads: max,
        notes: notes.trim(),
      });
      const url = absoluteShareUrl(link.path_url);
      setCreatedUrl(url);
      await copyText(url);
      await load();
    } catch (err) {
      if (isStorageAuthError(err)) {
        onAuthError(resolveStorageError(err, t));
        return;
      }
      if (isStorageAccessDenied(err)) {
        setError(t('shareDenied'));
      } else {
        setError(err instanceof Error ? err.message : t('error'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(link: ObjectShareLink) {
    const tokenFromUrl = link.path_url.split('/').pop();
    if (!tokenFromUrl) {
      setError(t('error'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await revokeShareLink(token, tokenFromUrl);
      if (createdUrl?.includes(tokenFromUrl)) setCreatedUrl(null);
      await load();
    } catch (err) {
      if (isStorageAuthError(err)) {
        onAuthError(resolveStorageError(err, t));
        return;
      }
      if (isStorageAccessDenied(err)) {
        setError(t('shareDenied'));
      } else {
        setError(err instanceof Error ? err.message : t('error'));
      }
    } finally {
      setBusy(false);
    }
  }

  function linkStatus(link: ObjectShareLink): string {
    if (link.revoked_at) return t('shareStatusRevoked');
    if (!link.active) return t('shareStatusInactive');
    return t('shareStatusActive');
  }

  const embedded = variant === 'embedded';
  const shell = (
    <div
      className={
        embedded
          ? 'flex h-full min-h-0 w-full flex-col bg-card'
          : 'flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-lg'
      }
    >
      <header
        className={`flex items-start gap-3 border-b border-border px-4 py-3 ${
          embedded ? 'pr-14' : ''
        }`}
      >
        <Link2
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2
            id="share-title"
            className="font-heading text-base font-semibold"
          >
            {t('shareTitle')}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {t('shareFile', { name: target.name })}
          </p>
        </div>
        {!embedded ? (
          <button
            type="button"
            className="rounded p-1.5 hover:bg-muted"
            onClick={onClose}
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-3">
        <p className="text-xs text-muted-foreground">{t('shareHelp')}</p>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {createdUrl ? (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">{t('shareCreated')}</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs"
                value={createdUrl}
              />
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => void copyText(createdUrl)}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t('shareCopied') : t('shareCopy')}
              </button>
            </div>
          </div>
        ) : null}

        <form
          className="space-y-3 border-b border-border pb-4"
          onSubmit={(e) => void handleCreate(e)}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('shareCreate')}
          </h3>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={useExpiry}
              onChange={(e) => setUseExpiry(e.target.checked)}
            />
            <span className="flex-1">
              <span className="block">{t('shareExpires')}</span>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={!useExpiry}
              />
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={useMaxDownloads}
              onChange={(e) => setUseMaxDownloads(e.target.checked)}
            />
            <span className="flex-1">
              <span className="block">{t('shareMaxDownloads')}</span>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-50"
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(e.target.value)}
                disabled={!useMaxDownloads}
              />
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">{t('shareNotes')}</span>
            <input
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={255}
              placeholder={t('shareNotesPlaceholder')}
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            disabled={busy}
          >
            {t('shareCreateLink')}
          </button>
        </form>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('shareExisting')}
          </h3>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : links.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('shareEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {links.map((link) => {
                const url = absoluteShareUrl(link.path_url);
                return (
                  <li
                    key={link.id}
                    className="rounded-md border border-border/70 px-2 py-2 text-sm"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              link.active
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {linkStatus(link)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t('shareDownloads', {
                              count: link.download_count,
                              max: link.max_downloads ?? '∞',
                            })}
                          </span>
                        </div>
                        {link.expires_at ? (
                          <p className="text-xs text-muted-foreground">
                            {t('shareExpiresAt', {
                              date: new Date(link.expires_at).toLocaleString(),
                            })}
                          </p>
                        ) : null}
                        {link.notes ? (
                          <p className="truncate text-xs text-muted-foreground">{link.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {link.active ? (
                          <button
                            type="button"
                            className="rounded p-1.5 hover:bg-muted disabled:opacity-50"
                            title={t('shareCopy')}
                            onClick={() => void copyText(url)}
                            disabled={busy}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        {!link.revoked_at ? (
                          <button
                            type="button"
                            className="rounded p-1.5 text-destructive hover:bg-muted disabled:opacity-50"
                            title={t('shareRevoke')}
                            onClick={() => void handleRevoke(link)}
                            disabled={busy}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div
        className="flex h-full min-h-screen w-full flex-col"
        role="dialog"
        aria-labelledby="share-title"
      >
        {shell}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
    >
      {shell}
    </div>
  );
}
