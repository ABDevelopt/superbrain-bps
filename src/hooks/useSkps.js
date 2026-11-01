import { useMemo } from 'react';
import { useFirestore } from '@/hooks/useFirestore';
import { skpData as defaultSkpData } from '@/data/skpData';

export function useSkps() {
  const { docs: dbSkps, loading, error, addDocument, deleteDocument, updateDocument } = useFirestore('skps');

  const skpList = useMemo(() => {
    if (dbSkps && dbSkps.length > 0) {
      // Filter out metadata document if any
      const activeDbSkps = dbSkps.filter(s => !s.isMeta);
      const dbIds = new Set(activeDbSkps.map(s => Number(s.id || 0)));
      
      // Auto-supplement any official default SKPs that are not yet in the user's database (e.g. SKP #30 SPDT-NTP)
      const missingDefaults = defaultSkpData.filter(d => !dbIds.has(Number(d.id)));
      
      const combined = [...activeDbSkps, ...missingDefaults];
      return combined.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    }
    return defaultSkpData;
  }, [dbSkps]);

  const isCustom = useMemo(() => {
    return dbSkps && dbSkps.length > 0;
  }, [dbSkps]);

  return {
    skpData: skpList,
    loading,
    error,
    isCustom,
    addDocument,
    deleteDocument,
    updateDocument,
    dbSkps
  };
}

