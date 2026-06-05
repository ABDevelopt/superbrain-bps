import { useMemo } from 'react';
import { useFirestore } from '@/hooks/useFirestore';

export function useTeams() {
  const { docs: dbTeams, loading, error, addDocument, deleteDocument, updateDocument } = useFirestore('teams');

  const teamList = useMemo(() => {
    if (dbTeams && dbTeams.length > 0) {
      // Sort teams alphabetically by name
      return [...dbTeams].sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    }
    return [];
  }, [dbTeams]);

  return {
    teams: teamList,
    loading,
    error,
    addTeam: (name) => addDocument({ nama: name }),
    deleteTeam: deleteDocument,
    updateTeam: (id, name) => updateDocument(id, { nama: name }),
    dbTeams
  };
}
