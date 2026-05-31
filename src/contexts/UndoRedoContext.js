'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

const UndoRedoContext = createContext({});

export function UndoRedoProvider({ children }) {
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const pushAction = useCallback((action) => {
    setUndoStack((prev) => [...prev, action]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    
    try {
      if (action.type === 'ADD') {
        await deleteDoc(doc(db, action.collection, action.docId));
      } else if (action.type === 'UPDATE') {
        await updateDoc(doc(db, action.collection, action.docId), action.previousData);
      } else if (action.type === 'DELETE') {
        await setDoc(doc(db, action.collection, action.docId), action.previousData);
      } else if (action.type === 'BATCH') {
        for (let i = action.operations.length - 1; i >= 0; i--) {
           const op = action.operations[i];
           if (op.type === 'ADD') await deleteDoc(doc(db, op.collection, op.docId));
           else if (op.type === 'UPDATE') await updateDoc(doc(db, op.collection, op.docId), op.previousData);
           else if (op.type === 'DELETE') await setDoc(doc(db, op.collection, op.docId), op.previousData);
        }
      }
      
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, action]);
      showToast('Berhasil membatalkan (Undo)');
    } catch (e) {
      console.error('Undo failed:', e);
      showToast('Gagal membatalkan aksi');
    }
  }, [undoStack]);

  const redo = useCallback(async () => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    
    try {
      if (action.type === 'ADD') {
        await setDoc(doc(db, action.collection, action.docId), action.newData);
      } else if (action.type === 'UPDATE') {
        await updateDoc(doc(db, action.collection, action.docId), action.newData);
      } else if (action.type === 'DELETE') {
        await deleteDoc(doc(db, action.collection, action.docId));
      } else if (action.type === 'BATCH') {
        for (const op of action.operations) {
           if (op.type === 'ADD') await setDoc(doc(db, op.collection, op.docId), op.newData);
           else if (op.type === 'UPDATE') await updateDoc(doc(db, op.collection, op.docId), op.newData);
           else if (op.type === 'DELETE') await deleteDoc(doc(db, op.collection, op.docId));
        }
      }
      
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, action]);
      showToast('Berhasil mengulangi (Redo)');
    } catch (e) {
      console.error('Redo failed:', e);
      showToast('Gagal mengulangi aksi');
    }
  }, [redoStack]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <UndoRedoContext.Provider value={{ pushAction, undo, redo, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }}>
      {children}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: 'rgba(15,23,42,0.95)', color: '#f8fafc', padding: '12px 24px',
          borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          fontWeight: 500, fontSize: '14px'
        }}>
          {toast}
        </div>
      )}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedo() {
  return useContext(UndoRedoContext);
}
