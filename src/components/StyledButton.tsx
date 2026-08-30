import {
  Pressable,
  PressableProps,
  ViewStyle,
} from "react-native";
import { useThemedStyles } from "@/src/hooks/useTheme";
import { ThemeColors } from "@/src/static/colors";

interface StyledButtonProps extends PressableProps {
  variant?: "default" | "link";
  style?: ViewStyle | ViewStyle[];
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
    backgroundColor: colors.primary,
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.45,
  },
  link: {
    backgroundColor: "transparent",
  },
  pressedLink: {
    opacity: 0.6,
  },
  textDefault: {
    color: colors.onPrimary,
    fontWeight: '600' as const,
    fontSize: 16,
  },
  textLink: {
    color: colors.primary,
    fontWeight: '600' as const,
    fontSize: 16,
  },
});

const StyledButton = ({
  style,
  variant = "default",
  children,
  disabled,
  ...restProps
}: StyledButtonProps) => {
  const styles = useThemedStyles(buttonStylesFactory);

  return (
    <Pressable
      disabled={disabled}
      android_ripple={
        variant === "default" && !disabled
          ? { color: "#00000020" }  // Use string color; PlatformColor values don't work with android_ripple
          : undefined
      }
      style={({ pressed }) => [
        styles.base,
        variant === "link" ? styles.link : styles.default,
        pressed && !disabled && (variant === "link" ? styles.pressedLink : styles.pressedDefault),
        disabled && styles.disabled,
        style,
      ]}
      {...restProps}
    >
      {children}
    </Pressable>
  );
};

export default StyledButton;
