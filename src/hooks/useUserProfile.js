import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export function useUserProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load initial cached profile from localStorage for instant display
  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const cached = localStorage.getItem(`superbrain_user_profile_${user.uid}`);
      if (cached) {
        setProfile(JSON.parse(cached));
      }
    } catch (e) {
      console.error('Error loading cached user profile:', e);
    }
  }, [user?.uid]);

  // Subscribe to real-time profile in Firestore
  useEffect(() => {
    if (authLoading) return;

    if (!user?.uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userDocRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(
      userDocRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = { id: snapshot.id, ...snapshot.data() };
          setProfile(data);
          try {
            localStorage.setItem(`superbrain_user_profile_${user.uid}`, JSON.stringify(data));
          } catch (e) {}
          setLoading(false);
          setError(null);
        } else {
          // Document does not exist yet: create initial profile document
          const initialData = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Pegawai BPS',
            photoURL: user.photoURL || '',
            nip: '',
            jabatan: 'Pegawai BPS',
            satker: 'BPS',
            timKerjaDefault: 'Subbagian Umum',
            customSatuan: [],
            activityPresets: [],
            preferences: {
              theme: 'system',
              compressProof: true,
            },
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          try {
            await setDoc(userDocRef, initialData, { merge: true });
            setProfile(initialData);
          } catch (err) {
            console.warn('Failed to initialize user document in Firestore, falling back to local state:', err.message);
            setProfile(initialData);
            setError(err);
          } finally {
            setLoading(false);
          }
        }
      },
      (err) => {
        console.warn('Firestore user profile subscription notice (using local profile fallback):', err.message);
        setError(err);
        setProfile((prev) => {
          if (prev) return prev;
          try {
            const cached = localStorage.getItem(`superbrain_user_profile_${user.uid}`);
            if (cached) return JSON.parse(cached);
          } catch (e) {}
          return {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Pegawai BPS',
            photoURL: user.photoURL || '',
            nip: '',
            jabatan: 'Pegawai BPS',
            satker: 'BPS',
            timKerjaDefault: 'Subbagian Umum',
            customSatuan: [],
            activityPresets: [],
            preferences: {
              theme: 'system',
              compressProof: true,
            },
          };
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, authLoading]);

  // Update profile fields
  const updateProfile = useCallback(async (fields) => {
    if (!user?.uid) throw new Error('Pengguna belum terautentikasi.');
    const userDocRef = doc(db, 'users', user.uid);
    const payload = {
      ...fields,
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(userDocRef, payload, { merge: true });
    } catch (cloudErr) {
      console.warn('Could not sync profile to cloud Firestore, saving to local device cache:', cloudErr.message);
    }

    setProfile((prev) => {
      const updated = { ...(prev || {}), ...payload };
      try {
        localStorage.setItem(`superbrain_user_profile_${user.uid}`, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, [user?.uid]);

  // Save custom quantity units (satuan custom CKP)
  const saveCustomSatuan = useCallback(async (customSatuanList) => {
    if (!user?.uid) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await setDoc(userDocRef, {
        customSatuan: customSatuanList,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (cloudErr) {
      console.warn('Could not sync custom satuan to cloud Firestore, saving to local cache:', cloudErr.message);
    }

    try {
      localStorage.setItem(`superbrain_custom_satuan_${user.uid}`, JSON.stringify(customSatuanList));
    } catch (e) {}
  }, [user?.uid]);

  // Save activity presets (template kegiatan CKP)
  const saveActivityPresets = useCallback(async (presetsList) => {
    if (!user?.uid) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await setDoc(userDocRef, {
        activityPresets: presetsList,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (cloudErr) {
      console.warn('Could not sync activity presets to cloud Firestore, saving to local cache:', cloudErr.message);
    }

    try {
      localStorage.setItem(`superbrain_user_activity_presets_${user.uid}`, JSON.stringify(presetsList));
    } catch (e) {}
  }, [user?.uid]);

  return {
    profile,
    loading,
    error,
    updateProfile,
    saveCustomSatuan,
    saveActivityPresets,
  };
}
