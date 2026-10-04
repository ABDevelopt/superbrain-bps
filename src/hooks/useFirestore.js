import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
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
  const { user, loading: authLoading } = useAuth();
  const currentUserIdRef = useRef(user?.uid || null);

  useEffect(() => {
    // If auth state is still initializing, remain in loading state
    if (authLoading) {
      setLoading(true);
      return;
    }

    // If no user is logged in, immediately clear docs to prevent data leakage
    if (!user || !user.uid) {
      setDocs([]);
      setLoading(false);
      currentUserIdRef.current = null;
      return;
    }

    // If user changed, immediately reset docs to avoid showing previous user's data
    if (currentUserIdRef.current !== user.uid) {
      setDocs([]);
      setLoading(true);
      currentUserIdRef.current = user.uid;
    }

    let unsub = () => {};
    try {
      // Strictly scope all queries to the authenticated user's uid
      const q = query(collection(db, collectionName), where('userId', '==', user.uid));

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
        setError(null);
      }, (err) => {
        console.error(`Firestore error in ${collectionName}:`, err);
        setError(err.message);
        setLoading(false);
      });
    } catch (err) {
      console.error(`Failed to initialize query for ${collectionName}:`, err);
      setError(err.message);
      setLoading(false);
    }

    return () => unsub();
  }, [collectionName, user?.uid, authLoading]);

  const addDocument = async (docData) => {
    if (!user || !user.uid) {
      throw new Error('Gagal: Pengguna belum terautentikasi.');
    }
    try {
      const dataToSave = { 
        ...docData, 
        userId: user.uid, 
        createdAt: serverTimestamp() 
      };
      const docRef = await addDoc(collection(db, collectionName), dataToSave);
      
      pushAction({
        type: 'ADD',
        collection: collectionName,
        docId: docRef.id,
        newData: { ...dataToSave, id: docRef.id },
      });
      
      return docRef;
    } catch (err) {
      console.error(`Error adding document to ${collectionName}:`, err);
      throw err;
    }
  };

  const deleteDocument = async (id) => {
    if (!user || !user.uid) {
      throw new Error('Gagal: Pengguna belum terautentikasi.');
    }
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
      console.error(`Error deleting document from ${collectionName}:`, err);
      throw err;
    }
  };

  const updateDocument = async (id, data) => {
    if (!user || !user.uid) {
      throw new Error('Gagal: Pengguna belum terautentikasi.');
    }
    try {
      const existingDoc = docs.find(d => d.id === id);
      const previousData = existingDoc ? { ...existingDoc } : null;
      if (previousData) delete previousData.id;
      
      // Preserve userId ownership during update
      const updatePayload = {
        ...data,
        userId: user.uid
      };
      
      await updateDoc(doc(db, collectionName, id), updatePayload);
      
      if (previousData) {
        pushAction({
          type: 'UPDATE',
          collection: collectionName,
          docId: id,
          previousData: previousData,
          newData: updatePayload
        });
      }
    } catch (err) {
      console.error(`Error updating document in ${collectionName}:`, err);
      throw err;
    }
  };

  return { docs, loading, error, addDocument, deleteDocument, updateDocument };
}
