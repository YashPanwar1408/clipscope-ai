"use client";

import * as React from "react";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = "clipscope-theme";
const THEME_CHANGE_EVENT = "clipscope-theme-change";

function getThemeSnapshot(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, callback);
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: Theme;
}) {
  const getServerSnapshot = React.useCallback(() => initialTheme, [initialTheme]);
  const theme = React.useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerSnapshot);

  const setTheme = React.useCallback((nextTheme: Theme) => {
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Keep the in-memory selection if browser storage is unavailable.
    }
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${THEME_STORAGE_KEY}=${nextTheme}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  // Migrate preferences saved by the older localStorage-only theme toggle.
  // useLayoutEffect applies it before the browser paints hydrated content.
  React.useLayoutEffect(() => {
    const hasThemeCookie = document.cookie
      .split(";")
      .some((entry) => entry.trim().startsWith(`${THEME_STORAGE_KEY}=`));
    if (hasThemeCookie) return;

    let savedTheme: string | null = null;
    try {
      savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return;
    }

    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, [setTheme]);

  const toggleTheme = React.useCallback(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
  }, [setTheme]);

  const value = React.useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
