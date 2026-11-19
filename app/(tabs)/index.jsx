import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Bell, ChevronRight, Package, Plus, ReceiptText, ShoppingBag, TrendingUp, TriangleAlert } from "lucide-react-native";
import { useStore } from "../../src/StoreProvider";
import { AppScreen, Surface } from "../../src/components/Screen";
import { colors } from "../../src/theme";

const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
const chartValue = (value) => value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(Math.round(value));

export default function DashboardScreen() {
  const { ready, shop, products, sales, syncStatus, lastBackupAt } = useStore();
  if (!ready || !shop) return <AppScreen />;
  const today = new Date();
  const dayGreeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 17 ? "Good afternoon" : "Good evening";
  const todaySalesList = sales.filter((sale) => {
    const date = new Date(sale.created_at);
    return !Number.isNaN(date.getTime())
      && date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  });
  const todaySales = todaySalesList.reduce((total, sale) => total + Number(sale.total), 0);
  const todayProfit = todaySalesList.reduce((profit, sale) => {
    const lineProfit = (sale.items || []).reduce((sum, item) =>
      sum + (Number(item.unit_price) - Number(item.unit_cost)) * Number(item.quantity), 0);
    return profit + lineProfit;
  }, 0);
  const costDataMissing = todaySalesList.some((sale) =>
    (sale.items || []).some((item) => !(Number(item.unit_cost) > 0)));
  const lowStock = products.filter((product) => Number(product.stock_qty) <= Number(product.low_stock_threshold));
  const bestSellingProducts = Array.from(sales.reduce((totals, sale) => {
    for (const item of sale.items || []) {
      const key = item.product_id || item.sku_snapshot || item.name_snapshot;
      const current = totals.get(key) || { name: item.name_snapshot, quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantity);
      current.revenue += Number(item.line_total);
      totals.set(key, current);
    }
    return totals;
  }, new Map()).values()).sort((first, second) => second.quantity - first.quantity).slice(0, 4);
  const chartDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const total = sales.reduce((sum, sale) => {
      const saleDate = new Date(sale.created_at);
      return !Number.isNaN(saleDate.getTime())
        && saleDate.getFullYear() === date.getFullYear()
        && saleDate.getMonth() === date.getMonth()
        && saleDate.getDate() === date.getDate()
        ? sum + Number(sale.total)
        : sum;
    }, 0);
    return { label: date.toLocaleDateString(undefined, { weekday: "narrow" }), total };
  });
  const maxChartSales = Math.max(1, ...chartDays.map((day) => day.total));
  const hasSalesInWeek = chartDays.some((day) => day.total > 0);
  const chartBars = chartDays.map((day) => Math.round((day.total / maxChartSales) * 100));
  const stats = [
    ["Total Products", String(products.length), Package],
    ["Bills Today", String(todaySalesList.length), ReceiptText],
    ["Estimated Profit", costDataMissing ? "Unavailable" : money(todayProfit), TrendingUp],
    ["Low Stock", String(lowStock.length), TriangleAlert],
  ];
  const backupDotStyle = syncStatus === "error"
    ? styles.statusError
    : syncStatus === "syncing"
      ? styles.statusSyncing
      : syncStatus === "synced" || lastBackupAt
        ? styles.onlineDot
        : styles.statusLocal;

  return (
    <AppScreen>
      <View style={styles.top}>
        <View style={styles.brandLine}>
          <View style={styles.brandMark}><ShoppingBag color="white" size={20} strokeWidth={2.5} /></View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>{shop.name}</Text>
            <Text style={styles.caption}>NexTill Shop</Text>
          </View>
          <Pressable style={styles.notification} onPress={() => router.push("/(tabs)/settings")} accessibilityLabel="Open backup and settings">
            <Bell color={colors.ink} size={18} strokeWidth={2} />
          </Pressable>
        </View>
        <Text style={styles.greeting}>Hello, {String(shop.owner_name || "there").split(" ")[0]}!</Text>
        <Text style={styles.welcomeCaption}>{dayGreeting} · {shop.name}</Text>
        <View style={styles.statusLine}><View style={[styles.onlineDot, backupDotStyle]} /><Text style={styles.statusText}>{syncStatus === "syncing" ? "Syncing…" : syncStatus === "error" ? "Backup needs attention" : lastBackupAt ? "Last backup " + new Date(lastBackupAt).toLocaleString() : "Saved on this device"}</Text><Pressable style={styles.backupLink} onPress={() => router.push("/(tabs)/settings")}><Text style={styles.settingsLink}>Backup</Text></Pressable></View>
      </View>
      <View style={styles.todayLine}>
        <View><Text style={styles.todayTitle}>Today&apos;s overview</Text><Text style={styles.helper}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</Text></View>
        <Pressable style={styles.newSaleButton} onPress={() => router.push("/(tabs)/sale")}><Plus color="white" size={15} strokeWidth={2.5} /><Text style={styles.newSaleText}>New Sale</Text></Pressable>
      </View>
      <Surface style={styles.salesHero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroLabel}>TODAY&apos;S SALES</Text>
          <Text style={styles.heroValue}>{money(todaySales)}</Text>
          <Text style={styles.heroCaption}>{todaySalesList.length} {todaySalesList.length === 1 ? "sale" : "sales"} recorded today</Text>
        </View>
        {hasSalesInWeek ? <View style={styles.heroBars}>{chartBars.map((height, index) => <View key={`hero-${index}`} style={[styles.heroBar, { height: `${Math.max(14, height)}%` }]} />)}</View> : null}
      </Surface>
      <View style={styles.statsGrid}>{stats.map(([label, value, Icon]) => <Surface key={label} style={styles.stat}><View style={styles.statTop}><Text style={styles.statLabel}>{label}</Text><Icon size={16} color={colors.red} strokeWidth={2} /></View><Text style={[styles.statValue, label === "Estimated Profit" && costDataMissing && styles.statUnavailable]}>{value}</Text><Text style={styles.statFoot}>{label === "Low Stock" ? "Restock needed" : label === "Total Products" ? "In inventory" : label === "Bills Today" ? "Completed today" : costDataMissing ? "Add purchase prices to calculate" : "Based on recorded sales"}</Text></Surface>)}</View>
      <Surface style={styles.chartCard}><View style={styles.rowBetween}><View><Text style={styles.sectionTitle}>Sales overview</Text><Text style={styles.helper}>Recorded sales for the last 7 days</Text></View><Text style={styles.todayPill}>7D</Text></View>{hasSalesInWeek ? <View style={styles.chart}><View style={styles.axis}><Text style={styles.axisLabel}>{chartValue(maxChartSales)}</Text><Text style={styles.axisLabel}>{chartValue(maxChartSales * .66)}</Text><Text style={styles.axisLabel}>{chartValue(maxChartSales * .33)}</Text><Text style={styles.axisLabel}>0</Text></View><View style={styles.bars}>{chartBars.map((height, index) => <View style={styles.barGroup} key={`${chartDays[index].label}-${index}`}><View style={[styles.bar, index === 6 && styles.barActive, { height: `${height}%` }]} /><Text style={styles.day}>{chartDays[index].label}</Text></View>)}</View></View> : <Text style={styles.chartEmpty}>No sales recorded in the last 7 days.</Text>}</Surface>
      <Surface style={styles.listCard}><View style={styles.rowBetween}><View><Text style={styles.sectionTitle}>Best-selling products</Text><Text style={styles.helper}>Ranked by units sold</Text></View></View>{bestSellingProducts.map((item, index) => <View key={`${item.name}-${index}`} style={styles.productRow}><View style={styles.rank}><Text style={styles.rankText}>{index + 1}</Text></View><View style={styles.saleCopy}><Text style={styles.saleId}>{item.name}</Text><Text style={styles.helper}>{item.quantity} sold</Text></View><Text style={styles.saleAmount}>{money(item.revenue)}</Text></View>)}{bestSellingProducts.length === 0 && <Text style={styles.empty}>Product rankings will appear after your first sale.</Text>}</Surface>
      <Surface style={styles.listCard}><View style={styles.rowBetween}><View><Text style={styles.sectionTitle}>Recent sales</Text><Text style={styles.helper}>Latest transactions stored on this device</Text></View><Pressable style={styles.linkButton} onPress={() => router.push("/(tabs)/sales")}><Text style={styles.link}>View all</Text><ChevronRight size={14} color={colors.red} /></Pressable></View>{sales.slice(0, 4).map((sale) => <Pressable key={sale.id} style={styles.saleRow} onPress={() => router.push({ pathname: "/(tabs)/sales", params: { saleId: sale.id } })}><View style={styles.invoiceIcon}><ReceiptText color={colors.red} size={16} strokeWidth={2} /></View><View style={styles.saleCopy}><Text style={styles.saleId}>{sale.invoice_no}</Text><Text style={styles.helper}>{new Date(sale.created_at).toLocaleString()}</Text></View><View style={styles.amountCopy}><Text style={styles.saleAmount}>{money(sale.total)}</Text><Text style={[styles.helper, sale.status === "synced" ? styles.synced : styles.pending]}>{sale.status === "synced" ? "Backed up" : "Pending backup"}</Text></View></Pressable>)}{sales.length === 0 && <View style={styles.emptyBox}><Text style={styles.empty}>No sales yet. Start your first sale when you’re ready.</Text><Pressable style={styles.emptyAction} onPress={() => router.push("/(tabs)/sale")}><Text style={styles.newSaleText}>Create first sale</Text><ChevronRight color="white" size={16} /></Pressable></View>}</Surface>
      <Surface style={styles.listCard}><View style={styles.rowBetween}><View><Text style={styles.sectionTitle}>Low stock</Text><Text style={styles.helper}>Items at or below their alert level</Text></View><Pressable style={styles.linkButton} onPress={() => router.push("/(tabs)/products")}><Text style={styles.link}>Inventory</Text><ChevronRight size={14} color={colors.red} /></Pressable></View>{lowStock.slice(0, 4).map((product) => <View key={product.id} style={styles.productRow}><View style={styles.productIcon}><Package color={colors.red} size={17} strokeWidth={2} /></View><View style={styles.saleCopy}><Text style={styles.saleId}>{product.name}</Text><Text style={styles.helper}>{product.category} · {product.sku}</Text></View><Text style={styles.lowQty}>{product.stock_qty} left</Text></View>)}{lowStock.length === 0 && <Text style={styles.empty}>All products are above their low-stock threshold.</Text>}</Surface>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  top: { marginBottom: 14 },
  brandLine: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 38, height: 38, alignItems: "center", justifyContent: "center", backgroundColor: colors.red, borderRadius: 12 },
  brandGlyph: { color: "white", fontSize: 17, fontWeight: "900" },
  brandCopy: { flex: 1 },
  brandName: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  caption: { marginTop: 2, color: colors.muted, fontSize: 9 },
  notification: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 22 },
  greeting: { marginTop: 16, color: colors.ink, fontSize: 22, fontWeight: "800" },
  welcomeCaption: { marginTop: 3, color: colors.muted, fontSize: 11 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#35c888" },
  statusSyncing: { backgroundColor: "#d9a03c" },
  statusError: { backgroundColor: colors.red },
  statusLocal: { backgroundColor: "#969ca5" },
  statusText: { flex: 1, color: colors.muted, fontSize: 10 },
  settingsLink: { color: colors.red, fontSize: 10, fontWeight: "800" },
  backupLink: { minHeight: 40, justifyContent: "center" },
  todayLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  todayTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  newSaleButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 11, backgroundColor: colors.red, borderRadius: 8 },
  newSaleText: { color: "white", fontSize: 10, fontWeight: "800" },
  salesHero: { minHeight: 108, flexDirection: "row", alignItems: "center", justifyContent: "space-between", overflow: "hidden", marginBottom: 10, padding: 15, backgroundColor: colors.red, borderColor: colors.red },
  heroCopy: { flex: 1 },
  heroLabel: { color: "#ffe5e4", fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  heroValue: { marginTop: 7, color: "white", fontSize: 24, fontWeight: "900" },
  heroCaption: { marginTop: 4, color: "#ffe5e4", fontSize: 9 },
  heroBars: { height: 54, width: 100, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 5, marginLeft: 8 },
  heroBar: { flex: 1, minHeight: 7, backgroundColor: "rgba(255,255,255,.35)", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  stat: { width: "48.5%", minHeight: 91, padding: 11 },
  statTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { color: colors.muted, fontSize: 10 },
  statValue: { marginTop: 7, color: colors.ink, fontSize: 18, fontWeight: "800" },
  statUnavailable: { color: colors.muted, fontSize: 11 },
  statFoot: { marginTop: 4, color: "#9298a2", fontSize: 9 },
  chartCard: { marginTop: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  helper: { marginTop: 3, color: "#9096a0", fontSize: 9 },
  chartEmpty: { paddingVertical: 35, color: colors.muted, fontSize: 10, textAlign: "center" },
  todayPill: { paddingHorizontal: 9, paddingVertical: 6, color: "#747b85", backgroundColor: "#f5f5f6", borderRadius: 6, fontSize: 8 },
  chart: { height: 135, flexDirection: "row", gap: 8, marginTop: 13 },
  axis: { justifyContent: "space-between", paddingBottom: 14, color: "#a1a6ae" },
  axisLabel: { color: "#a1a6ae", fontSize: 9 },
  bars: { flex: 1, flexDirection: "row", justifyContent: "space-around", alignItems: "stretch", borderBottomColor: colors.line, borderBottomWidth: 1 },
  barGroup: { width: "10%", alignItems: "center", justifyContent: "flex-end", gap: 5 },
  bar: { width: 16, maxHeight: "95%", backgroundColor: "#ffc9c6", borderRadius: 4 },
  barActive: { backgroundColor: colors.red },
  day: { marginBottom: -13, color: "#969ca5", fontSize: 8 },
  listCard: { marginTop: 10 },
  link: { color: colors.red, fontSize: 9, fontWeight: "800" },
  linkButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 1 },
  saleRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 9, marginTop: 5, paddingTop: 6, borderTopColor: "#eff0f2", borderTopWidth: 1 },
  rank: { width: 28, height: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 8 },
  rankText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  invoiceIcon: { width: 31, height: 31, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 8 },
  productIcon: { width: 31, height: 31, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 8 },
  saleCopy: { flex: 1 },
  amountCopy: { alignItems: "flex-end" },
  saleId: { color: colors.ink, fontSize: 10, fontWeight: "750" },
  saleAmount: { color: colors.ink, fontSize: 10, fontWeight: "800" },
  synced: { color: colors.green },
  pending: { color: colors.amber },
  empty: { paddingVertical: 18, color: colors.muted, fontSize: 11, lineHeight: 16 },
  emptyBox: { alignItems: "flex-start" },
  emptyAction: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, backgroundColor: colors.red, borderRadius: 8 },
  productRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, borderTopColor: "#eff0f2", borderTopWidth: 1 },
  lowQty: { paddingHorizontal: 8, paddingVertical: 5, color: colors.amber, backgroundColor: "#fff4e2", borderRadius: 6, fontSize: 8, fontWeight: "800" },
});
