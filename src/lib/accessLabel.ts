import type { StorageListItem } from '@/lib/storageApi';

export function accessLabelKey(audience: string | undefined): string {
  if (audience === 'company') return 'accessCompany';
  if (audience === 'owner') return 'accessOwner';
  if (audience === 'connector') return 'accessConnector';
  if (audience === 'restricted') return 'accessRestricted';
  if (audience === 'limited') return 'accessLimited';
  return 'accessUnknown';
}

export function accessRowLabel(
  access: StorageListItem['access'] | undefined,
  fallbackAudience: string | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const audience = access?.audience || fallbackAudience;
  if (audience === 'restricted') {
    const n = access?.allowed_user_ids?.length ?? 0;
    if (n > 0) return t('accessRestrictedUsers', { count: n });
    return t('accessRestricted');
  }
  if (audience === 'limited') {
    const grants = access?.grant_count ?? 0;
    if (grants > 0) return t('accessLimitedGrants', { count: grants });
    return t('accessLimited');
  }
  return t(accessLabelKey(audience));
}
