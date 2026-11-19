import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, Plus, ReceiptText, X } from "lucide-react-native";
import { AppScreen, PrimaryButton, ScreenHeader, Surface } from "../src/components/Screen";
import { colors } from "../src/theme";
import { getSetting, setSetting } from "../src/lib/database";

const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getSetting("expenses", "[]")
      .then((value) => {
        const parsed = JSON.parse(value || "[]");
        if (!Array.isArray(parsed)) throw new Error("Stored expense data is not a list.");
        if (active) {
          setExpenses(parsed);
          setLoadFailed(false);
        }
      })
      .catch((reason) => {
        if (active) {
          setLoadFailed(true);
          setError(`Could not load saved expenses: ${reason.message}`);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [loadAttempt]);

  async function addExpense() {
    const parsedAmount = Number(amount);
    if (!title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    setBusy(true);
    setError("");
    try {
      const next = [{ id: String(Date.now()), title: title.trim(), amount: parsedAmount, date: new Date().toLocaleDateString() }, ...expenses];
      await setSetting("expenses", JSON.stringify(next));
      setExpenses(next);
      setTitle("");
      setAmount("");
      setOpen(false);
    } catch (reason) {
      setError(`Could not save expense: ${reason.message || "Storage is unavailable."}`);
    } finally {
      setBusy(false);
    }
  }

  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  return (
    <AppScreen>
      <ScreenHeader title="Expenses" subtitle="Track shop spending" action={<Pressable style={styles.back} onPress={() => router.back()}><ArrowLeft size={17} color={colors.ink} /></Pressable>} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Surface style={styles.hero}><Text style={styles.heroLabel}>TOTAL EXPENSES</Text><Text style={styles.heroValue}>{money(total)}</Text></Surface>
      <View style={styles.heading}><Text style={styles.sectionTitle}>Recent expenses</Text><Pressable style={styles.addButton} disabled={loading || loadFailed} onPress={() => { setError(""); setOpen(true); }}><Plus size={15} color="white" /><Text style={styles.addText}>Add Expense</Text></Pressable></View>
      {loadFailed ? <Pressable style={styles.retry} onPress={() => { setLoading(true); setError(""); setLoadAttempt((attempt) => attempt + 1); }}><Text style={styles.retryText}>Retry loading saved expenses</Text></Pressable> : null}
      {loading ? <Text style={styles.empty}>Loading saved expenses…</Text> : null}
      {expenses.map((item) => (
        <Surface key={item.id} style={styles.row}>
          <View style={styles.icon}><ReceiptText size={17} color={colors.red} /></View>
          <View style={styles.copy}><Text style={styles.name}>{item.title}</Text><Text style={styles.date}>{item.date}</Text></View>
          <Text style={styles.amount}>{money(item.amount)}</Text>
        </Surface>
      ))}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modal}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Add expense</Text><Pressable onPress={() => setOpen(false)}><X size={18} color={colors.ink} /></Pressable></View>
          <Text style={styles.label}>Expense name</Text><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Electricity bill" maxLength={120} style={styles.input} />
          <Text style={styles.label}>Amount (Rs)</Text><TextInput value={amount} onChangeText={setAmount} placeholder="0" keyboardType="decimal-pad" style={styles.input} />
          <PrimaryButton title={busy ? "Saving…" : "Save expense"} disabled={busy || loading || !title.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0} onPress={addExpense} />
        </View></View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderRadius: 22, borderWidth: 1, borderColor: colors.line },
  hero: { backgroundColor: colors.red, borderColor: colors.red },
  heroLabel: { color: "#ffe5e4", fontSize: 9, fontWeight: "800" },
  heroValue: { marginTop: 7, color: "white", fontSize: 24, fontWeight: "900" },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 8 },
  sectionTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  addButton: { height: 42, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, backgroundColor: colors.red, borderRadius: 8 },
  addText: { color: "white", fontSize: 10, fontWeight: "800" },
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 },
  icon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 9 },
  copy: { flex: 1 }, name: { color: colors.ink, fontSize: 11, fontWeight: "800" }, date: { marginTop: 4, color: colors.muted, fontSize: 9 },
  amount: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  error: { marginBottom: 8, color: colors.red, fontSize: 10, lineHeight: 15 },
  empty: { paddingVertical: 16, color: colors.muted, fontSize: 10, textAlign: "center" },
  retry: { minHeight: 40, justifyContent: "center" },
  retryText: { color: colors.red, fontSize: 10, fontWeight: "800", textAlign: "center" },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "rgba(20,22,26,.55)" },
  modal: { padding: 16, backgroundColor: "white", borderRadius: 14 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }, modalTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  label: { marginTop: 7, marginBottom: 5, color: colors.ink, fontSize: 10, fontWeight: "700" },
  input: { height: 44, marginBottom: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 8, color: colors.ink },
});
