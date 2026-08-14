import type { StorageResponse } from '@shellui/sdk';

/** Throw `error` so existing try/catch + `isStorageAuthError` helpers keep working. */
export function unwrapStorage<T>(result: StorageResponse<T>): T {
  if (result.error) throw result.error;
  if (result.data == null) {
    throw new Error('Empty storage response');
  }
  return result.data;
}
