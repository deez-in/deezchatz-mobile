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
    style?: StyleProp<ViewStyle> | any;
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
  link: {
    backgroundColor: "transparent",
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
  },
  pressedLink: {
    opacity: 0.5,
  },
});

const StyledButton = ({
  style: styles,
  variant = "default",
  children,
  ...restProps
}: StyledButtonProps) => {
  const dynamicStyles = useThemedStyles(buttonStylesFactory);

  return (
    <Pressable
      style={({ pressed }) => [
        dynamicStyles.base,
        variant === "default" && dynamicStyles.default,
        variant === "link" && dynamicStyles.link,
        pressed && variant === "default" && dynamicStyles.pressedDefault,
        pressed && variant === "link" && dynamicStyles.pressedLink,
        styles,
      ]}
      {...restProps}
    >
      {children}
    </Pressable>
  );
};

export default StyledButton;
