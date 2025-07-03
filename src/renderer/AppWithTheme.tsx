import React, { useEffect, useState, useCallback } from "react";
import App from "./App";
import { ThemeProvider, ThemeMode } from "./contexts/ThemeContext";
import { useSettings } from "./hooks";

// Helper function to resolve theme based on settings
const resolveInitialTheme = (theme: string | undefined): ThemeMode => {
  if (theme && theme !== "system") {
    return theme as ThemeMode;
  }
  // Fall back to system preference
  const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return isDarkMode ? "dark" : "light";
};

const AppWithTheme: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  
  // Initialize theme only once on mount
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return resolveInitialTheme(settings?.appearance?.theme);
  });

  // Update theme when settings change
  useEffect(() => {
    setThemeMode(resolveInitialTheme(settings?.appearance?.theme));
  }, [settings?.appearance?.theme]);

  // Handle theme change
  const handleThemeChange = useCallback((mode: ThemeMode) => {
    // Only update settings if not in system mode and the theme actually changed
    if (settings?.appearance?.theme !== "system" && settings?.appearance?.theme !== mode) {
      updateSettings({
        appearance: {
          theme: mode,
        },
      });
    }
  }, [settings?.appearance?.theme, updateSettings]);

  return (
    <ThemeProvider
      initialTheme={themeMode}
      onThemeChange={handleThemeChange}
    >
      <App />
    </ThemeProvider>
  );
};

export default AppWithTheme;