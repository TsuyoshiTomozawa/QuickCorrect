import React, { createContext, useContext, useState, useEffect } from "react";
import { ThemeProvider as StyledThemeProvider } from "styled-components";

// Theme type definitions
export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  // Primary colors
  background: string;
  surface: string;
  surfaceHover: string;
  
  // Text colors
  text: string;
  textSubtle: string;
  textInverse: string;
  
  // Accent colors
  accent: string;
  accentHover: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  
  // Border colors
  border: string;
  borderSubtle: string;
  
  // Shadow colors
  shadow: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
}

// Theme definitions
const lightTheme: Theme = {
  mode: "light",
  colors: {
    // Primary colors
    background: "#F8F8F8",
    surface: "#FFFFFF",
    surfaceHover: "#F0F0F0",
    
    // Text colors
    text: "#333333",
    textSubtle: "#888888",
    textInverse: "#FFFFFF",
    
    // Accent colors
    accent: "#333333",
    accentHover: "#000000",
    
    // Status colors
    success: "#147033",
    warning: "#CC6400",
    error: "#CC2016",
    
    // Border colors
    border: "#EAEAEA",
    borderSubtle: "#F5F5F5",
    
    // Shadow colors
    shadow: "rgba(0, 0, 0, 0.08)",
  },
};

const darkTheme: Theme = {
  mode: "dark",
  colors: {
    // Primary colors
    background: "#181818",
    surface: "#222222",
    surfaceHover: "#2A2A2A",
    
    // Text colors
    text: "#E5E5E5",
    textSubtle: "#999999",
    textInverse: "#181818",
    
    // Accent colors
    accent: "#E5E5E5",
    accentHover: "#FFFFFF",
    
    // Status colors
    success: "#32D74B",
    warning: "#FF9F0A",
    error: "#FF453A",
    
    // Border colors
    border: "#333333",
    borderSubtle: "#2A2A2A",
    
    // Shadow colors
    shadow: "rgba(0, 0, 0, 0.5)",
  },
};

// Theme context
interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Theme provider component
interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeMode;
  onThemeChange?: (mode: ThemeMode) => void;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme,
  onThemeChange,
}) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    // Check for saved theme preference
    if (initialTheme) return initialTheme;
    
    // Check system preference
    if (typeof window !== "undefined" && window.matchMedia) {
      const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return isDarkMode ? "dark" : "light";
    }
    
    return "light";
  });

  const theme = themeMode === "dark" ? darkTheme : lightTheme;

  // Watch for system theme changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (!initialTheme) {
        // Only update if no explicit theme is set
        setThemeModeState(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [initialTheme]);

  // Notify parent component of theme changes
  useEffect(() => {
    onThemeChange?.(themeMode);
  }, [themeMode, onThemeChange]);

  const toggleTheme = () => {
    setThemeModeState((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const contextValue: ThemeContextValue = {
    theme,
    themeMode,
    toggleTheme,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <StyledThemeProvider theme={theme}>{children}</StyledThemeProvider>
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

// Helper function to create focus shadow with proper opacity
export const getFocusShadow = (theme: Theme): string => {
  const rgb = theme.colors.accent.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (rgb) {
    const r = parseInt(rgb[1], 16);
    const g = parseInt(rgb[2], 16);
    const b = parseInt(rgb[3], 16);
    return `0 0 0 3px rgba(${r}, ${g}, ${b}, 0.2)`;
  }
  return `0 0 0 3px ${theme.colors.accent}33`; // Fallback
};

// Export themes for testing or direct usage
export { lightTheme, darkTheme };