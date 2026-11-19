import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, Banknote, Building2, CircleCheck, CreditCard, Minus, Plus, Smartphone } from "lucide-react-native";
import { useStore } from "../src/StoreProvider";
import { AppScreen, ScreenHeader, Surface, PrimaryButton } from "../src/components/Screen";
import { colors } from "../src/theme";

const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
const methods = ["cash", "esewa", "khalti", "bank_transfer", "other"];
const label = (method) => ({ cash: "Cash", esewa: "eSewa", khalti: "Khalti", bank_transfer: "Bank Transfer", other: "Other" }[method]);
const methodIcons = { cash: Banknote, esewa: Smartphone, khalti: Smartphone, bank_transfer: Building2, other: CreditCard };

export default function CheckoutScreen() {
  const { cart, changeCartQuantity, completeSale } = useStore();
  const [method, setMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.product.selling_price) * item.quantity, 0), [cart]);
  const [discount, setDiscount] = useState("0");
  const parsedDiscount = Number(discount || 0);
  const discountInvalid = !Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > subtotal;
  const discountAmount = Number.isFinite(parsedDiscount) ? parsedDiscount : 0;
  const total = Math.max(0, subtotal - discountAmount);
  const [received, setReceived] = useState(null);
  const receivedValue = received ?? String(total);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [completedSale, setCompletedSale] = useState(null);
  const parsedReceived = Number(receivedValue);
  const cashInvalid = method === "cash" && (!Number.isFinite(parsedReceived) || parsedReceived < total);

  async function finishSale() {
    if (discountInvalid) {
      setError("Discount must be between zero and the subtotal.");
      return;
    }
    if (method === "cash" && cashInvalid) {
      setError("Amount received must cover the total.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const amountReceived = method === "cash" ? parsedReceived : total;
      const sale = await completeSale(cart, method, amountReceived, discountAmount, customerName.trim());
      setCompletedSale(sale);
    } catch (reason) {
      setError(reason.message || "Could not complete the sale.");
    } finally {
      setBusy(false);
    }
  }

  if (completedSale) {
    return (
      <AppScreen>
        <View style={styles.successScreen}>
          <Surface style={styles.successCard}>
            <View style={styles.successIcon}><CircleCheck size={34} color={colors.green} strokeWidth={1.8} /></View>
            <Text style={styles.successTitle}>Sale completed</Text>
            <Text style={styles.successCopy}>The sale is saved on this device and will sync when online.</Text>
            <View style={styles.successRule} />
            <Text style={styles.eyebrow}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{completedSale.invoice_no}</Text>
            <Text style={styles.eyebrow}>TOTAL PAID</Text>
            <Text style={styles.successTotal}>{money(completedSale.total)}</Text>
          </Surface>
          <PrimaryButton title="View Invoice" onPress={() => router.replace({ pathname: "/(tabs)/sales", params: { saleId: completedSale.id } })} />
          <Pressable style={styles.newSaleAction} onPress={() => router.replace("/(tabs)/sale")}><Text style={styles.newSaleActionText}>Start a new sale</Text></Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} contentStyle={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Checkout" subtitle="Sale and stock changes are saved locally first" action={<Pressable style={styles.backButton} onPress={() => router.back()}><ArrowLeft size={17} color={colors.red} /><Text style={styles.back}>Back</Text></Pressable>} />
        <Surface style={styles.totalCard}><Text style={styles.eyebrow}>TOTAL PAYABLE</Text><Text style={styles.total}>{money(total)}</Text><Text style={styles.subtle}>{cart.reduce((sum, item) => sum + item.quantity, 0)} items · {customerName.trim() || "Walk-in Customer"}</Text></Surface>
        <Surface style={styles.customerCard}>
          <Text style={styles.inputLabel}>Customer (optional)</Text>
          <TextInput value={customerName} onChangeText={setCustomerName} style={styles.input} placeholder="Walk-in Customer" maxLength={120} accessibilityLabel="Customer name" returnKeyType="done" />
        </Surface>
        <Surface style={styles.discountCard}>
          <View style={styles.summaryLine}><Text style={styles.subtle}>Subtotal</Text><Text style={styles.lineTotal}>{money(subtotal)}</Text></View>
          <Text style={styles.inputLabel}>Discount (Rs)</Text>
          <TextInput value={discount} onChangeText={(value) => { setDiscount(value); setReceived(null); }} keyboardType="decimal-pad" style={styles.input} placeholder="0.00" accessibilityLabel="Discount in rupees" />
          {discountInvalid ? <Text style={styles.error}>Discount cannot exceed the subtotal.</Text> : null}
        </Surface>
        <Text style={styles.sectionTitle}>Cart items</Text>
        {cart.map((item) => <Surface key={item.product.id} style={styles.cartLine}><View style={styles.productCopy}><Text style={styles.productName}>{item.product.name}</Text><Text style={styles.subtle}>{money(item.product.selling_price)} each</Text></View><View style={styles.qty}><Pressable accessibilityLabel={`Remove one ${item.product.name}`} onPress={() => { changeCartQuantity(item.product.id, -1); setReceived(null); }} style={styles.qtyAction}><Minus size={14} color={colors.red} strokeWidth={2} /></Pressable><Text style={styles.qtyText}>{item.quantity}</Text><Pressable accessibilityLabel={`Add one ${item.product.name}`} onPress={() => { changeCartQuantity(item.product.id, 1); setReceived(null); }} style={styles.qtyAction}><Plus size={14} color={colors.red} strokeWidth={2} /></Pressable></View><Text style={styles.lineTotal}>{money(item.quantity * item.product.selling_price)}</Text></Surface>)}
        <Text style={styles.sectionTitle}>Payment method</Text>
        <View style={styles.methods}>{methods.map((item) => { const Icon = methodIcons[item]; return <Pressable key={item} onPress={() => setMethod(item)} style={[styles.method, method === item && styles.methodActive]}><Icon size={17} color={method === item ? colors.red : colors.muted} strokeWidth={1.9} /><Text style={styles.methodText}>{label(item)}</Text></Pressable>; })}</View>
        <Text style={styles.paymentHint}>Payment types are recorded here; digital payments are not verified by a provider.</Text>
        {method === "cash" && <Surface style={styles.cashCard}><Text style={styles.sectionTitle}>Amount received</Text><TextInput value={receivedValue} onChangeText={setReceived} keyboardType="decimal-pad" style={styles.input} placeholder={String(total)} accessibilityLabel="Amount received" /><Text style={styles.subtle}>Change due: <Text style={styles.change}>{money(Math.max(0, (Number(receivedValue) || 0) - total))}</Text></Text>{cashInvalid ? <Text style={styles.error}>Enter at least {money(total)} to complete this sale.</Text> : null}</Surface>}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.actionBar}>
      <PrimaryButton title={busy ? "Saving sale…" : `Complete Sale · ${money(total)}`} disabled={busy || cart.length === 0 || cashInvalid || discountInvalid} onPress={finishSale} style={styles.finish} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 8 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 12 },
  actionBar: { paddingTop: 8, backgroundColor: colors.background },
  successScreen: { flex: 1, justifyContent: "center", gap: 12 },
  successCard: { alignItems: "center", paddingVertical: 24 },
  successIcon: { width: 62, height: 62, alignItems: "center", justifyContent: "center", marginBottom: 8, backgroundColor: "#e9f8f1", borderRadius: 31 },
  successTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  successCopy: { maxWidth: 250, marginTop: 6, color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: "center" },
  successRule: { alignSelf: "stretch", marginVertical: 16, borderTopColor: colors.line, borderTopWidth: 1 },
  invoiceNumber: { marginTop: 5, marginBottom: 15, color: colors.ink, fontSize: 13, fontWeight: "800" },
  successTotal: { marginTop: 5, color: colors.red, fontSize: 27, fontWeight: "900" },
  newSaleAction: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  newSaleActionText: { color: colors.red, fontSize: 12, fontWeight: "800" },
  backButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6 },
  back: { color: colors.red, fontSize: 11, fontWeight: "800" },
  totalCard: { padding: 18 },
  discountCard: { marginTop: 10 },
  customerCard: { marginTop: 10 },
  summaryLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
  inputLabel: { marginBottom: 5, color: colors.ink, fontSize: 10, fontWeight: "700" },
  eyebrow: { color: "#8d949e", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  total: { marginTop: 7, color: colors.ink, fontSize: 29, fontWeight: "900" },
  subtle: { marginTop: 4, color: colors.muted, fontSize: 10 },
  sectionTitle: { marginTop: 17, marginBottom: 8, color: colors.ink, fontSize: 13, fontWeight: "800" },
  cartLine: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 7, padding: 10 },
  productCopy: { flex: 1 },
  productName: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  qty: { minHeight: 38, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  qtyAction: { width: 38, height: 40, alignItems: "center", justifyContent: "center" },
  qtyText: { minWidth: 18, color: colors.ink, fontSize: 11, textAlign: "center" },
  lineTotal: { minWidth: 53, color: colors.ink, fontSize: 10, fontWeight: "800", textAlign: "right" },
  methods: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  method: { width: "48.5%", minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  methodActive: { backgroundColor: "#fff4f3", borderColor: "#f2a6a3" },
  radio: { width: 16, height: 16, borderWidth: 1, borderColor: "#cdd1d7", borderRadius: 9 },
  radioActive: { borderWidth: 5, borderColor: colors.red },
  methodText: { color: "#575f69", fontSize: 10 },
  cashCard: { marginTop: 12 },
  input: { height: 44, marginTop: 3, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 8, color: colors.ink, fontSize: 12 },
  paymentHint: { marginTop: 8, color: colors.muted, fontSize: 9, lineHeight: 13 },
  change: { color: colors.ink, fontWeight: "800" },
  error: { marginTop: 12, color: colors.red, fontSize: 10 },
  finish: { minHeight: 48, marginTop: 0, marginBottom: 0 },
});
