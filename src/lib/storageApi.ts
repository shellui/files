export type BucketAccess = {
  audience: 'company' | 'owner' | 'connector' | 'restricted' | 'limited';
  readers: string;
  writers: string;
  owner_id?: number | null;
  shareable?: boolean;
  grants_enabled?: boolean;
  description?: string;
  can_write?: boolean;
  allowed_user_ids?: string[];
  allowed_group_ids?: string[];
  grant_count?: number;
};

export type Bucket = {
  id: string;
  name: string;
  display_name?: string;
  kind?: 'company' | 'user' | 'connector';
  public: boolean;
  access?: BucketAccess;
  created_at?: string;
  connector_provider?: string | null;
};

export type StorageListItem = {
  id: string | null;
  name: string;
  bucket_id?: string;
  metadata: {
    size?: number;
    mimetype?: string;
    lastModified?: string;
  } | null;
  updated_at?: string | null;
  created_at?: string | null;
  access?: BucketAccess;
};

export type GrantSubjectType = 'user' | 'group' | 'company';
export type GrantResourceType = 'bucket' | 'folder' | 'object';
export type GrantPermission = 'read' | 'write' | 'admin';
export type GrantEffect = 'allow' | 'deny';

export type AccessGrant = {
  id: string;
  company_id: number;
  bucket: string;
  subject_type: GrantSubjectType;
  subject_id: string;
  resource_type: GrantResourceType;
  resource_id: string;
  permission: GrantPermission;
  effect: GrantEffect;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  notes: string;
};

export type CreateAccessGrantInput = {
  bucket?: string;
  subject_type: GrantSubjectType;
  subject_id: string;
  resource_type: GrantResourceType;
  resource_id: string;
  permission: GrantPermission;
  effect: GrantEffect;
  expires_at?: string | null;
  notes?: string;
};

export type ObjectShareLink = {
  id: string;
  object_id: string;
  bucket: string;
  path: string;
  company_id: number;
  created_by_id: number;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  revoked_at: string | null;
  created_at: string;
  notes: string;
  active: boolean;
  path_url: string;
  token?: string;
};

export type CreateShareLinkInput = {
  expires_at?: string | null;
  max_downloads?: number | null;
  notes?: string;
};

export class StorageApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'StorageApiError';
    this.status = status;
    this.code = code;
  }
}

function errorStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

/** 401 from storage-service — signed-out / expired session. */
export function isStorageAuthError(err: unknown): boolean {
  return errorStatus(err) === 401;
}

/** 403 ACL / permission denials (not session expiry). */
export function isStorageAccessDenied(err: unknown): boolean {
  return errorStatus(err) === 403;
}

function storageBaseUrl(): string {
  return (import.meta.env.VITE_STORAGE_URL || 'http://localhost:8001').replace(/\/$/, '');
}

async function parseError(response: Response): Promise<StorageApiError> {
  let message = response.statusText || 'Request failed';
  let code: string | undefined;
  try {
    const body = (await response.json()) as { message?: string; error?: string; detail?: string };
    message = body.message || body.error || body.detail || message;
    code = body.error;
  } catch {
    /* ignore */
  }
  return new StorageApiError(message, response.status, code);
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !(init.body instanceof Blob)) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${storageBaseUrl()}${path}`, { ...init, headers });
  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return undefined as T;
}

/** Absolute URL for a share link `path_url` (e.g. `/storage/v1/share/link/{token}`). */
export function absoluteShareUrl(pathUrl: string): string {
  if (pathUrl.startsWith('http://') || pathUrl.startsWith('https://')) return pathUrl;
  return `${storageBaseUrl()}${pathUrl.startsWith('/') ? '' : '/'}${pathUrl}`;
}

export function pickDefaultBucket(buckets: Bucket[]): string {
  const company =
    buckets.find((b) => b.kind === 'company') || buckets.find((b) => b.name === 'company');
  return company?.name ?? buckets[0]?.name ?? '';
}

function encodedObjectPath(bucket: string, path: string): string {
  return `${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

// ---------------------------------------------------------------------------
// Access grants
// ---------------------------------------------------------------------------

export async function listAccessGrants(
  token: string,
  params: {
    resource_type?: GrantResourceType;
    resource_id?: string;
    bucket?: string;
    /** When true, response includes ``private_ancestor`` (parent folder privacy). */
    include_effective?: boolean;
  } = {},
): Promise<AccessGrant[]> {
  const result = await listAccessGrantsEffective(token, params);
  return result.grants;
}

export type AccessGrantsEffective = {
  grants: AccessGrant[];
  /** Nearest private parent folder path, if any. */
  private_ancestor: string | null;
};

export async function listAccessGrantsEffective(
  token: string,
  params: {
    resource_type?: GrantResourceType;
    resource_id?: string;
    bucket?: string;
    include_effective?: boolean;
  } = {},
): Promise<AccessGrantsEffective> {
  const query = new URLSearchParams();
  if (params.resource_type) query.set('resource_type', params.resource_type);
  if (params.resource_id) query.set('resource_id', params.resource_id);
  if (params.bucket) query.set('bucket', params.bucket);
  query.set('include_effective', '1');
  const qs = query.toString();
  const body = await request<AccessGrant[] | AccessGrantsEffective>(
    `/storage/v1/access/grant?${qs}`,
    token,
  );
  if (Array.isArray(body)) {
    return { grants: body, private_ancestor: null };
  }
  return {
    grants: body.grants || [],
    private_ancestor: body.private_ancestor ?? null,
  };
}

export async function createAccessGrant(
  token: string,
  input: CreateAccessGrantInput,
): Promise<AccessGrant> {
  return request<AccessGrant>('/storage/v1/access/grant', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteAccessGrant(token: string, grantId: string): Promise<void> {
  await request(`/storage/v1/access/grant/${encodeURIComponent(grantId)}`, token, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Public share links (capability URLs)
// ---------------------------------------------------------------------------

export async function listShareLinks(
  token: string,
  bucket: string,
  path: string,
): Promise<ObjectShareLink[]> {
  return request<ObjectShareLink[]>(
    `/storage/v1/share/${encodedObjectPath(bucket, path)}`,
    token,
  );
}

export async function createShareLink(
  token: string,
  bucket: string,
  path: string,
  input: CreateShareLinkInput,
): Promise<ObjectShareLink> {
  return request<ObjectShareLink>(
    `/storage/v1/share/${encodedObjectPath(bucket, path)}`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        expires_at: input.expires_at ?? null,
        max_downloads: input.max_downloads ?? null,
        notes: input.notes ?? '',
      }),
    },
  );
}

export async function revokeShareLink(token: string, shareToken: string): Promise<ObjectShareLink> {
  return request<ObjectShareLink>(
    `/storage/v1/share/link/${encodeURIComponent(shareToken)}`,
    token,
    { method: 'DELETE' },
  );
}
