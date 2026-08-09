/** Cross-iframe events between FileManager and ShellUI modal pages (same origin). */

const CHANNEL = 'shellui-files';

export type FilesListChangedEvent = {
  type: 'list-changed';
  reason: 'access' | 'share';
  bucket: string;
  path: string;
};

export function notifyFilesListChanged(
  event: Omit<FilesListChangedEvent, 'type'>,
): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ type: 'list-changed', ...event } satisfies FilesListChangedEvent);
    channel.close();
  } catch {
    /* ignore */
  }
}

export function subscribeFilesListChanged(
  handler: (event: FilesListChangedEvent) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (message: MessageEvent<FilesListChangedEvent>) => {
      const data = message.data;
      if (data?.type === 'list-changed' && data.bucket && data.path) {
        handler(data);
      }
    };
    return () => channel.close();
  } catch {
    return () => undefined;
  }
}
