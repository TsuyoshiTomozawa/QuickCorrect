import React, { useEffect, useState } from "react";
import App from "./App";
import { ThemeProvider, ThemeMode } from "./contexts/ThemeContext";
import { useSettings } from "./hooks";

const AppWithTheme: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  
  // Initialize theme based on settings or system preference
  const getInitialTheme = (): ThemeMode => {
    if (settings?.appearance?.theme && settings.appearance.theme !== "system") {
      return settings.appearance.theme;
    }
    // Fall back to system preference
    const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return isDarkMode ? "dark" : "light";
  };
  
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);

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