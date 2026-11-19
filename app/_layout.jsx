import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StoreProvider } from "../src/StoreProvider";
import { registerBackupTask } from "../src/lib/backgroundSync";

export default function RootLayout() {
  useEffect(() => {
    registerBackupTask().catch((error) => {
      console.error("Could not register the best-effort backup task.", error);
    });
  }, []);

  return (
    <StoreProvider>
      <StatusBar style="light" backgroundColor="#191a1f" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#f4f5f7" } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scanner" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="checkout" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      </Stack>
    </StoreProvider>
  );
}
