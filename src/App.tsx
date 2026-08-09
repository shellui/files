import { useEffect, useState } from 'react';
import { FileManager } from '@/components/FileManager';
import { PermissionsPage } from '@/components/PermissionsPage';
import { ShareLinkPage } from '@/components/ShareLinkPage';
import { ViewerPage } from '@/components/ViewerPage';
import { isPermissionsHash, isShareHash } from '@/lib/modalRoutes';
import { isViewerHash } from '@/lib/viewerRoute';

type AppMode = 'manager' | 'viewer' | 'permissions' | 'share';

function resolveMode(hash = window.location.hash): AppMode {
  if (isViewerHash(hash)) return 'viewer';
  if (isPermissionsHash(hash)) return 'permissions';
  if (isShareHash(hash)) return 'share';
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
  return <FileManager />;
}
