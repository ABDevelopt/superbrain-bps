'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);

  // Retrieve persisted token on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('sb_google_access_token');
      if (storedToken) {
        setAccessToken(storedToken);
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      // If user logs out, clear token
      if (!currentUser) {
        setAccessToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sb_google_access_token');
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Request Google Drive and Calendar access
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      // Force account selection and show consent prompt to ensure scope checkboxes are displayed
      provider.setCustomParameters({ prompt: 'select_account consent' });
      
      const result = await signInWithPopup(auth, provider);
      
      // Enforce permission checks: verify if scopes were actually granted by user
      const grantedScopes = result._tokenResponse?.scope || '';
      const hasDrive = grantedScopes.includes('https://www.googleapis.com/auth/drive.file');
      const hasCalendar = grantedScopes.includes('https://www.googleapis.com/auth/calendar.events');

      if (!hasDrive || !hasCalendar) {
        // Sign out immediately to reset Firebase Auth state
        await signOut(auth);
        throw new Error('Anda wajib menyetujui/mencentang izin akses Google Drive dan Google Calendar pada halaman login Google untuk menggunakan fitur aplikasi.');
      }

      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        setAccessToken(credential.accessToken);
        if (typeof window !== 'undefined') {
          localStorage.setItem('sb_google_access_token', credential.accessToken);
        }
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setAccessToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sb_google_access_token');
      }
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, accessToken, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
