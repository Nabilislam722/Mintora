import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "mintora_layout_prefs";

const defaultPrefs = {
  sidebarPosition: "right",
  logoPosition: "right",
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs;
    return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch {
    return defaultPrefs;
  }
}

const LayoutPreferencesContext = createContext(null);

export function LayoutPreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  const value = {
    ...prefs,
    setSidebarPosition: (pos) => setPrefs((p) => ({ ...p, sidebarPosition: pos })),
    setLogoPosition: (pos) => setPrefs((p) => ({ ...p, logoPosition: pos })),
  };

  return (
    <LayoutPreferencesContext.Provider value={value}>
      {children}
    </LayoutPreferencesContext.Provider>
  );
}

export function useLayoutPreferences() {
  const ctx = useContext(LayoutPreferencesContext);
  if (!ctx) throw new Error("useLayoutPreferences must be used within LayoutPreferencesProvider");
  return ctx;
}