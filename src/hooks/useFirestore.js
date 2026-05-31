import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { useUndoRedo } from '@/contexts/UndoRedoContext';

export function useFirestore(collectionName) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { pushAction } = useUndoRedo() || { pushAction: () => {} };

  useEffect(() => {
    let unsub = () => {};
    try {
      const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
      unsub = onSnapshot(q, (snap) => {
        const documents = [];
        snap.forEach(d => {
          documents.push({ id: d.id, ...d.data() });
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
  }, [collectionName]);

  const addDocument = async (docData) => {
    try {
      const dataToSave = { ...docData, createdAt: serverTimestamp() };
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
