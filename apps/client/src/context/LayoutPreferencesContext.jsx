import { createContext, useContext, useEffect, useState } from "react";

// Only what the visitor picks in Settings is saved, so a changed default reaches everyone who never picked
const STORAGE_KEY = "mintora_layout_choices";
// The old key saved every pref, defaults included (both were "right" then), so only values that differ were picked
const OLD_STORAGE_KEY = "mintora_layout_prefs";
const OLD_DEFAULTS = { sidebarPosition: "right", logoPosition: "right" };

const defaultPrefs = {
  sidebarPosition: "left",
  logoPosition: "right",
};

function loadChoices() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || "{}");
    return Object.fromEntries(Object.entries(old).filter(([key, value]) => key in OLD_DEFAULTS && value !== OLD_DEFAULTS[key]));
  } catch {
    return {};
  }
}

const LayoutPreferencesContext = createContext(null);

export function LayoutPreferencesProvider({ children }) {
  const [choices, setChoices] = useState(loadChoices);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
      localStorage.removeItem(OLD_STORAGE_KEY);
    } catch {}
  }, [choices]);

  const value = {
    ...defaultPrefs,
    ...choices,
    setSidebarPosition: (pos) => setChoices((c) => ({ ...c, sidebarPosition: pos })),
    setLogoPosition: (pos) => setChoices((c) => ({ ...c, logoPosition: pos })),
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
