import { type MutableRefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const THEME_STORAGE_KEY = "chronoflight-theme-preference";
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";
const THEME_TRANSITION_CLASS = "theme-transitioning";
const THEME_TRANSITION_TIMEOUT_MS = 500;

export const themeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" }
];

const isThemePreference = (value: string | null): value is ThemePreference => {
  return value === "light" || value === "dark" || value === "system";
};

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light";
};

const getStoredThemePreference = (): ThemePreference => {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(storedPreference) ? storedPreference : "system";
  } catch {
    return "system";
  }
};

const applyTheme = (
  resolvedTheme: ResolvedTheme,
  shouldTransition: boolean,
  transitionTimerRef: MutableRefObject<number | null>
) => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const isThemeChanging = root.dataset.theme !== resolvedTheme;

  if (shouldTransition && isThemeChanging && typeof window !== "undefined") {
    root.classList.add(THEME_TRANSITION_CLASS);
    // Force the transition class to apply before changing color tokens.
    void root.offsetWidth;

    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }

    transitionTimerRef.current = window.setTimeout(() => {
      root.classList.remove(THEME_TRANSITION_CLASS);
      transitionTimerRef.current = null;
    }, THEME_TRANSITION_TIMEOUT_MS);
  }

  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
};

export const useThemePreference = () => {
  const hasAppliedInitialTheme = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>(getStoredThemePreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  const resolvedTheme = useMemo<ResolvedTheme>(() => {
    return themePreference === "system" ? systemTheme : themePreference;
  }, [systemTheme, themePreference]);

  useLayoutEffect(() => {
    applyTheme(resolvedTheme, hasAppliedInitialTheme.current, transitionTimerRef);
    hasAppliedInitialTheme.current = true;
  }, [resolvedTheme]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }

      document.documentElement.classList.remove(THEME_TRANSITION_CLASS);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    } catch {
      // localStorage can be unavailable in private or restricted browser contexts.
    }
  }, [themePreference]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY);
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return {
    resolvedTheme,
    setThemePreference,
    themePreference
  };
};
