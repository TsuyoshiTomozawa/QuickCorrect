import React, { useEffect, useState, useCallback } from "react";
import App from "./App";
import { ThemeProvider, ThemeMode } from "./contexts/ThemeContext";
import { useSettings } from "./hooks";

const AppWithTheme: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  
  // Initialize theme only once on mount
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (settings?.appearance?.theme && settings.appearance.theme !== "system") {
      return settings.appearance.theme;
    }
    // Fall back to system preference
    const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return isDarkMode ? "dark" : "light";
  });

  // Update theme when settings change
  useEffect(() => {
    const theme = settings?.appearance?.theme || "system";
    
    if (theme === "system") {
      // Use system preference
      const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setThemeMode(isDarkMode ? "dark" : "light");
    } else {
      // Use explicit theme setting
      setThemeMode(theme);
    }
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