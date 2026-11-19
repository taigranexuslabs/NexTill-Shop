import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Package, Plus, ScanLine, Search, ShoppingCart } from "lucide-react-native";
import { useStore } from "../../src/StoreProvider";
import { AppScreen, ScreenHeader, Surface } from "../../src/components/Screen";
import { colors } from "../../src/theme";

const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;

export default function SaleScreen() {
  const { products, cart, cartNotice, addToCart } = useStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(products.map((product) => product.category))];
  const visibleProducts = useMemo(() => products.filter((product) => {
    const text = `${product.name} ${product.barcodes?.join(" ") || product.barcode || ""}`.toLowerCase();
    return product.active && (category === "All" || product.category === category) && text.includes(search.toLowerCase());
  }), [category, products, search]);
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + Number(item.product.selling_price) * item.quantity, 0);

  return (
    <AppScreen scroll={false} contentStyle={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Sell" subtitle="Choose items to add them to the bill" action={<Pressable style={styles.scanButton} onPress={() => router.push("/scanner")}><ScanLine size={18} color={colors.red} strokeWidth={2} /><Text style={styles.scanText}>Scan item</Text></Pressable>} />
        <View style={styles.searchBox}><Search size={19} color="#78837f" strokeWidth={2} /><TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Find an item by name or barcode" accessibilityLabel="Search products for sale" returnKeyType="search" /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroller} contentContainerStyle={styles.categoryContent}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, item === category && styles.categoryActive]}><Text style={[styles.categoryText, item === category && styles.categoryTextActive]}>{item}</Text></Pressable>)}</ScrollView>
        <View style={styles.grid}>{visibleProducts.map((product) => <Pressable key={product.id} style={[styles.product, Number(product.stock_qty) === 0 && styles.dimmed]} disabled={Number(product.stock_qty) === 0} onPress={() => addToCart(product)}><View style={[styles.productArt, { backgroundColor: "#fff0ef" }]}>{product.image_url ? <Image source={{ uri: product.image_url }} style={styles.productImage} /> : <Package size={31} color={colors.red} strokeWidth={1.8} />}</View><Text numberOfLines={1} style={styles.productName}>{product.name}</Text><Text style={styles.productPrice}>{money(product.selling_price)}</Text><Text style={styles.stock}>Stock: {product.stock_qty}</Text><View style={styles.addButton}><Plus size={17} color={colors.red} strokeWidth={2.5} /></View></Pressable>)}</View>
        {visibleProducts.length === 0 && <Surface style={styles.noProducts}><Package size={28} color={colors.red} strokeWidth={1.8} /><Text style={styles.emptyTitle}>{products.length === 0 ? "Inventory is empty" : "No products found"}</Text><Text style={styles.stock}>{products.length === 0 ? "Add products in Inventory to start a sale." : "Try another search or category."}</Text><Pressable style={styles.emptyAction} onPress={() => { if (products.length === 0) router.push("/(tabs)/products"); else { setSearch(""); setCategory("All"); } }}><Text style={styles.emptyActionText}>{products.length === 0 ? "Open Inventory" : "Clear search and filters"}</Text></Pressable></Surface>}
        {cartNotice ? <Text style={styles.cartNotice}>{cartNotice}</Text> : null}
      </ScrollView>
      <Surface style={styles.cartSummary}><View><Text style={styles.cartItems}>{itemCount} {itemCount === 1 ? "item" : "items"} · bill total</Text><Text style={styles.cartTotal}>{money(total)}</Text></View><Pressable style={styles.viewCart} onPress={() => router.push("/checkout")} disabled={!cart.length}><ShoppingCart size={18} color="white" strokeWidth={2} /><Text style={styles.viewCartText}>{cart.length ? "Review bill" : "Add items"}</Text></Pressable></Surface>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  scrollContent: { flexGrow: 1, paddingBottom: 90 },
  scanButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 13, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  scanText: { color: colors.red, fontSize: 12, fontWeight: "800" },
  searchBox: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 13 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14 },
  categoryScroller: { flexGrow: 0, marginVertical: 11 },
  categoryContent: { gap: 6 },
  category: { minHeight: 42, justifyContent: "center", paddingHorizontal: 15, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 21 },
  categoryActive: { backgroundColor: colors.red, borderColor: colors.red },
  categoryText: { color: "#626f6b", fontSize: 12 },
  categoryTextActive: { color: "white", fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  product: { width: "48.5%", minHeight: 184, position: "relative", padding: 11, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 15 },
  productArt: { height: 92, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  productImage: { width: "100%", height: "100%", borderRadius: 8 },
  productName: { marginTop: 8, color: colors.ink, fontSize: 14, fontWeight: "800" },
  productPrice: { marginTop: 5, color: colors.red, fontSize: 14, fontWeight: "800" },
  stock: { marginTop: 5, color: "#78837f", fontSize: 12 },
  addButton: { position: "absolute", right: 9, bottom: 9, width: 38, height: 38, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 11 },
  dimmed: { opacity: 0.5 },
  noProducts: { alignItems: "center", gap: 5, marginTop: 12, paddingVertical: 20 },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  emptyAction: { minHeight: 46, justifyContent: "center", marginTop: 6, paddingHorizontal: 14, backgroundColor: "#fff0ef", borderRadius: 11 },
  emptyActionText: { color: colors.red, fontSize: 12, fontWeight: "800" },
  cartSummary: { minHeight: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9, paddingHorizontal: 16, backgroundColor: colors.dark, borderColor: colors.dark },
  cartItems: { color: "#e0e7e4", fontSize: 11 },
  cartTotal: { marginTop: 3, color: "white", fontSize: 19, fontWeight: "800" },
  viewCart: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 14, backgroundColor: colors.red, borderRadius: 12 },
  viewCartText: { color: "white", fontSize: 12, fontWeight: "800" },
  cartNotice: { marginTop: 8, color: colors.amber, fontSize: 11 },
});
