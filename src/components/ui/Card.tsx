import type { ReactNode } from "react";
import { StyleSheet, View, StyleProp, ViewStyle } from "react-native";
import { useThemedStyles } from "@/src/hooks/useTheme";

export interface CardProps {
    styles?: StyleProp<ViewStyle>;
    children: ReactNode;
}

export default function Card({
  children,
  styles,
}: CardProps) {
  const themedStyle = useThemedStyles((colors) => ({
    default: {
      marginVertical: 4,
      padding: 4,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
  }));
  return (
    <View style={StyleSheet.flatten([themedStyle.default, styles])}>
      {children}
    </View>
  );
}
