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

export function useFirestore(collectionName) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsub = () => {};
    try {
      const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
      unsub = onSnapshot(q, (snap) => {
        const documents = [];
        snap.forEach(doc => {
          documents.push({ id: doc.id, ...doc.data() });
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
      const docRef = await addDoc(collection(db, collectionName), {
        ...docData,
        createdAt: serverTimestamp()
      });
      return docRef;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const deleteDocument = async (id) => {
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const updateDocument = async (id, data) => {
    try {
      await updateDoc(doc(db, collectionName, id), data);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  return { docs, loading, error, addDocument, deleteDocument, updateDocument };
}
