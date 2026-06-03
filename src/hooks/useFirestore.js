import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  getDocs,
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { useUndoRedo } from '@/contexts/UndoRedoContext';
import { useAuth } from '@/contexts/AuthContext';

export function useFirestore(collectionName) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { pushAction } = useUndoRedo() || { pushAction: () => {} };
  const { user } = useAuth();

  useEffect(() => {
    let unsub = () => {};
    try {
      let q;
      if (user) {
        q = query(collection(db, collectionName), where('userId', '==', user.uid));
        
        // Background self-healing migration for legacy/anonymous documents
        const migrateLegacyDocs = async () => {
          try {
            const allDocsSnap = await getDocs(collection(db, collectionName));
            allDocsSnap.forEach(async (d) => {
              const data = d.data();
              if (data.userId === undefined || data.userId === null || data.userId === '') {
                await updateDoc(doc(db, collectionName, d.id), { userId: user.uid });
              }
            });
          } catch (migrateErr) {
            console.error(`Gagal migrasi data lama untuk koleksi ${collectionName}:`, migrateErr);
          }
        };
        migrateLegacyDocs();
      } else {
        q = query(collection(db, collectionName));
      }

      unsub = onSnapshot(q, (snap) => {
        const documents = [];
        snap.forEach(d => {
          documents.push({ id: d.id, ...d.data() });
        });


        // Sort client-side to prevent composite index requirement errors
        documents.sort((a, b) => {
          const t1 = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const t2 = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return t2 - t1; // desc
        });

        setDocs(documents);
        setLoading(false);
      }, (err) => {
        setError(err.message);
        setLoading(false);
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
    return () => unsub();
  }, [collectionName, user]);

  const addDocument = async (docData) => {
    try {
      const dataToSave = { 
        ...docData, 
        userId: user?.uid || null, 
        createdAt: serverTimestamp() 
      };
      const docRef = await addDoc(collection(db, collectionName), dataToSave);
      
      pushAction({
        type: 'ADD',
        collection: collectionName,
        docId: docRef.id,
        newData: docData,
      });
      
      return docRef;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const deleteDocument = async (id) => {
    try {
      const existingDoc = docs.find(d => d.id === id);
      const previousData = existingDoc ? { ...existingDoc } : null;
      if (previousData) delete previousData.id;
      
      await deleteDoc(doc(db, collectionName, id));
      
      if (previousData) {
        pushAction({
          type: 'DELETE',
          collection: collectionName,
          docId: id,
          previousData: previousData
        });
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const updateDocument = async (id, data) => {
    try {
      const existingDoc = docs.find(d => d.id === id);
      const previousData = existingDoc ? { ...existingDoc } : null;
      if (previousData) delete previousData.id;
      
      await updateDoc(doc(db, collectionName, id), data);
      
      if (previousData) {
        pushAction({
          type: 'UPDATE',
          collection: collectionName,
          docId: id,
          previousData: previousData,
          newData: data
        });
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  return { docs, loading, error, addDocument, deleteDocument, updateDocument };
}
