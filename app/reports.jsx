import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, TrendingUp } from "lucide-react-native";
import { useStore } from "../src/StoreProvider";
import { AppScreen, ScreenHeader, Surface } from "../src/components/Screen";
import { colors } from "../src/theme";

const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;

export default function ReportsScreen() {
  const { sales } = useStore();
  const salesTotal = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const profit = sales.reduce((sum, sale) => sum + (sale.items || []).reduce((line, item) =>
    line + (Number(item.unit_price) - Number(item.unit_cost)) * Number(item.quantity), 0), 0);
  const costMissing = sales.some((sale) => (sale.items || []).some((item) => !(Number(item.unit_cost) > 0)));
  const average = sales.length ? salesTotal / sales.length : 0;
  const productTotals = new Map();
  sales.forEach((sale) => (sale.items || []).forEach((item) => {
    const key = item.name_snapshot || "Unknown";
    productTotals.set(key, (productTotals.get(key) || 0) + Number(item.quantity));
  }));
  const topProducts = [...productTotals].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <AppScreen>
      <ScreenHeader title="Reports" subtitle="See how your shop is doing" action={<Pressable style={styles.back} onPress={() => router.back()}><ArrowLeft size={17} color={colors.ink} /></Pressable>} />
      <View style={styles.grid}>
        <Surface style={styles.card}><Text style={styles.label}>Sales altogether</Text><Text style={styles.value}>{money(salesTotal)}</Text></Surface>
        <Surface style={styles.card}><Text style={styles.label}>Estimated profit</Text><Text style={[styles.value, costMissing && styles.small]}>{costMissing ? "Add cost prices" : money(profit)}</Text></Surface>
        <Surface style={styles.card}><Text style={styles.label}>Bills completed</Text><Text style={styles.value}>{sales.length}</Text></Surface>
        <Surface style={styles.card}><Text style={styles.label}>Average bill</Text><Text style={styles.value}>{money(average)}</Text></Surface>
      </View>
      <Surface style={styles.chartCard}>
        <View style={styles.headingRow}><View><Text style={styles.sectionTitle}>Popular items</Text><Text style={styles.helper}>Items sold most often</Text></View><TrendingUp size={18} color={colors.red} /></View>
        {topProducts.map(([name, quantity], index) => (
          <View key={name} style={styles.productRow}>
            <View style={styles.rank}><Text style={styles.rankText}>{index + 1}</Text></View>
            <View style={styles.productCopy}><Text style={styles.productName}>{name}</Text><View style={styles.track}><View style={[styles.bar, { width: `${Math.max(8, (quantity / topProducts[0][1]) * 100)}%` }]} /></View></View>
            <Text style={styles.quantity}>{quantity} sold</Text>
          </View>
        ))}
        {topProducts.length === 0 ? <Text style={styles.empty}>Complete sales to generate product reports.</Text> : null}
      </Surface>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderRadius: 22, borderWidth: 1, borderColor: colors.line },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  card: { width: "48.5%", minHeight: 102, justifyContent: "center" },
  label: { color: colors.muted, fontSize: 12 },
  value: { marginTop: 8, color: colors.ink, fontSize: 19, fontWeight: "900" },
  small: { color: colors.amber, fontSize: 12 },
  chartCard: { marginTop: 10 },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  helper: { marginTop: 4, color: colors.muted, fontSize: 11 },
  productRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, borderTopColor: colors.line, borderTopWidth: 1 },
  rank: { width: 28, height: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 8 },
  rankText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  productCopy: { flex: 1 },
  productName: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  track: { height: 5, marginTop: 6, backgroundColor: "#f1f2f4", borderRadius: 3 },
  bar: { height: 5, backgroundColor: colors.red, borderRadius: 3 },
  quantity: { color: colors.muted, fontSize: 11 },
  empty: { paddingVertical: 20, color: colors.muted, fontSize: 12, textAlign: "center" },
});
