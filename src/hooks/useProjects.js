import { useMemo } from 'react';
import { useFirestore } from '@/hooks/useFirestore';

export function useProjects() {
  const { docs: dbProjects, loading, error, addDocument, deleteDocument, updateDocument } = useFirestore('projects');

  const projectList = useMemo(() => {
    if (dbProjects && dbProjects.length > 0) {
      // Sort projects alphabetically by name
      return [...dbProjects].sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    }
    return [];
  }, [dbProjects]);

  return {
    projects: projectList,
    loading,
    error,
    addProject: (name, timNama) => addDocument({ nama: name, timNama }),
    deleteProject: deleteDocument,
    updateProject: (id, name, timNama) => updateDocument(id, { nama: name, timNama }),
    dbProjects
  };
}
