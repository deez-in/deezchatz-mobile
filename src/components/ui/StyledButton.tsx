import type { ReactNode } from "react";
import {
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useThemedStyles } from "@/src/hooks/useTheme";
import { ThemeColors } from "@/src/models/theme";

export interface StyledButtonProps extends PressableProps {
  variant?: "default" | "link";
  children?: ReactNode;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>) | any;
  disabledStyle?: StyleProp<ViewStyle>;
}

const buttonStylesFactory = (colors: ThemeColors) => ({
  base: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  default: {
    backgroundColor: colors.primary,
  },
  pressedDefault: {
    opacity: 0.7,
  },
  disabledDefault: {
    backgroundColor: colors.surfaceVariant,
  },
  link: {
    backgroundColor: "transparent",
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
  },
  pressedLink: {
    opacity: 0.5,
  },
  disabledLink: {
    opacity: 0.4,
  },
});

const StyledButton = ({
  style: styles,
  variant = "default",
  children,
  disabled,
  disabledStyle,
  accessibilityState,
  ...restProps
}: StyledButtonProps) => {
  const dynamicStyles = useThemedStyles(buttonStylesFactory);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      disabled={disabled}
      style={({ pressed }) => [
        dynamicStyles.base,
        variant === "default" && dynamicStyles.default,
        variant === "link" && dynamicStyles.link,
        typeof styles === "function" ? styles({ pressed }) : styles,
        pressed && !disabled && variant === "default" && dynamicStyles.pressedDefault,
        pressed && !disabled && variant === "link" && dynamicStyles.pressedLink,
        disabled && variant === "default" && dynamicStyles.disabledDefault,
        disabled && variant === "link" && dynamicStyles.disabledLink,
        disabled && disabledStyle,
      ]}
      {...restProps}
    >
      {children}
    </Pressable>
  );
};

export default StyledButton;
