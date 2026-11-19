import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ChevronRight, Download, ReceiptText, Search, Share2, Store, X } from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useStore } from "../../src/StoreProvider";
import { AppScreen, PrimaryButton, ScreenHeader, Surface } from "../../src/components/Screen";
import { colors } from "../../src/theme";

const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
const paymentLabel = (method) => ({ cash: "Cash", esewa: "eSewa", khalti: "Khalti", bank_transfer: "Bank transfer", other: "Other" }[method] || method);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

function invoiceHtml(sale, shop) {
  const items = (sale.items || []).map((item, index) => `
    <tr>
      <td class="index">${index + 1}</td>
      <td>${escapeHtml(item.name_snapshot)}</td>
      <td class="amount">${escapeHtml(item.quantity)}</td>
      <td class="amount">${escapeHtml(money(item.unit_price))}</td>
      <td class="amount">${escapeHtml(money(item.line_total))}</td>
    </tr>`).join("");
  const payments = (sale.payments || []).map((payment) => `
    <tr><td colspan="4">${escapeHtml(new Date(payment.paid_at).toLocaleString())} · ${escapeHtml(paymentLabel(payment.payment_method))}</td>
    <td class="amount">${escapeHtml(money(payment.amount))}</td></tr>`).join("");
  const paid = Number(sale.total) - Number(sale.outstanding_amount || 0);
  const taxableSales = Math.max(0, Number(sale.subtotal || 0) - Number(sale.discount || 0));
  const issueDate = new Date(sale.created_at);
  const documentTitle = Number(sale.tax) > 0 && shop?.pan_vat_number
    ? "Tax Invoice"
    : "Cash Memo / POS Invoice";

  return `<!doctype html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      @page { size: A4; margin: 14mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; color: #171717; margin: 0; font-size: 11px; }
      header { text-align: center; border-bottom: 2px solid #171717; padding-bottom: 12px; }
      h1 { font-size: 19px; margin: 0 0 5px; text-transform: uppercase; }
      p { margin: 4px 0; }
      .doc-title { margin-top: 9px; font-size: 13px; font-weight: bold; letter-spacing: 1px; }
      .copy { margin-top: 4px; font-size: 9px; text-transform: uppercase; }
      .metadata { display: table; width: 100%; margin: 12px 0; border-collapse: collapse; }
      .metadata > div { display: table-cell; width: 50%; padding: 8px; border: 1px solid #777; }
      .metadata strong, .customer strong { display: inline-block; min-width: 88px; }
      .customer { padding: 8px; border: 1px solid #777; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { padding: 7px 5px; border: 1px solid #777; text-align: left; vertical-align: top; }
      th { background: #f0f0f0; font-size: 10px; }
      .index { width: 7%; text-align: center; }
      .amount { text-align: right; white-space: nowrap; }
      .summary { width: 54%; margin-left: auto; }
      .summary td { padding: 6px; }
      .grand-total { font-size: 13px; font-weight: bold; }
      .due { font-weight: bold; }
      .payment { margin-top: 10px; }
      .footer { margin-top: 26px; display: table; width: 100%; }
      .footer span { display: table-cell; width: 50%; padding-top: 28px; border-bottom: 1px solid #777; text-align: center; }
      .footer small { display: block; margin-top: 5px; }
      tr { page-break-inside: avoid; }
    </style></head><body>
      <header>
        <h1>${escapeHtml(shop?.name || "NexTill Shop")}</h1>
        ${shop?.address ? `<p>${escapeHtml(shop.address)}</p>` : ""}
        ${shop?.phone ? `<p>${escapeHtml(shop.phone)}</p>` : ""}
        ${shop?.owner_name ? `<p>Proprietor: ${escapeHtml(shop.owner_name)}</p>` : ""}
        <p><strong>PAN / VAT No.:</strong> ${escapeHtml(shop?.pan_vat_number || "Not provided")}</p>
        <div class="doc-title">${escapeHtml(documentTitle)}</div>
        <div class="copy">Original copy</div>
      </header>
      <div class="metadata">
        <div><strong>Invoice No.</strong> ${escapeHtml(sale.invoice_no)}</div>
        <div><strong>Date &amp; time</strong> ${escapeHtml(Number.isNaN(issueDate.getTime()) ? sale.created_at : issueDate.toLocaleString())}</div>
      </div>
      <div class="customer">
        <div><strong>Buyer</strong> ${escapeHtml(sale.customer_name || "Walk-in Customer")}</div>
        ${sale.customer_phone ? `<div><strong>Phone</strong> ${escapeHtml(sale.customer_phone)}</div>` : ""}
      </div>
      <table>
        <thead><tr><th class="index">S.N.</th><th>Particulars</th><th class="amount">Qty.</th><th class="amount">Rate (Rs)</th><th class="amount">Amount (Rs)</th></tr></thead>
        <tbody>${items || '<tr><td colspan="5">No items recorded</td></tr>'}</tbody>
      </table>
      <table class="summary">
        <tr><td>Sales before discount</td><td class="amount">${escapeHtml(money(sale.subtotal))}</td></tr>
        ${Number(sale.discount) > 0 ? `<tr><td>Discount</td><td class="amount">${escapeHtml(money(sale.discount))}</td></tr>` : ""}
        <tr><td>Taxable sales</td><td class="amount">${escapeHtml(money(taxableSales))}</td></tr>
        ${Number(sale.tax) > 0 ? `<tr><td>VAT / Tax</td><td class="amount">${escapeHtml(money(sale.tax))}</td></tr>` : ""}
        <tr class="grand-total"><td>Total amount</td><td class="amount">${escapeHtml(money(sale.total))}</td></tr>
        <tr><td>Paid so far</td><td class="amount">${escapeHtml(money(paid))}</td></tr>
        ${Number(sale.change_due) > 0 ? `<tr><td>Change</td><td class="amount">${escapeHtml(money(sale.change_due))}</td></tr>` : ""}
        ${Number(sale.outstanding_amount) > 0 ? `<tr class="due"><td>Balance due</td><td class="amount">${escapeHtml(money(sale.outstanding_amount))}</td></tr>` : ""}
      </table>
      <p class="payment"><strong>Initial payment:</strong> ${escapeHtml(paymentLabel(sale.payment_method))} · Received ${escapeHtml(money(sale.amount_received))}</p>
      ${payments ? `<table><thead><tr><th colspan="4">Payment history</th><th class="amount">Amount (Rs)</th></tr></thead><tbody>${payments}</tbody></table>` : ""}
      <div class="footer"><span><small>Customer signature</small></span><span><small>Authorized signature</small></span></div>
    </body></html>`;
}

export default function SalesScreen() {
  const { sales, shop } = useStore();
  const params = useLocalSearchParams();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(null);
  const [dismissedSaleId, setDismissedSaleId] = useState(null);
  const [exportAction, setExportAction] = useState("");
  const [exportError, setExportError] = useState("");
  const routeSaleId = typeof params.saleId === "string" ? params.saleId : null;
  const activeSaleId = selectedId || (routeSaleId !== dismissedSaleId ? routeSaleId : null);
  const methods = useMemo(() => ["All", ...new Set(sales.map((sale) => sale.payment_method).filter(Boolean))], [sales]);
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
  const selected = sales.find((sale) => sale.id === activeSaleId);

  function closeInvoice() {
    setSelectedId(null);
    setDismissedSaleId(routeSaleId);
    setExportError("");
  }

  async function exportInvoice(action) {
    if (!selected || exportAction) return;
    setExportAction(action);
    setExportError("");
    try {
      const { uri, base64 } = await Print.printToFileAsync({
        html: invoiceHtml(selected, shop),
        width: 595,
        height: 842,
        base64: true,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      if (!base64 || !base64.startsWith("JVBERi0")) {
        throw new Error("The generated invoice is not a valid PDF. Please try again.");
      }
      const fileName = `${String(selected.invoice_no || "invoice").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      if (action === "share") {
        if (!await Sharing.isAvailableAsync()) throw new Error("Sharing is not available on this device.");
        await Sharing.shareAsync(uri, {
          dialogTitle: `Share ${selected.invoice_no}`,
          mimeType: "application/pdf",
          UTI: ".pdf",
        });
      } else if (Platform.OS === "android") {
        const { StorageAccessFramework } = FileSystem;
        const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync(
          StorageAccessFramework.getUriForDirectoryInRoot("Download"),
        );
        if (!permission.granted) return;
        const destination = await StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          fileName.replace(/\.pdf$/i, ""),
          "application/pdf",
        );
        await StorageAccessFramework.writeAsStringAsync(destination, base64, { encoding: FileSystem.EncodingType.Base64 });
      } else {
        if (!await Sharing.isAvailableAsync()) throw new Error("File saving is not available on this device.");
        await Sharing.shareAsync(uri, {
          dialogTitle: `Save ${selected.invoice_no}`,
          mimeType: "application/pdf",
          UTI: ".pdf",
        });
      }
    } catch (reason) {
      setExportError(reason.message || "Could not export this invoice.");
    } finally {
      setExportAction("");
    }
  }

  return (
    <AppScreen>
      <ScreenHeader title="Sales & Bills" subtitle={`${sales.length} sales saved locally`} />
      <View style={styles.searchBox}><Search size={17} color="#858c95" strokeWidth={2} /><TextInput value={search} onChangeText={setSearch} style={styles.search} placeholder="Search invoice or customer" accessibilityLabel="Search sales" returnKeyType="search" />{search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch("")}><X size={16} color={colors.muted} /></Pressable> : null}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filterContent}>{["All", "Today", "7 days"].map((filter) => <Pressable key={filter} onPress={() => setDateFilter(filter)} style={[styles.filterChip, dateFilter === filter && styles.filterChipActive]}><Text style={[styles.filterText, dateFilter === filter && styles.filterTextActive]}>{filter}</Text></Pressable>)}</ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filterContent}>{methods.map((method) => <Pressable key={method} onPress={() => setMethodFilter(method)} style={[styles.filterChip, methodFilter === method && styles.filterChipActive]}><Text style={[styles.filterText, methodFilter === method && styles.filterTextActive]}>{method === "All" ? "All payments" : paymentLabel(method)}</Text></Pressable>)}</ScrollView>
      <Text style={styles.listMeta}>{list.length} transactions · Saved locally and backed up when online</Text>
      {list.map((sale) => <Pressable key={sale.id} onPress={() => setSelectedId(sale.id)} style={styles.saleRow}><View style={styles.icon}><ReceiptText size={17} color={colors.red} strokeWidth={1.9} /></View><View style={styles.saleDetail}><Text style={styles.invoice}>{sale.invoice_no}</Text><Text style={styles.subtle}>{new Date(sale.created_at).toLocaleString()} · {sale.customer_name || "Walk-in Customer"}</Text><Text style={[styles.status, sale.status === "synced" ? styles.synced : styles.pending]}>{sale.status === "synced" ? "Backed up" : "Pending backup"}</Text>{Number(sale.outstanding_amount) > 0 ? <Text style={styles.dueStatus}>Due {money(sale.outstanding_amount)}</Text> : null}</View><View style={styles.amount}><Text style={styles.total}>{money(sale.total)}</Text><Text style={styles.subtle}>{paymentLabel(sale.payment_method)}</Text></View><ChevronRight size={17} color="#9da3ab" /></Pressable>)}
      {list.length === 0 && <Surface style={styles.empty}><Text style={styles.emptyTitle}>{sales.length ? "No sales match these filters" : "No sales yet"}</Text><Text style={styles.subtle}>{sales.length ? "Try another date range or payment method." : "Complete a sale to create your first invoice."}</Text>{sales.length ? <Pressable style={styles.clearFilters} onPress={() => { setSearch(""); setDateFilter("All"); setMethodFilter("All"); }}><Text style={styles.clearFiltersText}>Clear filters</Text></Pressable> : <PrimaryButton title="Start a sale" onPress={() => router.push("/(tabs)/sale")} />}</Surface>}
      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={closeInvoice}>
        <Pressable style={styles.backdrop} onPress={closeInvoice}>
          <Pressable style={styles.receiptFrame} onPress={(event) => event.stopPropagation()}>
            <ScrollView style={styles.receiptScroll} contentContainerStyle={styles.receipt} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <View><Text style={styles.modalTitle}>Invoice</Text><Text style={styles.subtle}>Sale receipt</Text></View>
                <Pressable style={styles.closeButton} onPress={closeInvoice} accessibilityLabel="Close invoice"><X size={18} color={colors.ink} /></Pressable>
              </View>
              {selected && <>
                <View style={styles.receiptBrand}><View style={styles.storeMark}><Store size={18} color="white" strokeWidth={2} /></View><Text style={styles.shopName}>{shop?.name || "NexTill Shop"}</Text>{shop?.owner_name ? <Text style={styles.shopContact}>Proprietor: {shop.owner_name}</Text> : null}<Text style={styles.shopContact}>PAN / VAT No.: {shop?.pan_vat_number || "Not provided"}</Text><Text style={styles.documentTitle}>{Number(selected.tax) > 0 && shop?.pan_vat_number ? "TAX INVOICE" : "CASH MEMO / POS INVOICE"}</Text><Text style={styles.copyLabel}>ORIGINAL COPY</Text></View>
                {shop?.address ? <Text style={styles.shopContact}>{shop.address}</Text> : null}
                {shop?.phone ? <Text style={styles.shopContact}>{shop.phone}</Text> : null}
                <View style={styles.metadataBox}>
                  <View style={styles.metadataLine}><Text style={styles.metadataLabel}>Invoice No.</Text><Text style={styles.metadataValue}>{selected.invoice_no}</Text></View>
                  <View style={styles.metadataLine}><Text style={styles.metadataLabel}>Date & time</Text><Text style={styles.metadataValue}>{new Date(selected.created_at).toLocaleString()}</Text></View>
                </View>
                <View style={styles.customerBox}>
                  <Text style={styles.customerName}>{selected.customer_name || "Walk-in Customer"}</Text>
                  {selected.customer_phone ? <Text style={styles.subtle}>Phone: {selected.customer_phone}</Text> : null}
                </View>
                <View style={styles.rule} />
                <View style={styles.itemsHeader}><Text style={styles.itemNumber}>S.N.</Text><Text style={styles.itemDescription}>Particulars</Text><Text style={styles.itemQty}>Qty.</Text><Text style={styles.itemAmount}>Amount</Text></View>
                {(selected.items || []).map((item, index) => <View key={item.id} style={styles.itemRow}><Text style={styles.itemNumber}>{index + 1}</Text><View style={styles.itemDescription}><Text style={styles.productName}>{item.name_snapshot}</Text><Text style={styles.subtle}>{money(item.unit_price)} / unit</Text></View><Text style={styles.itemQty}>{item.quantity}</Text><Text style={styles.itemAmount}>{money(item.line_total)}</Text></View>)}
                <View style={styles.rule} />
                <View style={styles.totalLine}><Text style={styles.subtle}>Sales before discount</Text><Text style={styles.total}>{money(selected.subtotal)}</Text></View>
                {Number(selected.discount) > 0 ? <View style={styles.totalLine}><Text style={styles.subtle}>Discount</Text><Text style={styles.total}>− {money(selected.discount)}</Text></View> : null}
                <View style={styles.totalLine}><Text style={styles.subtle}>Taxable sales</Text><Text style={styles.total}>{money(Math.max(0, Number(selected.subtotal || 0) - Number(selected.discount || 0)))}</Text></View>
                {Number(selected.tax) > 0 ? <View style={styles.totalLine}><Text style={styles.subtle}>VAT / Tax</Text><Text style={styles.total}>{money(selected.tax)}</Text></View> : null}
                <View style={styles.totalLine}><Text style={styles.productName}>Total amount</Text><Text style={styles.modalTotal}>{money(selected.total)}</Text></View>
                <View style={styles.totalLine}><Text style={styles.subtle}>Paid so far</Text><Text style={styles.total}>{money(Number(selected.total) - Number(selected.outstanding_amount || 0))}</Text></View>
                {Number(selected.outstanding_amount) > 0 ? <View style={styles.line}><Text style={styles.dueStatus}>Balance due</Text><Text style={styles.dueStatus}>{money(selected.outstanding_amount)}</Text></View> : null}
                {Number(selected.change_due) > 0 ? <View style={styles.totalLine}><Text style={styles.subtle}>Change</Text><Text style={styles.total}>{money(selected.change_due)}</Text></View> : null}
                <Text style={styles.subtle}>Initial payment: {paymentLabel(selected.payment_method)} · Received {money(selected.amount_received)}</Text>
                {(selected.payments || []).map((payment) => <View key={payment.id} style={styles.paymentRow}><Text style={styles.subtle}>{new Date(payment.paid_at).toLocaleString()} · {paymentLabel(payment.payment_method)}</Text><Text style={styles.total}>{money(payment.amount)}</Text></View>)}
                <View style={styles.signatureRow}><Text style={styles.signature}>Customer signature</Text><Text style={styles.signature}>Authorized signature</Text></View>
              </>}
            </ScrollView>
            <View style={styles.exportActions}>
              {exportError ? <Text style={styles.exportError}>{exportError}</Text> : null}
              <Text style={styles.exportHint}>Save opens the folder picker on Android or the Files share option on iPhone/iPad.</Text>
              <View style={styles.exportButtons}>
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(exportAction)}
                  onPress={() => exportInvoice("download")}
                  style={[styles.exportButton, styles.saveButton, Boolean(exportAction) && styles.exportDisabled]}
                >
                  <Download size={16} color={colors.red} />
                  <Text style={styles.saveButtonText}>{exportAction === "download" ? "Saving…" : "Save PDF"}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={Boolean(exportAction)}
                  onPress={() => exportInvoice("share")}
                  style={[styles.exportButton, styles.shareButton, Boolean(exportAction) && styles.exportDisabled]}
                >
                  <Share2 size={16} color="white" />
                  <Text style={styles.shareButtonText}>{exportAction === "share" ? "Preparing…" : "Share bill"}</Text>
                </Pressable>
              </View>
            </View>
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
  dueStatus: { marginTop: 4, color: colors.red, fontSize: 9, fontWeight: "800" },
  amount: { alignItems: "flex-end" },
  total: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  empty: { marginTop: 10, padding: 16 },
  clearFilters: { minHeight: 40, justifyContent: "center", marginTop: 6 },
  clearFiltersText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  emptyTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  backdrop: { flex: 1, justifyContent: "flex-end", padding: 8, backgroundColor: "rgba(14,16,20,.5)" },
  receiptFrame: { maxHeight: "86%", overflow: "hidden", backgroundColor: "white", borderRadius: 16 },
  receiptScroll: { flexGrow: 0 },
  receipt: { padding: 14, paddingBottom: 24 },
  exportActions: { paddingHorizontal: 14, paddingBottom: 14, borderTopColor: colors.line, borderTopWidth: 1 },
  exportHint: { marginTop: 8, color: colors.muted, fontSize: 9, lineHeight: 13 },
  exportError: { marginTop: 8, color: colors.red, fontSize: 10 },
  exportButtons: { flexDirection: "row", gap: 8, marginTop: 8 },
  exportButton: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 8 },
  saveButton: { backgroundColor: "#fff0ef", borderWidth: 1, borderColor: "#f2c5c3" },
  shareButton: { backgroundColor: colors.red },
  saveButtonText: { color: colors.red, fontSize: 11, fontWeight: "800" },
  shareButtonText: { color: "white", fontSize: 11, fontWeight: "800" },
  exportDisabled: { opacity: 0.6 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  modalTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  closeButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", backgroundColor: "#f6f7f8", borderRadius: 19 },
  shopName: { color: colors.ink, fontSize: 17, fontWeight: "800", textAlign: "center" },
  shopContact: { marginTop: 3, color: colors.muted, fontSize: 8, textAlign: "center" },
  receiptBrand: { alignItems: "center", gap: 5 },
  documentTitle: { marginTop: 4, color: colors.ink, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  copyLabel: { color: colors.muted, fontSize: 8, fontWeight: "700" },
  storeMark: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: colors.red, borderRadius: 9 },
  metadataBox: { marginTop: 12, padding: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 5 },
  metadataLine: { minHeight: 21, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  metadataLabel: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  metadataValue: { flex: 1, color: colors.ink, fontSize: 9, fontWeight: "700", textAlign: "right" },
  customerBox: { marginTop: 7, padding: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 5 },
  customerName: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  rule: { marginVertical: 10, borderTopColor: colors.line, borderTopWidth: 1 },
  line: { minHeight: 37, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemsHeader: { minHeight: 28, flexDirection: "row", alignItems: "center", paddingVertical: 5, backgroundColor: "#f4f4f4", borderWidth: 1, borderColor: colors.line },
  itemRow: { minHeight: 42, flexDirection: "row", alignItems: "center", paddingVertical: 5, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  itemNumber: { width: 32, color: colors.ink, fontSize: 8, textAlign: "center" },
  itemDescription: { flex: 1, color: colors.ink, fontSize: 9 },
  itemQty: { width: 34, color: colors.ink, fontSize: 9, textAlign: "center" },
  itemAmount: { width: 78, paddingRight: 5, color: colors.ink, fontSize: 9, fontWeight: "700", textAlign: "right" },
  totalLine: { minHeight: 27, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  paymentRow: { minHeight: 30, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1 },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", gap: 20, marginTop: 35 },
  signature: { flex: 1, paddingTop: 6, color: colors.muted, fontSize: 8, textAlign: "center", borderTopWidth: 1, borderColor: colors.line },
  productName: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  modalTotal: { color: colors.ink, fontSize: 17, fontWeight: "900" },
});
