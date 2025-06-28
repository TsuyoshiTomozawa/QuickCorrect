import React, { useEffect, useState } from "react";
import App from "./App";
import { ThemeProvider, ThemeMode } from "./contexts/ThemeContext";
import { useSettings } from "./hooks";

const AppWithTheme: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  // Determine the effective theme based on settings
  useEffect(() => {
    if (!settings?.appearance?.theme) return;

    if (settings.appearance.theme === "system") {
      // Use system preference
      const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setThemeMode(isDarkMode ? "dark" : "light");
    } else {
      // Use explicit theme setting
      setThemeMode(settings.appearance.theme);
    }
  }, [settings?.appearance?.theme]);

  // Handle theme change
  const handleThemeChange = (mode: ThemeMode) => {
    // Only update settings if not in system mode
    if (settings?.appearance?.theme !== "system") {
      updateSettings({
        appearance: {
          theme: mode,
        },
      });
    }
  };

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