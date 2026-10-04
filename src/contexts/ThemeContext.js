'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  theme: 'dark',
  mode: 'system',
  setMode: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('system'); // 'dark' | 'light' | 'system'
  const [theme, setTheme] = useState('dark');       // 'dark' | 'light' (resolved)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedMode = localStorage.getItem('superbrain_theme_mode');
      const savedTheme = localStorage.getItem('superbrain_theme');
      
      const currentAttr = document.documentElement.getAttribute('data-theme');
      let resolved = 'dark';
      
      if (savedMode === 'light' || savedMode === 'dark') {
        resolved = savedMode;
        setModeState(savedMode);
      } else if (savedTheme === 'light' || savedTheme === 'dark') {
        resolved = savedTheme;
        setModeState(savedTheme);
      } else {
        setModeState('system');
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
          resolved = 'light';
        } else {
          resolved = currentAttr || 'dark';
        }
      }

      setTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    } catch (e) {
      console.error('Failed to load theme preference:', e);
    }
  }, []);

  // Listen to OS system color-scheme changes if in 'system' mode
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (mode === 'system') {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [mode, mounted]);

  const applyTheme = (newMode) => {
    let resolvedTheme = newMode;
    if (newMode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolvedTheme = prefersDark ? 'dark' : 'light';
    }

    setModeState(newMode);
    setTheme(resolvedTheme);
    document.documentElement.setAttribute('data-theme', resolvedTheme);

    try {
      localStorage.setItem('superbrain_theme_mode', newMode);
      localStorage.setItem('superbrain_theme', resolvedTheme);
    } catch (e) {
      console.error('Failed to save theme:', e);
    }
  };

  const setMode = (newMode) => {
    applyTheme(newMode);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
