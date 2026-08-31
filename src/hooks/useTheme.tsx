import React, { createContext, useContext, useMemo } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { ThemeColors } from "@/src/models/theme";
import { getColors } from "@/src/static/colors";

export interface ThemeContextType {
  colors: ThemeColors;
  scheme: "light" | "dark" | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // useColorScheme from react-native returns 'light', 'dark', 'unspecified', or null
  // Calling this here triggers a re-render when the system theme changes
  const rawScheme = useColorScheme();
  const scheme = rawScheme === 'light' || rawScheme === 'dark' ? rawScheme : 'light';

  // Force a new object reference on every render to ensure Android dynamic colors
  // are re-evaluated when the scheme changes.
  const colors = useMemo(() => getColors(scheme), [scheme]);

  return (
    <ThemeContext.Provider value={{ colors, scheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}


/**
 * Hook for creating memoized themed styles.
 * Styles are only recomputed when the theme colors change.
 *
 * @example
 * const styles = useThemedStyles((colors) => ({
 *   container: { backgroundColor: colors.background },
 *   text: { color: colors.onBackground },
 * }));
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  styleFactory: (colors: ThemeColors) => T
): T {
  const { colors } = useTheme();
  return useMemo(
    () => StyleSheet.create(styleFactory(colors)),
    // `colors` is now a fresh object when the scheme changes,
    // so styles will recompute with the correct dynamic color values.
    [colors, styleFactory]
  );
}
