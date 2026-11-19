import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Cloud,
  CloudUpload,
  Eye,
  EyeOff,
  LogOut,
  MapPin,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react-native";
import { AppScreen, PrimaryButton, ScreenHeader, Surface } from "../src/components/Screen";
import { useStore } from "../src/StoreProvider";
import { supabase } from "../src/lib/supabase";
import { colors } from "../src/theme";

export default function SettingsScreen() {
  const {
    shop, session, cloudConfigured, backupTime, backupInterval, lastBackupAt,
    syncStatus, syncMessage, conflicts, signIn, syncNow, updateBackupSchedule,
    resolveConflict, refresh, updateShopPanVatNumber,
  } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [time, setTime] = useState(backupTime);
  const [interval, setInterval] = useState(backupInterval);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
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
      showMessage(createAccount ? "Check your email to confirm your account." : "Account connected.");
    } catch (error) {
      showMessage(error.message || "Could not connect your account.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule() {
    setBusy(true);
    showMessage("");
    try {
      await updateBackupSchedule(time, interval);
      showMessage("Automatic backup schedule saved on this device.");
      setScheduleExpanded(false);
    } catch (error) {
      showMessage(error.message || "Could not save the backup schedule.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function backup() {
    setBusy(true);
    showMessage("");
    try {
      const result = await syncNow();
      showMessage(`Backup complete · ${result.saleCount} sales · ${result.productCount} products`);
    } catch (error) {
      showMessage(error.message || "Backup could not be completed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    showMessage("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showMessage("Signed out. Your shop data remains on this device.");
      await refresh();
    } catch (error) {
      showMessage(error.message || "Could not sign out.", "error");
    } finally {
      setBusy(false);
    }
  }

  function confirmSignOut() {
    Alert.alert(
      "Sign out of cloud backup?",
      "Your shop data will stay on this device. Automatic cloud sync will pause until you sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => { void signOut(); } },
      ],
    );
  }

  async function resolve(item, strategy) {
    try {
      await resolveConflict(item, strategy);
      showMessage("Choice saved. Sync again to apply the selected version.");
    } catch (error) {
      Alert.alert("Could not resolve conflict", error.message);
    }
  }

  const statusLabel = syncStatus === "error"
    ? "Needs attention"
    : syncStatus === "syncing"
      ? "Syncing"
      : syncStatus === "synced"
        ? "Up to date"
        : session
          ? "Connected"
          : "Local only";
  const scheduleChanged = time !== backupTime || interval !== backupInterval;
  const feedback = message || syncMessage;
  const feedbackIsError = message ? messageTone === "error" : syncStatus === "error";

  return (
    <AppScreen>
      <ScreenHeader
        title="Settings"
        subtitle="Your shop details and a safe copy of your records"
        action={
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={18} color={colors.ink} />
          </Pressable>
        }
      />

      <Surface style={styles.profileCard}>
        <View style={styles.profileIcon}><Store size={20} color={colors.red} strokeWidth={2} /></View>
        <View style={styles.profileCopy}>
          <Text style={styles.eyebrow}>SHOP PROFILE</Text>
          <Text style={styles.shopName}>{shop.name}</Text>
          <Text style={styles.profileDetail}>Owner · {shop.owner_name}</Text>
          {shop.phone ? <Text style={styles.profileDetail}>{shop.phone}</Text> : null}
          {shop.address ? (
            <View style={styles.addressRow}>
              <MapPin size={12} color={colors.muted} />
              <Text style={styles.profileDetail}>{shop.address}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.localPill}><Check size={12} color={colors.green} /><Text style={styles.localPillText}>On device</Text></View>
      </Surface>

      <ShopTaxNumberSettings key={shop.id} shop={shop} onSave={updateShopPanVatNumber} />

      <SectionHeading icon={CloudUpload} title="SAVE A COPY OF YOUR DATA" />
      <Surface style={styles.sectionCard}>
        <View style={styles.backupHeader}>
          <View style={styles.backupIcon}><Cloud size={19} color={colors.red} /></View>
          <View style={styles.backupCopy}>
            <Text style={styles.cardTitle}>Online backup</Text>
            <Text style={styles.body}>Your shop works on this phone. An online backup keeps an extra copy safe.</Text>
          </View>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, syncStatus === "error" ? styles.dotError : syncStatus === "syncing" ? styles.dotWorking : syncStatus === "synced" ? styles.dotSuccess : styles.dotNeutral]} />
          <Text style={styles.statusText}>{statusLabel}</Text>
          <Text style={styles.statusTime}>
            {lastBackupAt ? `Last backup ${new Date(lastBackupAt).toLocaleString()}` : "No backup completed yet"}
          </Text>
        </View>

        {session && cloudConfigured ? (
          <PrimaryButton title={busy ? "Backing up…" : "Back up now"} disabled={busy} onPress={backup} style={styles.backupButton} />
        ) : (
          <Text style={styles.inlineHint}>
            {!cloudConfigured
              ? "Cloud backup is unavailable until Supabase is configured for this app."
              : "Sign in below to enable secure cloud backup."}
          </Text>
        )}

        <View style={styles.divider} />
        <Pressable
          style={styles.expandRow}
          onPress={() => setScheduleExpanded(!scheduleExpanded)}
          accessibilityRole="button"
          accessibilityState={{ expanded: scheduleExpanded }}
        >
          <View style={styles.expandIcon}><CloudUpload size={15} color={colors.muted} /></View>
          <View style={styles.expandCopy}>
            <Text style={styles.expandTitle}>Automatic backup</Text>
            <Text style={styles.expandDetail}>Every {backupInterval} day{backupInterval === "1" ? "" : "s"} · {backupTime} local time</Text>
          </View>
          {scheduleExpanded ? <ChevronUp size={18} color={colors.muted} /> : <ChevronDown size={18} color={colors.muted} />}
        </Pressable>
        {scheduleExpanded ? (
          <View style={styles.schedulePanel}>
            <Text style={styles.scheduleHint}>Runs when the app and device allow background work; your operating system may defer it.</Text>
            <View style={styles.scheduleFields}>
              <View style={styles.timeField}>
                <Text style={styles.fieldLabel}>TIME OF DAY</Text>
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  placeholder="06:00"
                  style={styles.input}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  accessibilityLabel="Automatic backup time in 24-hour format"
                />
                <Text style={styles.inputHint}>24-hour local time</Text>
              </View>
              <View style={styles.intervalField}>
                <Text style={styles.fieldLabel}>REPEAT EVERY</Text>
                <View style={styles.intervalInputRow}>
                  <TextInput
                    value={interval}
                    onChangeText={setInterval}
                    placeholder="1"
                    style={[styles.input, styles.intervalInput]}
                    keyboardType="number-pad"
                    maxLength={3}
                    accessibilityLabel="Automatic backup interval in days"
                  />
                  <Text style={styles.daysLabel}>days</Text>
                </View>
                <Text style={styles.inputHint}>Choose 1–365 days</Text>
              </View>
            </View>
            <Pressable
              style={[styles.saveScheduleButton, (!scheduleChanged || busy) && styles.buttonDisabled]}
              onPress={saveSchedule}
              disabled={!scheduleChanged || busy}
              accessibilityRole="button"
            >
              <Text style={styles.saveScheduleText}>{busy ? "Saving…" : "Save schedule"}</Text>
            </Pressable>
          </View>
        ) : null}
      </Surface>

      <SectionHeading icon={UserRound} title="OPTIONAL ONLINE BACKUP ACCOUNT" />
      <Surface style={styles.sectionCard}>
        {session ? (
          <>
            <View style={styles.accountRow}>
              <View style={styles.accountIcon}><ShieldCheck size={18} color={colors.green} /></View>
              <View style={styles.accountCopy}>
                <Text style={styles.cardTitle}>Account connected</Text>
                <Text style={styles.body}>{session.user.email}</Text>
              </View>
            </View>
            <Text style={styles.privacyNote}>Signing out pauses cloud sync but does not remove local shop data.</Text>
            <Pressable
              style={[styles.signOutButton, busy && styles.buttonDisabled]}
              onPress={confirmSignOut}
              disabled={busy}
              accessibilityRole="button"
            >
              <LogOut size={16} color={colors.red} />
              <Text style={styles.signOutText}>Sign out</Text>
              <ChevronRight size={17} color={colors.muted} />
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.body}>Sign in to save an extra copy online. Your shop stays on this phone either way.</Text>
            <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              style={styles.input}
              accessibilityLabel="Email address"
            />
            <Text style={[styles.fieldLabel, styles.passwordLabel]}>PASSWORD</Text>
            <View style={styles.passwordField}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={createAccount ? "At least 8 characters" : "Enter your password"}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={createAccount ? "new-password" : "current-password"}
                returnKeyType="done"
                onSubmitEditing={() => { if (!busy && email.trim() && password) void connect(); }}
                style={styles.passwordControl}
                accessibilityLabel="Password"
              />
              <Pressable
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}
              </Pressable>
            </View>
            <PrimaryButton
              title={busy ? "Connecting…" : createAccount ? "Create account" : "Sign in"}
              disabled={busy || !cloudConfigured || !email.trim() || !password}
              onPress={connect}
              style={styles.accountButton}
            />
            <Pressable
              onPress={() => {
                setCreateAccount(!createAccount);
                setPassword("");
                setShowPassword(false);
                showMessage("");
              }}
              style={styles.switchAuth}
              accessibilityRole="button"
            >
              <Text style={styles.switchText}>{createAccount ? "Already have an account? Sign in" : "New to NexTill? Create an account"}</Text>
            </Pressable>
            {!cloudConfigured ? <Text style={styles.configHint}>Cloud account access is not configured for this app.</Text> : null}
          </>
        )}
        {feedback ? <Text accessibilityLiveRegion="polite" style={[styles.feedback, feedbackIsError ? styles.feedbackError : styles.feedbackSuccess]}>{feedback}</Text> : null}
      </Surface>

      {conflicts.length > 0 ? (
        <>
          <SectionHeading icon={AlertTriangle} title={`SYNC ISSUES · ${conflicts.length}`} attention />
          <Surface style={styles.sectionCard}>
            <Text style={styles.body}>Review these items before relying on the cloud copy. Local records remain on this device.</Text>
            {conflicts.map((item) => (
              <View key={item.id} style={styles.conflict}>
                <Text style={styles.conflictTitle}>{item.entity_type === "product" ? "Product update conflict" : "Sale needs review"}</Text>
                <Text style={styles.conflictReason}>{item.reason}</Text>
                {item.entity_type === "product" && item.server_payload ? (
                  <View style={styles.conflictActions}>
                    <Pressable style={styles.conflictButton} onPress={() => resolve(item, "server")} accessibilityRole="button">
                      <Text style={styles.conflictButtonText}>Use cloud version</Text>
                    </Pressable>
                    <Pressable style={styles.conflictButton} onPress={() => resolve(item, "local")} accessibilityRole="button">
                      <Text style={styles.conflictButtonText}>Keep this device</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.conflictHint}>Review stock and payment before retrying this sale.</Text>
                )}
              </View>
            ))}
          </Surface>
        </>
      ) : null}

      <View style={styles.footer}>
        <ShieldCheck size={15} color={colors.green} />
        <Text style={styles.footerText}>Your shop works offline. Cloud backup is optional and can be disconnected at any time.</Text>
      </View>
    </AppScreen>
  );
}

function SectionHeading({ icon: Icon, title, attention = false }) {
  return (
    <View style={styles.sectionHeading}>
      <Icon size={15} color={attention ? colors.amber : colors.red} strokeWidth={2} />
      <Text style={[styles.sectionTitle, attention && styles.sectionTitleAttention]}>{title}</Text>
    </View>
  );
}

function ShopTaxNumberSettings({ shop, onSave }) {
  const [panVatNumber, setPanVatNumber] = useState(shop.pan_vat_number || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await onSave(panVatNumber);
      setMessage("PAN/VAT number saved on this device.");
      setHasError(false);
    } catch (error) {
      setMessage(error.message || "Could not save the PAN/VAT number.");
      setHasError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionHeading icon={Store} title="INVOICE TAX IDENTIFICATION" />
      <Surface style={styles.sectionCard}>
        <Text style={styles.body}>Add your registered 9-digit PAN/VAT number to print it on bills. Leave blank if you do not have one.</Text>
        <Text style={[styles.fieldLabel, styles.taxNumberLabel]}>PAN / VAT REGISTRATION NUMBER</Text>
        <TextInput
          value={panVatNumber}
          onChangeText={(value) => {
            setPanVatNumber(value.replace(/\D/g, "").slice(0, 9));
            setMessage("");
          }}
          placeholder="9-digit number"
          keyboardType="number-pad"
          maxLength={9}
          style={styles.input}
          accessibilityLabel="PAN or VAT registration number"
        />
        {message ? <Text style={[styles.feedback, hasError ? styles.feedbackError : styles.feedbackSuccess]}>{message}</Text> : null}
        <Pressable
          style={[styles.saveScheduleButton, saving && styles.buttonDisabled]}
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.saveScheduleText}>{saving ? "Saving…" : "Save PAN/VAT number"}</Text>
        </Pressable>
      </Surface>
    </>
  );
}

const styles = StyleSheet.create({
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "white", borderWidth: 1, borderColor: colors.line },
  profileCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  profileIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#fff0ef" },
  profileCopy: { flex: 1 },
  eyebrow: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  shopName: { marginTop: 4, color: colors.ink, fontSize: 15, fontWeight: "800" },
  profileDetail: { marginTop: 4, color: colors.muted, fontSize: 11, lineHeight: 16 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  taxNumberLabel: { marginTop: 13 },
  localPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#eaf7f1", borderRadius: 20 },
  localPillText: { color: colors.green, fontSize: 9, fontWeight: "800" },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 20, marginBottom: 8, paddingHorizontal: 2 },
  sectionTitle: { color: "#66736f", fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  sectionTitleAttention: { color: colors.amber },
  sectionCard: { padding: 14 },
  backupHeader: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  backupIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#fff0ef" },
  backupCopy: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  body: { marginTop: 5, color: colors.muted, fontSize: 13, lineHeight: 19 },
  statusRow: { flexDirection: "row", alignItems: "center", minHeight: 40, marginTop: 12, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  statusDot: { width: 8, height: 8, marginRight: 7, borderRadius: 4 },
  dotSuccess: { backgroundColor: colors.green },
  dotWorking: { backgroundColor: colors.amber },
  dotError: { backgroundColor: colors.red },
  dotNeutral: { backgroundColor: "#9aa1ab" },
  statusText: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  statusTime: { flex: 1, marginLeft: 8, color: colors.muted, fontSize: 9, textAlign: "right" },
  backupButton: { marginTop: 12 },
  inlineHint: { marginTop: 12, padding: 10, color: colors.muted, backgroundColor: "#f5f6f8", borderRadius: 8, fontSize: 10, lineHeight: 15 },
  divider: { height: 1, marginTop: 13, backgroundColor: colors.line },
  expandRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10 },
  expandIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: "#f4f5f7" },
  expandCopy: { flex: 1 },
  expandTitle: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  expandDetail: { marginTop: 3, color: colors.muted, fontSize: 10 },
  schedulePanel: { paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  scheduleHint: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  scheduleFields: { flexDirection: "row", gap: 10, marginTop: 12 },
  timeField: { flex: 1 },
  intervalField: { flex: 1 },
  fieldLabel: { marginBottom: 6, color: "#727985", fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  input: { height: 46, paddingHorizontal: 12, color: colors.ink, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 9, fontSize: 13 },
  inputHint: { marginTop: 5, color: colors.muted, fontSize: 9 },
  intervalInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  intervalInput: { flex: 1 },
  daysLabel: { color: colors.muted, fontSize: 11 },
  saveScheduleButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: "white" },
  saveScheduleText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  buttonDisabled: { opacity: 0.5 },
  accountRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  accountIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#eaf7f1" },
  accountCopy: { flex: 1 },
  privacyNote: { marginTop: 12, color: colors.muted, fontSize: 10, lineHeight: 15 },
  signOutButton: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12, paddingHorizontal: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 9 },
  signOutText: { flex: 1, color: colors.red, fontSize: 11, fontWeight: "800" },
  passwordLabel: { marginTop: 13 },
  passwordField: { minHeight: 46, flexDirection: "row", alignItems: "center", marginBottom: 12, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 9 },
  passwordControl: { flex: 1, height: 46, paddingHorizontal: 12, color: colors.ink, fontSize: 13 },
  passwordToggle: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  accountButton: { marginTop: 2 },
  switchAuth: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 3 },
  switchText: { color: colors.red, fontSize: 11, fontWeight: "800" },
  configHint: { marginTop: 2, color: colors.amber, fontSize: 10, lineHeight: 15, textAlign: "center" },
  feedback: { marginTop: 10, fontSize: 10, lineHeight: 15 },
  feedbackSuccess: { color: colors.green },
  feedbackError: { color: colors.red },
  conflict: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  conflictTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  conflictReason: { marginTop: 5, color: colors.muted, fontSize: 10, lineHeight: 15 },
  conflictActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  conflictButton: { minHeight: 40, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  conflictButtonText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  conflictHint: { marginTop: 8, padding: 9, color: colors.amber, backgroundColor: "#fff5e5", borderRadius: 8, fontSize: 10, lineHeight: 15 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 18, paddingHorizontal: 8, paddingBottom: 6 },
  footerText: { flexShrink: 1, color: colors.muted, fontSize: 9, lineHeight: 14, textAlign: "center" },
});
