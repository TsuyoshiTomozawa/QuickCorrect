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
    background: "#F2F2F7",
    surface: "#FFFFFF",
    surfaceHover: "#F5F5F5",
    
    // Text colors
    text: "#1C1C1E",
    textSubtle: "#636366", // Improved from #8E8E93 for better contrast
    textInverse: "#FFFFFF",
    
    // Accent colors
    accent: "#0051D5", // Darker blue for better contrast
    accentHover: "#003DA5",
    
    // Status colors
    success: "#147033", // Darker green for better contrast
    warning: "#CC6400", // Darker orange for better contrast
    error: "#CC2016", // Darker red for better contrast
    
    // Border colors
    border: "#E5E5EA",
    borderSubtle: "#F2F2F7",
    
    // Shadow colors
    shadow: "rgba(0, 0, 0, 0.1)",
  },
};

const darkTheme: Theme = {
  mode: "dark",
  colors: {
    // Primary colors
    background: "#1A1A1A",
    surface: "#2C2C2E",
    surfaceHover: "#3A3A3C",
    
    // Text colors
    text: "#F2F2F7",
    textSubtle: "#AEAEB2", // Improved from #8E8E93 for better contrast
    textInverse: "#1C1C1E",
    
    // Accent colors
    accent: "#0A84FF",
    accentHover: "#409CFF",
    
    // Status colors
    success: "#32D74B",
    warning: "#FF9F0A",
    error: "#FF453A",
    
    // Border colors
    border: "#48484A",
    borderSubtle: "#3A3A3C",
    
    // Shadow colors
    shadow: "rgba(0, 0, 0, 0.3)",
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

// Export themes for testing or direct usage
export { lightTheme, darkTheme };