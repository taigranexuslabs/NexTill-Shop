import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AlertTriangle, ArrowLeft, Cloud, CloudUpload, Eye, EyeOff, UserRound } from "lucide-react-native";
import { AppScreen, PrimaryButton, ScreenHeader, Surface } from "../../src/components/Screen";
import { useStore } from "../../src/StoreProvider";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme";

export default function SettingsScreen() {
  const {
    shop, session, cloudConfigured, backupTime, backupInterval, lastBackupAt,
    syncStatus, syncMessage, conflicts, signIn, syncNow, updateBackupSchedule,
    resolveConflict, refresh,
  } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [time, setTime] = useState(backupTime);
  const [interval, setInterval] = useState(backupInterval);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");

  function showMessage(text, tone = "success") {
    setMessage(text);
    setMessageTone(tone);
  }

  if (!shop) return <AppScreen />;

  async function connect() {
    setBusy(true);
    showMessage("");
    try {
      await signIn(email.trim(), password, createAccount);
      setPassword("");
      setShowPassword(false);
      showMessage(createAccount ? "Account request submitted." : "Account connected.");
    } catch (error) {
      showMessage(error.message || "Could not connect your account.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule() {
    try {
      await updateBackupSchedule(time, interval);
      showMessage("Backup schedule saved on this device.");
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function backup() {
    setBusy(true);
    showMessage("");
    try {
      const result = await syncNow();
      showMessage(`Backup complete. ${result.saleCount} sales and ${result.productCount} products copied to Supabase.`);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showMessage("Signed out. Local data remains on this device.");
      await refresh();
    } catch (error) {
      showMessage(error.message || "Could not sign out.", "error");
    }
  }

  async function resolve(item, strategy) {
    try {
      await resolveConflict(item, strategy);
      showMessage("Conflict marked resolved. Sync again to apply the selected version.");
    } catch (error) {
      Alert.alert("Needs review", error.message);
    }
  }

  return (
    <AppScreen>
      <ScreenHeader title="Settings" subtitle="Local storage, cloud backup, and account" action={<Pressable style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Back"><ArrowLeft size={17} color={colors.red} /><Text style={styles.backText}>Back</Text></Pressable>} />
      <Surface style={styles.statusCard}>
        <View style={styles.statusLine}><View style={[styles.dot, syncStatus === "synced" && styles.dotGreen, syncStatus === "error" && styles.dotRed]} /><Cloud size={16} color="white" strokeWidth={2} /><Text style={styles.statusTitle}>{syncStatus === "syncing" ? "Sync in progress" : session ? "Cloud account connected" : "Offline-first mode"}</Text></View>
        <Text style={styles.shopName}>{shop.name} · {shop.owner_name}</Text>
        <Text style={styles.body}>Sales and inventory are written to this device first. Cloud sync is a backup and sharing layer.</Text>
        {lastBackupAt ? <Text style={styles.meta}>Last backup: {new Date(lastBackupAt).toLocaleString()}</Text> : <Text style={styles.meta}>No cloud backup completed yet.</Text>}
      </Surface>
      <View style={styles.sectionHeader}><CloudUpload size={14} color={colors.red} strokeWidth={2} /><Text style={styles.section}>BACKUP SCHEDULE</Text></View>
      <Surface>
        <Text style={styles.body}>Preferred local backup time</Text>
        <View style={styles.scheduleRow}><View style={styles.timeField}><Text style={styles.fieldLabel}>TIME</Text><TextInput value={time} onChangeText={setTime} placeholder="06:00" style={styles.input} keyboardType="numbers-and-punctuation" maxLength={5} accessibilityLabel="Backup time in 24-hour format" /><Text style={styles.meta}>24-hour local time</Text></View><View style={styles.intervalField}><Text style={styles.fieldLabel}>EVERY (DAYS)</Text><TextInput value={interval} onChangeText={setInterval} placeholder="1" style={styles.input} keyboardType="number-pad" maxLength={3} accessibilityLabel="Backup interval in days" /><Text style={styles.meta}>1 = daily</Text></View></View>
        <PrimaryButton title="Save backup schedule" onPress={saveSchedule} />
        <Text style={styles.warning}>Mobile OS background work is best-effort; iOS/Android can delay the 6 AM run. Sync also checks on app open/reconnect, and you can back up now.</Text>
        <PrimaryButton title={busy ? "Working…" : "Back up now"} disabled={busy || !cloudConfigured} onPress={backup} style={styles.manualButton} />
        {!cloudConfigured ? <Text style={styles.error}>Add the Supabase URL and anon key in mobile/.env to enable cloud backup.</Text> : null}
      </Surface>
      <View style={styles.sectionHeader}><UserRound size={14} color={colors.red} strokeWidth={2} /><Text style={styles.section}>SUPABASE ACCOUNT</Text></View>
      <Surface>
        {session ? <><Text style={styles.body}>Signed in as {session.user.email}</Text><PrimaryButton title={busy ? "Syncing…" : "Sync and back up now"} disabled={busy} onPress={backup} style={styles.manualButton} /><Pressable onPress={signOut} style={styles.signOut}><Text style={styles.signOutText}>Sign out (keep local data)</Text></Pressable></> : <>
          <Text style={styles.body}>{createAccount ? "Create an account while online. Your local shop data will remain available offline." : "Sign in to sync this device with your Supabase shop."}</Text>
          <Text style={styles.fieldLabel}>Email address</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={styles.input} accessibilityLabel="Email address" />
          <Text style={[styles.fieldLabel, styles.passwordLabel]}>Password</Text>
          <View style={styles.passwordField}>
            <TextInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry={!showPassword} autoComplete={createAccount ? "new-password" : "current-password"} style={styles.passwordControl} accessibilityLabel="Password" />
            <Pressable style={styles.passwordToggle} onPress={() => setShowPassword(!showPassword)} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}
            </Pressable>
          </View>
          <PrimaryButton title={busy ? "Connecting…" : createAccount ? "Create account" : "Sign in"} disabled={busy || !cloudConfigured || !email.trim() || !password} onPress={connect} />
          <Pressable onPress={() => setCreateAccount(!createAccount)} style={styles.switchAuth}><Text style={styles.switchText}>{createAccount ? "Already registered? Sign in" : "New to NexTill? Create account"}</Text></Pressable>
        </>}
        {message || syncMessage ? <Text style={[styles.message, (messageTone === "error" || syncStatus === "error") && styles.messageError]}>{message || syncMessage}</Text> : null}
      </Surface>
      <View style={styles.sectionHeader}><AlertTriangle size={14} color={colors.red} strokeWidth={2} /><Text style={styles.section}>SYNC CONFLICTS ({conflicts.length})</Text></View>
      <Surface>
        {conflicts.length === 0 ? <Text style={styles.body}>No conflicts to review.</Text> : conflicts.map((item) => <View key={item.id} style={styles.conflict}>
          <Text style={styles.conflictTitle}>{item.entity_type === "product" ? "Product update conflict" : "Sale needs review"}</Text>
          <Text style={styles.meta}>{item.reason}</Text>
          {item.entity_type === "product" && item.server_payload ? <View style={styles.conflictActions}><Pressable onPress={() => resolve(item, "server")}><Text style={styles.switchText}>Use server version</Text></Pressable><Pressable onPress={() => resolve(item, "local")}><Text style={styles.switchText}>Keep my version</Text></Pressable></View> : <Text style={styles.warning}>This sale remains safely stored on the device; review stock and payment before retrying.</Text>}
        </View>)}
      </Surface>
      <Text style={styles.footer}>NexTill Shop · Data is stored locally first. Never share a Supabase service-role key with the app.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  statusCard: { backgroundColor: colors.dark, borderColor: colors.dark },
  backButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 5 },
  backText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 5, backgroundColor: "#d9a03c" },
  dotGreen: { backgroundColor: "#31c886" },
  dotRed: { backgroundColor: "#ef6963" },
  statusTitle: { color: "white", fontSize: 12, fontWeight: "800" },
  shopName: { marginTop: 10, color: "white", fontSize: 14, fontWeight: "800" },
  body: { marginTop: 6, color: colors.muted, fontSize: 11, lineHeight: 16 },
  meta: { marginTop: 7, color: "#9096a0", fontSize: 9, lineHeight: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 17, marginBottom: 7 },
  section: { color: "#7f8792", fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  scheduleRow: { flexDirection: "row", gap: 9, marginTop: 12, marginBottom: 12 },
  timeField: { flex: 1 },
  intervalField: { width: 102 },
  fieldLabel: { marginBottom: 5, color: "#848b95", fontSize: 9, fontWeight: "800" },
  input: { height: 44, paddingHorizontal: 10, color: colors.ink, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 8, fontSize: 12 },
  warning: { marginTop: 9, color: "#99631f", backgroundColor: "#fff5e5", borderRadius: 7, padding: 8, fontSize: 9, lineHeight: 14 },
  manualButton: { marginTop: 10 },
  error: { marginTop: 9, color: colors.red, fontSize: 10 },
  passwordLabel: { marginTop: 11 },
  passwordField: { minHeight: 44, flexDirection: "row", alignItems: "center", marginBottom: 10, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  passwordControl: { flex: 1, height: 44, paddingHorizontal: 10, color: colors.ink, fontSize: 12 },
  passwordToggle: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  switchAuth: { alignItems: "center", marginTop: 12 },
  switchText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  signOut: { alignItems: "center", marginTop: 13, paddingTop: 11, borderTopColor: colors.line, borderTopWidth: 1 },
  signOutText: { color: colors.red, fontSize: 9, fontWeight: "800" },
  message: { marginTop: 10, color: colors.green, fontSize: 10, lineHeight: 15 },
  messageError: { color: colors.red },
  conflict: { paddingVertical: 11, borderBottomColor: colors.line, borderBottomWidth: 1 },
  conflictTitle: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  conflictActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  footer: { marginTop: 16, marginBottom: 12, color: "#9ba1aa", fontSize: 9, textAlign: "center", lineHeight: 14 },
});
