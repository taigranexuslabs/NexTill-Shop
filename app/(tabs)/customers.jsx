import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, Search, UserRound } from "lucide-react-native";
import { useStore } from "../../src/StoreProvider";
import { AppScreen, ScreenHeader, Surface } from "../../src/components/Screen";
import { colors } from "../../src/theme";

export default function CustomersScreen() {
  const { sales } = useStore();
  const [query, setQuery] = useState("");
  const customers = useMemo(() => {
    const map = new Map();
    sales.forEach((sale) => {
      const name = String(sale.customer_name || "").trim();
      if (!name || name.toLowerCase() === "walk-in customer") return;
      const current = map.get(name) || { name, visits: 0, total: 0 };
      current.visits += 1;
      current.total += Number(sale.total);
      map.set(name, current);
    });
    return [...map.values()];
  }, [sales]);
  const filtered = customers.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <AppScreen>
      <ScreenHeader title="Customers" subtitle={`${customers.length} customer records`} action={<Pressable style={styles.back} onPress={() => router.back()}><ArrowLeft size={17} color={colors.ink} /></Pressable>} />
      <View style={styles.search}><Search size={17} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search customers" style={styles.input} /></View>
      {filtered.map((item, index) => (
        <Surface key={item.name} style={styles.row}>
          <View style={styles.avatar}><Text style={styles.initial}>{String(item.name).charAt(0).toUpperCase()}</Text></View>
          <View style={styles.copy}><Text style={styles.name}>{item.name}</Text><Text style={styles.detail}>{item.visits} {item.visits === 1 ? "visit" : "visits"} · Rs {item.total.toLocaleString("en-IN")} spent</Text></View>
        </Surface>
      ))}
      {filtered.length === 0 ? <Surface style={styles.empty}><UserRound size={26} color={colors.red} /><Text style={styles.emptyText}>{customers.length ? "No customers match your search." : "Named customer summaries appear after you enter a customer name during checkout."}</Text></Surface> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderRadius: 22, borderWidth: 1, borderColor: colors.line },
  search: { height: 44, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingHorizontal: 11, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 9 },
  input: { flex: 1, color: colors.ink, fontSize: 11 },
  row: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  avatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 21 },
  initial: { color: colors.red, fontSize: 16, fontWeight: "900" },
  copy: { flex: 1 }, name: { color: colors.ink, fontSize: 12, fontWeight: "800" }, detail: { marginTop: 4, color: colors.muted, fontSize: 9 },
  empty: { alignItems: "center", gap: 8, marginTop: 10 }, emptyText: { color: colors.muted, fontSize: 10, textAlign: "center" },
});
