import { useCallback, useEffect, useState } from 'react';

export type ListDensity = 'comfortable' | 'compact';

const STORAGE_KEY = 'shellui-files-list-density';

function readStored(): ListDensity {
  if (typeof window === 'undefined') return 'comfortable';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === 'compact' ? 'compact' : 'comfortable';
}

export function useListDensity() {
  const [density, setDensityState] = useState<ListDensity>(() => readStored());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, density);
  }, [density]);

  const setDensity = useCallback((next: ListDensity) => setDensityState(next), []);

  const toggle = useCallback(() => {
    setDensityState((d) => (d === 'comfortable' ? 'compact' : 'comfortable'));
  }, []);

  return { density, setDensity, toggle };
}
