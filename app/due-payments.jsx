import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, CircleCheck, WalletCards } from "lucide-react-native";
import { useStore } from "../src/StoreProvider";
import { AppScreen, PrimaryButton, ScreenHeader, Surface } from "../src/components/Screen";
import { colors } from "../src/theme";

const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
const methods = ["cash", "esewa", "khalti", "bank_transfer", "other"];
const paymentLabel = (method) => ({
  cash: "Cash",
  esewa: "eSewa",
  khalti: "Khalti",
  bank_transfer: "Bank transfer",
  other: "Other",
}[method] || method);

export default function DuePaymentsScreen() {
  const { sales, recordSalePayment } = useStore();
  const [selectedId, setSelectedId] = useState(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dueSales = useMemo(
    () => sales.filter((sale) => Number(sale.outstanding_amount) > 0),
    [sales],
  );
  const totalDue = dueSales.reduce((sum, sale) => sum + Number(sale.outstanding_amount), 0);
  const selected = sales.find((sale) => sale.id === selectedId);
  const parsedAmount = Number(amount);

  function openPayment(sale) {
    setSelectedId(sale.id);
    setAmount(String(sale.outstanding_amount));
    setMethod("cash");
    setError("");
  }

  async function savePayment() {
    if (!selected) return;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > Number(selected.outstanding_amount)) {
      setError(`Enter an amount greater than zero and no more than ${money(selected.outstanding_amount)}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await recordSalePayment(selected.id, parsedAmount, method);
      setSelectedId(null);
    } catch (reason) {
      setError(reason.message || "Could not record this payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen>
      <ScreenHeader
        title="Due Payments"
        subtitle="Outstanding customer balances"
        action={<Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Go back"><ArrowLeft size={17} color={colors.ink} /></Pressable>}
      />
      <Surface style={styles.summary}>
        <Text style={styles.summaryLabel}>TOTAL OUTSTANDING</Text>
        <Text style={styles.summaryTotal}>{money(totalDue)}</Text>
        <Text style={styles.summaryDetail}>{dueSales.length} {dueSales.length === 1 ? "unpaid sale" : "unpaid sales"}</Text>
      </Surface>
      {dueSales.map((sale) => (
        <Surface key={sale.id} style={styles.saleCard}>
          <View style={styles.saleHeading}>
            <View style={styles.invoiceMark}><WalletCards size={17} color={colors.red} strokeWidth={2} /></View>
            <View style={styles.saleCopy}>
              <Text style={styles.customer}>{sale.customer_name || "Walk-in Customer"}</Text>
              <Text style={styles.detail}>{sale.invoice_no} · {new Date(sale.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.balance}>{money(sale.outstanding_amount)}</Text>
          </View>
          <View style={styles.paymentSummary}>
            <Text style={styles.detail}>Sale {money(sale.total)}</Text>
            <Text style={styles.detail}>Paid {money(Number(sale.total) - Number(sale.outstanding_amount))}</Text>
          </View>
          <Pressable style={styles.collectButton} onPress={() => openPayment(sale)}>
            <Text style={styles.collectText}>Record payment</Text>
          </Pressable>
        </Surface>
      ))}
      {dueSales.length === 0 ? (
        <Surface style={styles.empty}>
          <CircleCheck size={28} color={colors.green} strokeWidth={1.8} />
          <Text style={styles.emptyTitle}>{sales.length ? "No outstanding balances" : "No sales yet"}</Text>
          <Text style={styles.detail}>{sales.length ? "Any customer balances will appear here." : "Complete a sale to start tracking payments."}</Text>
        </Surface>
      ) : null}
      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelectedId(null)}>
          <Pressable style={styles.modalFrame} onPress={(event) => event.stopPropagation()}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {selected ? <>
                <Text style={styles.modalTitle}>Record payment</Text>
                <Text style={styles.detail}>{selected.customer_name} · {selected.invoice_no}</Text>
                <View style={styles.balanceBox}>
                  <Text style={styles.summaryLabel}>BALANCE DUE</Text>
                  <Text style={styles.balanceTotal}>{money(selected.outstanding_amount)}</Text>
                </View>
                <Text style={styles.label}>Amount received (Rs)</Text>
                <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.input} accessibilityLabel="Payment amount" />
                <Text style={styles.label}>Payment method</Text>
                <View style={styles.methods}>
                  {methods.map((item) => (
                    <Pressable key={item} onPress={() => setMethod(item)} style={[styles.method, method === item && styles.methodActive]}>
                      <Text style={[styles.methodText, method === item && styles.methodTextActive]}>{paymentLabel(item)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.historyTitle}>Payment history</Text>
                {(selected.payments || []).map((payment) => (
                  <View key={payment.id} style={styles.historyRow}>
                    <Text style={styles.detail}>{new Date(payment.paid_at).toLocaleString()} · {paymentLabel(payment.payment_method)}</Text>
                    <Text style={styles.historyAmount}>{money(payment.amount)}</Text>
                  </View>
                ))}
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <PrimaryButton title={busy ? "Saving payment…" : `Save payment · ${money(parsedAmount)}`} disabled={busy} onPress={savePayment} style={styles.saveButton} />
                <Pressable style={styles.cancel} onPress={() => setSelectedId(null)} disabled={busy}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              </> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderRadius: 22, borderWidth: 1, borderColor: colors.line },
  summary: { marginBottom: 10, padding: 16 },
  summaryLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  summaryTotal: { marginTop: 6, color: colors.red, fontSize: 25, fontWeight: "900" },
  summaryDetail: { marginTop: 3, color: colors.muted, fontSize: 10 },
  saleCard: { marginBottom: 9, padding: 12 },
  saleHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  invoiceMark: { width: 35, height: 35, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 9 },
  saleCopy: { flex: 1 },
  customer: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  detail: { marginTop: 4, color: colors.muted, fontSize: 9 },
  balance: { color: colors.red, fontSize: 13, fontWeight: "900" },
  paymentSummary: { flexDirection: "row", justifyContent: "space-between", marginTop: 9, paddingTop: 8, borderTopColor: colors.line, borderTopWidth: 1 },
  collectButton: { minHeight: 40, alignItems: "center", justifyContent: "center", marginTop: 9, backgroundColor: "#fff0ef", borderRadius: 8 },
  collectText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  empty: { alignItems: "center", gap: 7, marginTop: 10, paddingVertical: 22 },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  backdrop: { flex: 1, justifyContent: "flex-end", padding: 8, backgroundColor: "rgba(14,16,20,.5)" },
  modalFrame: { maxHeight: "90%", overflow: "hidden", backgroundColor: "white", borderRadius: 16 },
  modalContent: { padding: 18, paddingBottom: 26 },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  balanceBox: { marginTop: 14, padding: 12, backgroundColor: "#fff4f3", borderRadius: 9 },
  balanceTotal: { marginTop: 5, color: colors.red, fontSize: 21, fontWeight: "900" },
  label: { marginTop: 13, marginBottom: 5, color: colors.ink, fontSize: 10, fontWeight: "700" },
  input: { height: 44, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 8, color: colors.ink, fontSize: 12 },
  methods: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  method: { minHeight: 36, justifyContent: "center", paddingHorizontal: 10, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 18 },
  methodActive: { backgroundColor: "#fff4f3", borderColor: "#f2a6a3" },
  methodText: { color: colors.muted, fontSize: 9 },
  methodTextActive: { color: colors.red, fontWeight: "800" },
  historyTitle: { marginTop: 16, marginBottom: 6, color: colors.ink, fontSize: 11, fontWeight: "800" },
  historyRow: { minHeight: 33, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7, borderBottomWidth: 1, borderBottomColor: colors.line },
  historyAmount: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  error: { marginTop: 10, color: colors.red, fontSize: 10 },
  saveButton: { minHeight: 46, marginTop: 15 },
  cancel: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 4 },
  cancelText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
});
