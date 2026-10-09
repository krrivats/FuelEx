import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initializeData } from '../data/storage.js';
import { getSettings, updateSettings as saveSettings } from '../data/repository.js';

const AppContext = createContext(null);

/**
 * AppProvider wraps the entire app.
 * It holds the global theme state and app settings.
 * Data refresh is managed by individual master pages via their own state.
 */
export function AppProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  const [accent, setAccentState] = useState('blue');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Initialize storage / seed data on first load
    initializeData();
    const settings = getSettings();
    setTheme(settings.theme ?? 'dark');
    setAccentState(settings.accent ?? 'blue');
    setInitialized(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      saveSettings({ theme: next });
      return next;
    });
  }, []);

  const setAccent = useCallback((a) => {
    setAccentState(a);
    saveSettings({ accent: a });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
  }, [accent]);

  if (!initialized) return null;

  return (
    <AppContext.Provider value={{ theme, toggleTheme, accent, setAccent }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
