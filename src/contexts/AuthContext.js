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

  useEffect(() => {
    const handleTokenExpired = () => {
      setAccessToken(null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('sb_google_token_expired', handleTokenExpired);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (currentUser && typeof window !== 'undefined') {
        // Retrieve token specifically scoped to this user
        const userToken = localStorage.getItem(`sb_google_access_token_${currentUser.uid}`) || localStorage.getItem('sb_google_access_token');
        setAccessToken(userToken || null);
      } else {
        setAccessToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sb_google_access_token');
        }
      }
    });

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('sb_google_token_expired', handleTokenExpired);
      }
    };
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

      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        setAccessToken(credential.accessToken);
        if (typeof window !== 'undefined') {
          localStorage.setItem('sb_google_access_token', credential.accessToken);
          if (result.user?.uid) {
            localStorage.setItem(`sb_google_access_token_${result.user.uid}`, credential.accessToken);
          }
        }
        return credential.accessToken;
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const uid = user?.uid;
      await signOut(auth);
      setAccessToken(null);
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sb_google_access_token');
        if (uid) {
          localStorage.removeItem(`sb_google_access_token_${uid}`);
        }
        sessionStorage.removeItem('ckp_prefill');
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
