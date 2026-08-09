import { useEffect, useState } from 'react';
import { FileManager } from '@/components/FileManager';
import { ViewerPage } from '@/components/ViewerPage';
import { isViewerHash } from '@/lib/viewerRoute';

export function App() {
  const [viewerMode, setViewerMode] = useState(() => isViewerHash());

  useEffect(() => {
    const onHash = () => setViewerMode(isViewerHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (viewerMode) {
    return <ViewerPage />;
  }

  return <FileManager />;
}
