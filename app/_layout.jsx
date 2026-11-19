import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StoreProvider } from "../src/StoreProvider";
import { registerBackupTask } from "../src/lib/backgroundSync";
import { colors } from "../src/theme";

export default function RootLayout() {
  useEffect(() => {
    registerBackupTask().catch((error) => {
      console.error("Could not register the best-effort backup task.", error);
    });
  }, []);

  return (
    <StoreProvider>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="expenses" />
        <Stack.Screen name="customers" />
        <Stack.Screen name="due-payments" />
        <Stack.Screen name="staff" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="scanner" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="checkout" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      </Stack>
    </StoreProvider>
  );
}
