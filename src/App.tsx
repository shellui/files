import { useEffect, useState } from 'react';
import { FileManager } from '@/components/FileManager';
import { MoveFilePage } from '@/components/MoveFilePage';
import { PermissionsPage } from '@/components/PermissionsPage';
import { ShareLinkPage } from '@/components/ShareLinkPage';
import { ViewerPage } from '@/components/ViewerPage';
import { isMoveHash, isPermissionsHash, isSelectHash, isShareHash } from '@/lib/modalRoutes';
import { isViewerHash } from '@/lib/viewerRoute';
import { StoragePickerPage } from '@/components/StoragePickerPage';

type AppMode = 'manager' | 'viewer' | 'permissions' | 'share' | 'move' | 'select';

function resolveMode(hash = window.location.hash): AppMode {
  if (isViewerHash(hash)) return 'viewer';
  if (isPermissionsHash(hash)) return 'permissions';
  if (isShareHash(hash)) return 'share';
  if (isMoveHash(hash)) return 'move';
  if (isSelectHash(hash)) return 'select';
  return 'manager';
}

export function App() {
  const [mode, setMode] = useState<AppMode>(() => resolveMode());

  useEffect(() => {
    const onHash = () => setMode(resolveMode());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (mode === 'viewer') return <ViewerPage />;
  if (mode === 'permissions') return <PermissionsPage />;
  if (mode === 'share') return <ShareLinkPage />;
  if (mode === 'move') return <MoveFilePage />;
  if (mode === 'select') return <StoragePickerPage />;
  return <FileManager />;
}
