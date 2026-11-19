import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ShoppingBag } from "lucide-react-native";
import { useStore } from "../StoreProvider";
import { colors } from "../theme";

export default function SetupShop() {
  const { createShop } = useStore();
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await createShop({ name, ownerName, phone, address });
    } catch (reason) {
      setError(reason.message || "Could not create the local shop.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandIcon}><ShoppingBag size={27} color="white" strokeWidth={2.2} /></View>
        <Text style={styles.eyebrow}>NEXtill SHOP</Text>
        <Text style={styles.title}>Set up your shop</Text>
        <Text style={styles.subtitle}>This profile is saved on this device first. You can connect Supabase backup later.</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Shop name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Vanik Shop" autoCapitalize="words" accessibilityLabel="Shop name" returnKeyType="next" />
          <Text style={styles.label}>Owner name *</Text>
          <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="Your name" autoCapitalize="words" accessibilityLabel="Owner name" returnKeyType="next" />
          <Text style={styles.label}>Phone number</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+977" keyboardType="phone-pad" accessibilityLabel="Phone number" returnKeyType="next" />
          <Text style={styles.label}>Address</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="City, Nepal" accessibilityLabel="Shop address" returnKeyType="done" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={[styles.button, saving && styles.disabled]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Create shop on this device</Text>}
          </Pressable>
          <Text style={styles.footnote}>No internet connection is required to start.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 36 },
  brandIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", backgroundColor: colors.red, borderRadius: 16 },
  eyebrow: { marginTop: 22, color: colors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  title: { marginTop: 8, color: colors.ink, fontSize: 26, fontWeight: "800" },
  subtitle: { marginTop: 8, color: colors.muted, fontSize: 13, lineHeight: 19 },
  form: { marginTop: 24, padding: 17, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 15 },
  label: { marginTop: 12, marginBottom: 6, color: colors.ink, fontSize: 11, fontWeight: "700" },
  input: { height: 48, paddingHorizontal: 12, color: colors.ink, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 9, fontSize: 13 },
  button: { minHeight: 47, alignItems: "center", justifyContent: "center", marginTop: 18, backgroundColor: colors.red, borderRadius: 9 },
  buttonText: { color: "white", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.6 },
  error: { marginTop: 10, color: colors.red, fontSize: 11 },
  footnote: { marginTop: 12, color: colors.muted, fontSize: 10, textAlign: "center" },
});
