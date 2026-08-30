import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTheme } from "@/src/hooks/useTheme";

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <NativeTabs
      tintColor={colors.onPrimary}
      backgroundColor={colors.surface}
      indicatorColor={colors.primaryContainer}
      iconColor={{
        default: colors.onSurfaceVariant,
        selected: colors.onPrimaryContainer as string,
      }}
      labelStyle={{
        default: { color: colors.onSurfaceVariant },
        selected: { color: colors.onPrimaryContainer as string, fontWeight: "600" },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Chats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="message" md="chat" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
