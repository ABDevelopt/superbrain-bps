import { useMemo } from 'react';
import { useFirestore } from '@/hooks/useFirestore';

export function useSkps() {
  const { docs: dbSkps, loading, error, addDocument, deleteDocument, updateDocument } = useFirestore('skps');

  const skpList = useMemo(() => {
    if (dbSkps && dbSkps.length > 0) {
      // Filter out metadata document if any, and sort by ID
      return dbSkps
        .filter(s => !s.isMeta)
        .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    }
    return [];
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
