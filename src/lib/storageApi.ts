import { FOLDER_PLACEHOLDER, joinPath } from '@/lib/format';

export type BucketAccess = {
  audience: 'company' | 'owner' | 'connector';
  readers: string;
  writers: string;
  owner_id?: number | null;
  shareable?: boolean;
  description?: string;
  can_write?: boolean;
};

export type Bucket = {
  id: string;
  name: string;
  display_name?: string;
  kind?: 'company' | 'user' | 'connector';
  public: boolean;
  access?: BucketAccess;
  created_at?: string;
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

function storageBaseUrl(): string {
  return (import.meta.env.VITE_STORAGE_URL || 'http://localhost:8001').replace(/\/$/, '');
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
    let message = response.statusText || 'Request failed';
    let code: string | undefined;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message || body.error || message;
      code = body.error;
    } catch {
      /* ignore */
    }
    throw new StorageApiError(message, response.status, code);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return undefined as T;
}

export function getStorageBaseUrl() {
  return storageBaseUrl();
}

export async function listBuckets(token: string): Promise<Bucket[]> {
  return request<Bucket[]>('/storage/v1/bucket', token);
}

export async function listObjects(
  token: string,
  bucket: string,
  prefix = '',
): Promise<StorageListItem[]> {
  const entries = await request<StorageListItem[]>(
    `/storage/v1/object/list/${encodeURIComponent(bucket)}`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        prefix,
        limit: 200,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      }),
    },
  );
  return entries.filter((item) => item.name !== FOLDER_PLACEHOLDER);
}

export async function uploadObject(
  token: string,
  bucket: string,
  path: string,
  file: File,
): Promise<void> {
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', file.type || 'application/octet-stream');
  headers.set('x-upsert', 'true');

  const response = await fetch(
    `${storageBaseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`,
    {
      method: 'POST',
      headers,
      body: file,
    },
  );
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { message?: string };
      message = body.message || message;
    } catch {
      /* ignore */
    }
    throw new StorageApiError(message, response.status);
  }
}

/** Creates a virtual folder by uploading a hidden placeholder object under the path. */
export async function createFolder(
  token: string,
  bucket: string,
  parentPrefix: string,
  folderName: string,
): Promise<string> {
  const folderPath = joinPath(parentPrefix, folderName.trim());
  const markerPath = joinPath(folderPath, FOLDER_PLACEHOLDER);
  const marker = new File([], FOLDER_PLACEHOLDER, { type: 'application/x-directory' });
  await uploadObject(token, bucket, markerPath, marker);
  return folderPath;
}

function objectUrl(bucket: string, path: string): string {
  return `${storageBaseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

export async function deleteObject(token: string, bucket: string, path: string): Promise<void> {
  await request(
    `/storage/v1/object/${encodeURIComponent(bucket)}/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`,
    token,
    { method: 'DELETE' },
  );
}

export type FolderPrefixStats = {
  prefix: string;
  object_count: number;
  file_count: number;
  placeholder_count: number;
  total_bytes: number;
};

/** Count objects under a folder prefix (for delete confirmation). */
export async function getFolderStats(
  token: string,
  bucket: string,
  folderPath: string,
): Promise<FolderPrefixStats> {
  const prefix = encodeURIComponent(folderPath.replace(/^\/+|\/+$/g, ''));
  return request<FolderPrefixStats>(
    `/storage/v1/object/prefix/${encodeURIComponent(bucket)}?prefix=${prefix}`,
    token,
  );
}

/** Recursively delete every object under a folder prefix. */
export async function deleteFolder(
  token: string,
  bucket: string,
  folderPath: string,
): Promise<{ count: number }> {
  return request<{ count: number }>(
    `/storage/v1/object/prefix/${encodeURIComponent(bucket)}`,
    token,
    {
      method: 'DELETE',
      body: JSON.stringify({ prefix: folderPath.replace(/^\/+|\/+$/g, '') }),
    },
  );
}

/** Fetch object bytes for in-browser viewing (inline Content-Disposition). */
export async function fetchObjectBlob(
  token: string,
  bucket: string,
  path: string,
): Promise<{ blob: Blob; contentType: string }> {
  const response = await fetch(objectUrl(bucket, path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new StorageApiError(response.statusText || 'Fetch failed', response.status);
  }
  const blob = await response.blob();
  const headerType = response.headers.get('Content-Type')?.split(';')[0]?.trim() || '';
  const contentType = headerType || blob.type || 'application/octet-stream';
  return { blob, contentType };
}

export async function downloadObject(
  token: string,
  bucket: string,
  path: string,
): Promise<Blob> {
  const response = await fetch(`${objectUrl(bucket, path)}?download=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new StorageApiError(response.statusText || 'Download failed', response.status);
  }
  return response.blob();
}
