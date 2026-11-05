'use client';

import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'theme';

/**
 * Runs in <head> before the first paint so the page never flashes the wrong theme
 * (see "Preventing flash before hydration" in the Next.js docs).
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}")||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

function readPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  // Applies the class before paint (also after React's development remount).
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): the choice lasts for this visit.
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
