import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Loader2, Lock, Shield, Trash2, X } from 'lucide-react';
import { notifyFilesListChanged } from '@/lib/filesEvents';
import {
  createAccessGrant,
  deleteAccessGrant,
  isStorageAccessDenied,
  isStorageAuthError,
  listAccessGrantsEffective,
  StorageApiError,
  type AccessGrant,
  type GrantEffect,
  type GrantPermission,
  type GrantSubjectType,
} from '@/lib/storageApi';

export type PermissionsTarget = {
  bucket: string;
  path: string;
  name: string;
  resourceType: 'folder' | 'object';
};

type PermissionsDialogProps = {
  token: string;
  target: PermissionsTarget;
  companyId: number | null;
  currentUserId: number | null;
  canManageDeny: boolean;
  onClose: () => void;
  onAuthError: () => void;
  /** `embedded` fills a ShellUI modal iframe; `overlay` is a local backdrop. */
  variant?: 'overlay' | 'embedded';
};

/** Company deny-read blocks everyone else — the private-folder pattern. */
function isCompanyDenyRead(grant: AccessGrant, companyId: number | null): boolean {
  if (grant.subject_type !== 'company' || grant.effect !== 'deny') return false;
  if (grant.permission !== 'read') return false;
  if (companyId == null) return true;
  return String(grant.subject_id) === String(companyId);
}

function isSelfAllow(
  grant: AccessGrant,
  userId: number | null,
): boolean {
  if (userId == null) return false;
  return (
    grant.subject_type === 'user' &&
    grant.effect === 'allow' &&
    String(grant.subject_id) === String(userId)
  );
}

export function PermissionsDialog({
  token,
  target,
  companyId,
  currentUserId,
  canManageDeny,
  onClose,
  onAuthError,
  variant = 'overlay',
}: PermissionsDialogProps) {
  const { t } = useTranslation();
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [privateAncestor, setPrivateAncestor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subjectType, setSubjectType] = useState<GrantSubjectType>('user');
  const [subjectId, setSubjectId] = useState('');
  const [permission, setPermission] = useState<GrantPermission>('write');
  const [effect, setEffect] = useState<GrantEffect>('allow');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAccessGrantsEffective(token, {
        bucket: target.bucket,
        resource_type: target.resourceType,
        resource_id: target.path,
      });
      setGrants(result.grants);
      setPrivateAncestor(result.private_ancestor);
    } catch (err) {
      if (isStorageAuthError(err)) {
        onAuthError();
        return;
      }
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setLoading(false);
    }
  }, [token, target, onAuthError, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const companyDenyGrants = useMemo(
    () => grants.filter((g) => isCompanyDenyRead(g, companyId)),
    [grants, companyId],
  );
  const hasLocalPrivate = companyDenyGrants.length > 0;
  const isPrivate = hasLocalPrivate || Boolean(privateAncestor);
  const hasSelfAllow = useMemo(
    () => grants.some((g) => isSelfAllow(g, currentUserId)),
    [grants, currentUserId],
  );

  const canMakePrivate =
    canManageDeny && !isPrivate && companyId != null && currentUserId != null;
  // Cannot open to company while sitting under a private parent folder.
  const canMakePublic = canManageDeny && hasLocalPrivate && !privateAncestor;

  function notifyAccessChanged() {
    notifyFilesListChanged({
      reason: 'access',
      bucket: target.bucket,
      path: target.path,
    });
  }

  async function runGrantAction(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      notifyAccessChanged();
    } catch (err) {
      if (isStorageAuthError(err)) {
        onAuthError();
        return;
      }
      // Prefer the API message (e.g. cannot open nested folder while parent is private).
      if (err instanceof StorageApiError && err.message) {
        setError(err.message);
      } else if (isStorageAccessDenied(err)) {
        setError(t('permissionsDenied'));
      } else {
        setError(err instanceof Error ? err.message : t('error'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const sid =
      subjectType === 'company'
        ? String(companyId ?? subjectId.trim())
        : subjectId.trim();
    if (!sid) {
      setError(t('permissionsSubjectRequired'));
      return;
    }
    await runGrantAction(async () => {
      await createAccessGrant(token, {
        bucket: target.bucket,
        subject_type: subjectType,
        subject_id: sid,
        resource_type: target.resourceType,
        resource_id: target.path,
        permission,
        effect,
      });
      setSubjectId('');
    });
  }

  async function handleMakePrivate() {
    if (!companyId || currentUserId == null) {
      setError(t('permissionsPrivateNeedsClaims'));
      return;
    }
    await runGrantAction(async () => {
      // Allow yourself first — a company deny alone would lock the creator out
      // before the allow grant can be created (deny is more specific on objects).
      if (!hasSelfAllow) {
        await createAccessGrant(token, {
          bucket: target.bucket,
          subject_type: 'user',
          subject_id: String(currentUserId),
          resource_type: target.resourceType,
          resource_id: target.path,
          permission: 'admin',
          effect: 'allow',
          notes: 'Private — owner access',
        });
      }
      if (companyDenyGrants.length === 0) {
        await createAccessGrant(token, {
          bucket: target.bucket,
          subject_type: 'company',
          subject_id: String(companyId),
          resource_type: target.resourceType,
          resource_id: target.path,
          permission: 'read',
          effect: 'deny',
          notes: 'Private — company default denied',
        });
      }
    });
  }

  async function handleMakePublic() {
    if (privateAncestor) {
      setError(t('permissionsParentPrivate', { folder: privateAncestor }));
      return;
    }
    await runGrantAction(async () => {
      // Drop company deny so company defaults apply again.
      for (const grant of companyDenyGrants) {
        await deleteAccessGrant(token, grant.id);
      }
      // Individual allows are redundant once the company can access — remove them.
      const redundantAllows = grants.filter(
        (g) =>
          g.effect === 'allow' &&
          (g.subject_type === 'user' || g.subject_type === 'group'),
      );
      for (const grant of redundantAllows) {
        await deleteAccessGrant(token, grant.id);
      }
    });
  }

  async function handleDelete(grant: AccessGrant) {
    if (privateAncestor && isCompanyDenyRead(grant, companyId)) {
      setError(t('permissionsParentPrivate', { folder: privateAncestor }));
      return;
    }
    await runGrantAction(async () => {
      await deleteAccessGrant(token, grant.id);
    });
  }

  function grantSummary(grant: AccessGrant): string {
    const who =
      grant.subject_type === 'company'
        ? t('permissionsSubjectCompany')
        : grant.subject_type === 'group'
          ? t('permissionsSubjectGroup', { id: grant.subject_id })
          : currentUserId != null && String(grant.subject_id) === String(currentUserId)
            ? t('permissionsSubjectYou')
            : t('permissionsSubjectUser', { id: grant.subject_id });
    const perm = t(`permissionsPerm_${grant.permission}`);
    const eff = grant.effect === 'deny' ? t('permissionsEffectDeny') : t('permissionsEffectAllow');
    return `${eff} · ${perm} · ${who}`;
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
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="permissions-title" className="font-heading text-base font-semibold">
            {t('permissionsTitle')}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {target.resourceType === 'folder'
              ? t('permissionsFolder', { name: target.name })
              : t('permissionsFile', { name: target.name })}
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
        <p className="text-xs text-muted-foreground">{t('permissionsHelp')}</p>

        {!loading ? (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
                isPrivate
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                  : 'border-border bg-muted/50 text-muted-foreground'
              }`}
            >
              {isPrivate ? (
                <Lock className="h-3 w-3" aria-hidden />
              ) : (
                <Globe className="h-3 w-3" aria-hidden />
              )}
              {isPrivate ? t('permissionsStatusPrivate') : t('permissionsStatusPublic')}
            </span>
            {privateAncestor ? (
              <p className="w-full text-xs text-muted-foreground">
                {t('permissionsInheritedPrivate', { folder: privateAncestor })}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {canMakePrivate || canMakePublic ? (
          <div className="space-y-2">
            {canMakePrivate ? (
              <button
                type="button"
                className="w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                onClick={() => void handleMakePrivate()}
                disabled={busy || loading}
              >
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  {t('permissionsMakePrivate')}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t('permissionsMakePrivateHelp')}
                </span>
              </button>
            ) : null}
            {canMakePublic ? (
              <button
                type="button"
                className="w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                onClick={() => void handleMakePublic()}
                disabled={busy || loading}
              >
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Globe className="h-3.5 w-3.5" aria-hidden />
                  {t('permissionsMakePublic')}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t('permissionsMakePublicHelp')}
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('permissionsCurrent')}
          </h3>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : grants.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('permissionsEmpty')}</p>
          ) : (
            <ul className="space-y-1">
              {grants.map((grant) => (
                <li
                  key={grant.id}
                  className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate" title={grant.notes || undefined}>
                    {grantSummary(grant)}
                  </span>
                  <button
                    type="button"
                    className="rounded p-1.5 text-destructive hover:bg-muted disabled:opacity-50"
                    title={t('permissionsRevoke')}
                    onClick={() => void handleDelete(grant)}
                    disabled={busy}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form className="space-y-2 border-t border-border pt-3" onSubmit={(e) => void handleCreate(e)}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('permissionsAdd')}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">
              {t('permissionsSubjectType')}
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={subjectType}
                onChange={(e) => setSubjectType(e.target.value as GrantSubjectType)}
              >
                <option value="user">{t('permissionsTypeUser')}</option>
                <option value="company">{t('permissionsTypeCompany')}</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              {t('permissionsEffect')}
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={effect}
                onChange={(e) => setEffect(e.target.value as GrantEffect)}
              >
                <option value="allow">{t('permissionsEffectAllow')}</option>
                {canManageDeny ? (
                  <option value="deny">{t('permissionsEffectDeny')}</option>
                ) : null}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              {t('permissionsPermission')}
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={permission}
                onChange={(e) => setPermission(e.target.value as GrantPermission)}
              >
                <option value="read">{t('permissionsPerm_read')}</option>
                <option value="write">{t('permissionsPerm_write')}</option>
                {canManageDeny ? (
                  <option value="admin">{t('permissionsPerm_admin')}</option>
                ) : null}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              {subjectType === 'company' ? t('permissionsCompanyId') : t('permissionsUserId')}
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={
                  subjectType === 'company' && companyId != null
                    ? String(companyId)
                    : subjectId
                }
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={subjectType === 'company' && companyId != null}
                placeholder={subjectType === 'user' ? '42' : undefined}
              />
            </label>
          </div>
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            disabled={busy}
          >
            {t('permissionsAddGrant')}
          </button>
        </form>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div
        className="flex h-full min-h-screen w-full flex-col"
        role="dialog"
        aria-labelledby="permissions-title"
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
      aria-labelledby="permissions-title"
    >
      {shell}
    </div>
  );
}
