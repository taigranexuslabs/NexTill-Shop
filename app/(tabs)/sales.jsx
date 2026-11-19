import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ChevronRight, ReceiptText, Search, Store, X } from "lucide-react-native";
import { useStore } from "../../src/StoreProvider";
import { AppScreen, PrimaryButton, ScreenHeader, Surface } from "../../src/components/Screen";
import { colors } from "../../src/theme";

const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
const paymentLabel = (method) => ({ cash: "Cash", esewa: "eSewa", khalti: "Khalti", bank_transfer: "Bank transfer", other: "Other" }[method] || method);

export default function SalesScreen() {
  const { sales, shop } = useStore();
  const params = useLocalSearchParams();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(typeof params.saleId === "string" ? params.saleId : null);
  const methods = useMemo(() => ["All", ...new Set(sales.map((sale) => sale.payment_method).filter(Boolean))], [sales]);
  useEffect(() => {
    setSelectedId(typeof params.saleId === "string" ? params.saleId : null);
  }, [params.saleId]);
  const list = useMemo(() => sales.filter((sale) => {
    const matchesSearch = `${sale.invoice_no} ${sale.customer_name || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesMethod = methodFilter === "All" || sale.payment_method === methodFilter;
    const createdAt = new Date(sale.created_at);
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeStart = new Date(today);
    if (dateFilter === "7 days") rangeStart.setDate(rangeStart.getDate() - 6);
    const rangeEnd = new Date(today);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
    const matchesDate = dateFilter === "All" || (!Number.isNaN(createdAt.getTime())
      && createdAt >= rangeStart
      && (dateFilter === "Today" ? createdAt < rangeEnd : createdAt <= now));
    return matchesSearch && matchesMethod && matchesDate;
  }), [sales, search, dateFilter, methodFilter]);
  const selected = sales.find((sale) => sale.id === selectedId);

  return (
    <AppScreen>
      <ScreenHeader title="Sales & Bills" subtitle={`${sales.length} sales saved locally`} />
      <View style={styles.searchBox}><Search size={17} color="#858c95" strokeWidth={2} /><TextInput value={search} onChangeText={setSearch} style={styles.search} placeholder="Search invoice or customer" accessibilityLabel="Search sales" returnKeyType="search" />{search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch("")}><X size={16} color={colors.muted} /></Pressable> : null}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filterContent}>{["All", "Today", "7 days"].map((filter) => <Pressable key={filter} onPress={() => setDateFilter(filter)} style={[styles.filterChip, dateFilter === filter && styles.filterChipActive]}><Text style={[styles.filterText, dateFilter === filter && styles.filterTextActive]}>{filter}</Text></Pressable>)}</ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filterContent}>{methods.map((method) => <Pressable key={method} onPress={() => setMethodFilter(method)} style={[styles.filterChip, methodFilter === method && styles.filterChipActive]}><Text style={[styles.filterText, methodFilter === method && styles.filterTextActive]}>{method === "All" ? "All payments" : paymentLabel(method)}</Text></Pressable>)}</ScrollView>
      <Text style={styles.listMeta}>{list.length} transactions · Saved locally and backed up when online</Text>
      {list.map((sale) => <Pressable key={sale.id} onPress={() => setSelectedId(sale.id)} style={styles.saleRow}><View style={styles.icon}><ReceiptText size={17} color={colors.red} strokeWidth={1.9} /></View><View style={styles.saleDetail}><Text style={styles.invoice}>{sale.invoice_no}</Text><Text style={styles.subtle}>{new Date(sale.created_at).toLocaleString()} · {sale.customer_name || "Walk-in Customer"}</Text><Text style={[styles.status, sale.status === "synced" ? styles.synced : styles.pending]}>{sale.status === "synced" ? "Backed up" : "Pending backup"}</Text></View><View style={styles.amount}><Text style={styles.total}>{money(sale.total)}</Text><Text style={styles.subtle}>{paymentLabel(sale.payment_method)}</Text></View><ChevronRight size={17} color="#9da3ab" /></Pressable>)}
      {list.length === 0 && <Surface style={styles.empty}><Text style={styles.emptyTitle}>{sales.length ? "No sales match these filters" : "No sales yet"}</Text><Text style={styles.subtle}>{sales.length ? "Try another date range or payment method." : "Complete a sale to create your first invoice."}</Text>{sales.length ? <Pressable style={styles.clearFilters} onPress={() => { setSearch(""); setDateFilter("All"); setMethodFilter("All"); }}><Text style={styles.clearFiltersText}>Clear filters</Text></Pressable> : <PrimaryButton title="Start a sale" onPress={() => router.push("/(tabs)/sale")} />}</Surface>}
      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelectedId(null)}>
          <Pressable style={styles.receiptFrame} onPress={(event) => event.stopPropagation()}>
            <ScrollView style={styles.receiptScroll} contentContainerStyle={styles.receipt} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <View><Text style={styles.modalTitle}>Invoice</Text><Text style={styles.subtle}>Sale receipt</Text></View>
                <Pressable style={styles.closeButton} onPress={() => setSelectedId(null)} accessibilityLabel="Close invoice"><X size={18} color={colors.ink} /></Pressable>
              </View>
              {selected && <>
                <View style={styles.receiptBrand}><View style={styles.storeMark}><Store size={18} color="white" strokeWidth={2} /></View><Text style={styles.shopName}>{shop?.name || "NexTill Shop"}</Text></View>
                {shop?.address ? <Text style={styles.shopContact}>{shop.address}</Text> : null}
                {shop?.phone ? <Text style={styles.shopContact}>{shop.phone}</Text> : null}
                <View style={styles.invoiceMeta}><Text style={styles.invoiceNumber}>{selected.invoice_no}</Text><Text style={styles.subtle}>{new Date(selected.created_at).toLocaleString()}</Text></View>
                <Text style={styles.subtle}>{selected.customer_name || "Walk-in Customer"}</Text>
                <View style={styles.rule} />
                {(selected.items || []).map((item) => <View key={item.id} style={styles.line}><View style={styles.receiptItem}><Text style={styles.productName}>{item.name_snapshot}</Text><Text style={styles.subtle}>{item.quantity} × {money(item.unit_price)}</Text></View><Text style={styles.total}>{money(item.line_total)}</Text></View>)}
                <View style={styles.rule} />
                <View style={styles.totalLine}><Text style={styles.subtle}>Subtotal</Text><Text style={styles.total}>{money(selected.subtotal)}</Text></View>
                {Number(selected.discount) > 0 ? <View style={styles.totalLine}><Text style={styles.subtle}>Discount</Text><Text style={styles.total}>− {money(selected.discount)}</Text></View> : null}
                {Number(selected.tax) > 0 ? <View style={styles.totalLine}><Text style={styles.subtle}>Tax</Text><Text style={styles.total}>{money(selected.tax)}</Text></View> : null}
                <View style={styles.line}><Text style={styles.productName}>Total paid</Text><Text style={styles.modalTotal}>{money(selected.total)}</Text></View>
                <Text style={styles.subtle}>Paid by {paymentLabel(selected.payment_method)} · Received {money(selected.amount_received)}</Text>
                {Number(selected.change_due) > 0 ? <Text style={styles.subtle}>Change due {money(selected.change_due)}</Text> : null}
              </>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  searchBox: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 9 },
  search: { flex: 1, color: colors.ink, fontSize: 12 },
  filterScroller: { flexGrow: 0, marginTop: 7 },
  filterContent: { gap: 6, paddingVertical: 2 },
  filterChip: { minHeight: 40, justifyContent: "center", paddingHorizontal: 10, backgroundColor: "white", borderRadius: 18 },
  filterChipActive: { backgroundColor: "#ffedec" },
  filterText: { color: "#969ca5", fontSize: 9, fontWeight: "700" },
  filterTextActive: { color: colors.red },
  listMeta: { marginVertical: 9, color: "#969ca5", fontSize: 9 },
  saleRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, backgroundColor: "white", borderBottomColor: "#eff0f2", borderBottomWidth: 1 },
  icon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 9 },
  saleDetail: { flex: 1 },
  invoice: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  subtle: { marginTop: 4, color: "#8f96a0", fontSize: 9 },
  status: { marginTop: 4, fontSize: 9, fontWeight: "700" },
  synced: { color: colors.green },
  pending: { color: colors.amber },
  amount: { alignItems: "flex-end" },
  total: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  empty: { marginTop: 10, padding: 16 },
  clearFilters: { minHeight: 40, justifyContent: "center", marginTop: 6 },
  clearFiltersText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  emptyTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  backdrop: { flex: 1, justifyContent: "flex-end", padding: 8, backgroundColor: "rgba(14,16,20,.5)" },
  receiptFrame: { maxHeight: "86%", overflow: "hidden", backgroundColor: "white", borderRadius: 16 },
  receiptScroll: { flexGrow: 0 },
  receipt: { padding: 18, paddingBottom: 30 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  modalTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  closeButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", backgroundColor: "#f6f7f8", borderRadius: 19 },
  shopName: { color: colors.ink, fontSize: 17, fontWeight: "800", textAlign: "center" },
  shopContact: { marginTop: 3, color: colors.muted, fontSize: 8, textAlign: "center" },
  receiptBrand: { alignItems: "center", gap: 7 },
  storeMark: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: colors.red, borderRadius: 9 },
  invoiceMeta: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  invoiceNumber: { marginTop: 10, color: colors.ink, fontSize: 11, fontWeight: "800" },
  rule: { marginVertical: 10, borderTopColor: colors.line, borderTopWidth: 1 },
  line: { minHeight: 37, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  receiptItem: { flex: 1 },
  totalLine: { minHeight: 27, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  productName: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  modalTotal: { color: colors.ink, fontSize: 17, fontWeight: "900" },
});
