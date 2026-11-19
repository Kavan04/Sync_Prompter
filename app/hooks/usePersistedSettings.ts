import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { STORAGE_KEY, parseSavedSettings, type SavedSettings } from "../lib/savedSettings";

// Settings are read from localStorage during render instead of being copied
// into state by an effect. Nothing is written on mount, so React StrictMode
// cannot overwrite the saved value with defaults.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach(listener => listener());
}

function readStoredRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredRaw(raw: string): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export function usePersistedSettings() {
  // The server render has no stored value, so it uses the defaults. The
  // client re-renders with what is stored once it has hydrated.
  const stored = useSyncExternalStore(subscribe, readStoredRaw, () => null);
  // Holds the latest edit only while storage refuses writes, so typing still works.
  const [unsaved, setUnsaved] = useState<string | null>(null);

  const raw = unsaved ?? stored;
  const settings = useMemo(() => parseSavedSettings(raw), [raw]);

  const updateSettings = useCallback(
    (patch: Partial<SavedSettings>) => {
      const next = JSON.stringify({ ...settings, ...patch });
      setUnsaved(writeStoredRaw(next) ? null : next);
      notify();
    },
    [settings]
  );

  return { settings, updateSettings };
}
