import { Color } from "expo-router";
import { Platform } from "react-native";

export function getColors(scheme?: "light" | "dark" | null) {
  const isDark = scheme === "dark";

  return {
    // Primary Brand Context
    primary: Platform.select({
      ios: Color.ios.systemOrange,
      android: Color.android.dynamic.primary,
      default: isDark ? "#FF9F0A" : "#FF9500",
    }),
    onPrimary: Platform.select({
      ios: "#FFFFFF",
      android: Color.android.dynamic.onPrimary,
      default: "#FFFFFF",
    }),
    primaryContainer: Platform.select({
      ios: Color.ios.systemFill,
      android: Color.android.dynamic.primaryContainer,
      default: isDark ? "#4d2d00" : "#ffe6c2",
    }),
    onPrimaryContainer: Platform.select({
      ios: Color.ios.systemOrange,
      android: Color.android.dynamic.onPrimaryContainer,
      default: isDark ? "#ffb866" : "#e68600",
    }),

    // Background & Surfaces
    background: Platform.select({
      ios: Color.ios.systemBackground,
      android: Color.android.dynamic.surface, // fallback as M3 on Android often uses surface base for background
      default: isDark ? "#000000" : "#FFFFFF",
    }),
    onBackground: Platform.select({
      ios: Color.ios.label,
      android: Color.android.dynamic.onSurface,
      default: isDark ? "#FFFFFF" : "#000000",
    }),
    surface: Platform.select({
      ios: Color.ios.secondarySystemBackground,
      android: Color.android.dynamic.surfaceContainerLow,
      default: isDark ? "#1C1C1E" : "#F2F2F7",
    }),
    onSurface: Platform.select({
      ios: Color.ios.label,
      android: Color.android.dynamic.onSurface,
      default: isDark ? "#FFFFFF" : "#000000",
    }),
    surfaceVariant: Platform.select({
      ios: Color.ios.tertiarySystemBackground,
      android: Color.android.dynamic.surfaceVariant,
      default: isDark ? "#2C2C2E" : "#E5E5EA",
    }),
    onSurfaceVariant: Platform.select({
      ios: Color.ios.secondaryLabel,
      android: Color.android.dynamic.onSurfaceVariant,
      default: isDark ? "#EBEBF599" : "#3C3C4399",
    }),

    // Outlines / Borders / Dividers / Tertiary Elements
    outline: Platform.select({
      ios: Color.ios.tertiaryLabel,
      android: Color.android.dynamic.outline,
      default: isDark ? "#48484A" : "#AEAEB2",
    }),
    outlineVariant: Platform.select({
      ios: Color.ios.separator,
      android: Color.android.dynamic.outlineVariant,
      default: isDark ? "#38383A" : "#C6C6C8",
    }),

    // Semantic States
    success: Platform.select({
      ios: Color.ios.systemGreen,
      android: isDark ? "#81C784" : "#388E3C",
      default: isDark ? "#32D74B" : "#34C759",
    }),
    warning: Platform.select({
      ios: Color.ios.systemYellow,
      android: isDark ? "#FFD54F" : "#FBC02D",
      default: isDark ? "#FFD60A" : "#FFCC00",
    }),
    error: Platform.select({
      ios: Color.ios.systemRed,
      android: Color.android.dynamic.error,
      default: isDark ? "#FF453A" : "#FF3B30",
    }),
    onError: Platform.select({
      ios: "#FFFFFF",
      android: Color.android.dynamic.onError,
      default: "#FFFFFF",
    }),
    info: Platform.select({
      ios: Color.ios.systemTeal,
      android: isDark ? "#4DD0E1" : "#00ACC1",
      default: isDark ? "#64D2FF" : "#5AC8FA",
    }),

    // Overlays & Shadows
    overlay: Platform.select({
      ios: Color.ios.systemGray5,
      android: Color.android.dynamic.surfaceContainerHighest,
      default: "rgba(0,0,0,0.1)",
    }),
    shadow: Platform.select({
      ios: Color.ios.systemGray4,
      android: Color.android.dynamic.shadow,
      default: "rgba(0,0,0,0.25)",
    }),
  };
}

export type ThemeColors = ReturnType<typeof getColors>;