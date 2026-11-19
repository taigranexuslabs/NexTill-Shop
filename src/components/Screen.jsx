import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStore } from "../StoreProvider";
import { colors } from "../theme";
import SetupShop from "./SetupShop";

export function AppScreen({ children, scroll = true, contentStyle, ...props }) {
  const { ready, shop } = useStore();
  if (!ready) {
    return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.red} /></SafeAreaView>;
  }
  if (!shop) return <SetupShop />;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} {...props}>
      {scroll
        ? <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        : <View style={[styles.content, contentStyle]}>{children}</View>}
    </SafeAreaView>
  );
}

export function ScreenHeader({ title, subtitle, action }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && !disabled && styles.pressed, style]}
    >
      <Text style={styles.primaryText}>{title}</Text>
    </Pressable>
  );
}

export function Surface({ children, style }) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function OfflineNotice({ message }) {
  if (!message) return null;
  return <View style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View>;
}

export const commonStyles = styles;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  headerCopy: { flex: 1 },
  title: { color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { marginTop: 5, color: colors.muted, fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, backgroundColor: colors.red, borderRadius: 13 },
  primaryText: { color: "white", fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  surface: { padding: 16, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 16, shadowColor: "#23352e", shadowOpacity: 0.035, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  notice: { marginVertical: 8, padding: 12, backgroundColor: "#fff4e2", borderRadius: 10 },
  noticeText: { color: "#91601e", fontSize: 12, lineHeight: 18 },
});
