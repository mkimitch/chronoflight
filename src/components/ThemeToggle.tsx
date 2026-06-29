import React from "react";
import { ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { ResolvedTheme, ThemePreference, themeOptions } from "../hooks/useThemePreference";

interface ThemeToggleProps {
  value: ThemePreference;
  resolvedTheme: ResolvedTheme;
  onChange: (value: ThemePreference) => void;
}

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor
};

export default function ThemeToggle({
  value,
  resolvedTheme,
  onChange
}: ThemeToggleProps) {
  const ThemeIcon = themeIcons[value];

  return (
    <label className="theme-toggle" htmlFor="select-theme">
      <span className="theme-toggle__label">Theme</span>
      <span className="theme-toggle__control">
        <ThemeIcon className="icon icon--sm theme-toggle__icon" aria-hidden="true" />
        <select
          id="select-theme"
          value={value}
          onChange={(event) => onChange(event.target.value as ThemePreference)}
          className="theme-toggle__select"
          title={`Theme: ${value}. Currently using ${resolvedTheme} mode.`}
        >
          {themeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="icon icon--xs theme-toggle__chevron" aria-hidden="true" />
      </span>
    </label>
  );
}
