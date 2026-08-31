import { useState } from "react";
import { StyleSheet, TextInput as Input, TextInputProps } from "react-native";
import { useThemedStyles } from "@/src/hooks/useTheme";

export const StyledTextInput = ({ style: styles, ...restProps }: TextInputProps) => {
  const [isInFocus, setIsInFocus] = useState(false);
  const defaultStyles = useThemedStyles((colors) => ({
    textInputDefault: {
      color: colors.onBackground,
      borderWidth: 2,
      padding: 8,
      borderRadius: 5,
      borderColor: colors.outlineVariant,
    },
    textInputActive: {
      borderColor: colors.primary,
    },
    placeholder: {
      color: colors.outline,
    },
  }));
  return (
    <Input
      placeholderTextColor={defaultStyles.placeholder.color as string}
      style={StyleSheet.flatten([
        defaultStyles.textInputDefault,
        isInFocus ? defaultStyles.textInputActive : undefined,
        styles,
      ])}
      onFocus={() => setIsInFocus(true)}
      onBlur={() => setIsInFocus(false)}
      {...restProps}
    />
  );
};

export default StyledTextInput;
