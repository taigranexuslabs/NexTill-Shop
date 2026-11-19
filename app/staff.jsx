import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, Plus, UserRoundCog, X } from "lucide-react-native";
import { AppScreen, PrimaryButton, ScreenHeader, Surface } from "../src/components/Screen";
import { colors } from "../src/theme";
import { getSetting, setSetting } from "../src/lib/database";
import { useStore } from "../src/StoreProvider";

export default function StaffScreen() {
  const { shop } = useStore();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Sales Staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getSetting("staff", "[]")
      .then((value) => {
        const parsed = JSON.parse(value || "[]");
        if (!Array.isArray(parsed)) throw new Error("Stored staff data is not a list.");
        if (active) {
          setStaff(parsed);
          setLoadFailed(false);
        }
      })
      .catch((reason) => {
        if (active) {
          setLoadFailed(true);
          setError(`Could not load saved staff: ${reason.message}`);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [loadAttempt]);

  async function addStaff() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const next = [{ id: String(Date.now()), name: name.trim(), role: role.trim() || "Sales Staff", status: "Active" }, ...staff];
      await setSetting("staff", JSON.stringify(next));
      setStaff(next);
      setName("");
      setRole("Sales Staff");
      setOpen(false);
    } catch (reason) {
      setError(`Could not save staff member: ${reason.message || "Storage is unavailable."}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen>
      <ScreenHeader title="Staff" subtitle={`${staff.length + 1} people · local directory only`} action={<Pressable style={styles.back} onPress={() => router.back()}><ArrowLeft size={17} color={colors.ink} /></Pressable>} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.heading}><Text style={styles.sectionTitle}>Team members</Text><Pressable style={styles.addButton} disabled={loading || loadFailed} onPress={() => { setError(""); setOpen(true); }}><Plus size={15} color="white" /><Text style={styles.addText}>Add Staff</Text></Pressable></View>
      {loadFailed ? <Pressable style={styles.retry} onPress={() => { setLoading(true); setError(""); setLoadAttempt((attempt) => attempt + 1); }}><Text style={styles.retryText}>Retry loading saved staff</Text></Pressable> : null}
      {loading ? <Text style={styles.empty}>Loading saved staff…</Text> : null}
      <Surface style={styles.row}>
        <View style={styles.avatar}><UserRoundCog size={20} color={colors.red} /></View>
        <View style={styles.copy}><Text style={styles.name}>{shop?.owner_name || "Shop owner"}</Text><Text style={styles.detail}>Owner</Text></View>
        <Text style={styles.status}>Active</Text>
      </Surface>
      {staff.map((item) => (
        <Surface key={item.id} style={styles.row}>
          <View style={styles.avatar}><UserRoundCog size={20} color={colors.red} /></View>
          <View style={styles.copy}><Text style={styles.name}>{item.name}</Text><Text style={styles.detail}>{item.role}</Text></View>
          <Text style={styles.status}>{item.status}</Text>
        </Surface>
      ))}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modal}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Add staff</Text><Pressable onPress={() => setOpen(false)}><X size={18} color={colors.ink} /></Pressable></View>
          <Text style={styles.label}>Full name</Text><TextInput value={name} onChangeText={setName} placeholder="Staff member name" maxLength={120} style={styles.input} />
          <Text style={styles.label}>Role</Text><TextInput value={role} onChangeText={setRole} placeholder="Sales Staff" maxLength={60} style={styles.input} />
          <PrimaryButton title={busy ? "Saving…" : "Add staff"} disabled={busy || !name.trim()} onPress={addStaff} />
        </View></View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderRadius: 22, borderWidth: 1, borderColor: colors.line },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  addButton: { height: 42, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, backgroundColor: colors.red, borderRadius: 8 },
  addText: { color: "white", fontSize: 10, fontWeight: "800" },
  row: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  avatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 21 },
  copy: { flex: 1 }, name: { color: colors.ink, fontSize: 12, fontWeight: "800" }, detail: { marginTop: 4, color: colors.muted, fontSize: 9 },
  status: { color: colors.green, fontSize: 9, fontWeight: "800" },
  error: { marginBottom: 8, color: colors.red, fontSize: 10, lineHeight: 15 },
  empty: { paddingVertical: 12, color: colors.muted, fontSize: 10, textAlign: "center" },
  retry: { minHeight: 40, justifyContent: "center" },
  retryText: { color: colors.red, fontSize: 10, fontWeight: "800", textAlign: "center" },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "rgba(20,22,26,.55)" },
  modal: { padding: 16, backgroundColor: "white", borderRadius: 14 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }, modalTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  label: { marginTop: 7, marginBottom: 5, color: colors.ink, fontSize: 10, fontWeight: "700" },
  input: { height: 44, marginBottom: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 8, color: colors.ink },
});
