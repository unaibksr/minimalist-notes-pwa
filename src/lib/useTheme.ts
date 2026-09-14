import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';
const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const readStoredMode = (): ThemeMode => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
};

const applyMode = (mode: ThemeMode) => {
  const dark = mode === 'dark' || (mode === 'system' && prefersDark());
  document.documentElement.classList.toggle('dark', dark);
};

/**
 * Single source of truth for theming. Supports explicit light/dark plus a
 * `system` mode that follows the OS and updates live, persisted to localStorage.
 */
export const useTheme = () => {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    applyMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode, systemDark]);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);

  const cycleMode = useCallback(() => {
    setModeState((prev) =>
      prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'
    );
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);

  return { mode, setMode, cycleMode, isDark };
};
