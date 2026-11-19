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
    const text = `${product.name} ${product.sku} ${product.barcode || ""}`.toLowerCase();
    return product.active && (category === "All" || product.category === category) && text.includes(search.toLowerCase());
  }), [category, products, search]);
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + Number(item.product.selling_price) * item.quantity, 0);

  return (
    <AppScreen scroll={false} contentStyle={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="New Sale" subtitle="Tap a product to add it to the cart" action={<Pressable style={styles.scanButton} onPress={() => router.push("/scanner")}><ScanLine size={16} color={colors.red} strokeWidth={2} /><Text style={styles.scanText}>Scan</Text></Pressable>} />
        <View style={styles.searchBox}><Search size={18} color="#828994" strokeWidth={2} /><TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search name, SKU or barcode" accessibilityLabel="Search products for sale" returnKeyType="search" /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroller} contentContainerStyle={styles.categoryContent}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, item === category && styles.categoryActive]}><Text style={[styles.categoryText, item === category && styles.categoryTextActive]}>{item}</Text></Pressable>)}</ScrollView>
        <View style={styles.grid}>{visibleProducts.map((product) => <Pressable key={product.id} style={[styles.product, Number(product.stock_qty) === 0 && styles.dimmed]} disabled={Number(product.stock_qty) === 0} onPress={() => addToCart(product)}><View style={[styles.productArt, { backgroundColor: "#fff0ef" }]}>{product.image_url ? <Image source={{ uri: product.image_url }} style={styles.productImage} /> : <Package size={31} color={colors.red} strokeWidth={1.8} />}</View><Text numberOfLines={1} style={styles.productName}>{product.name}</Text><Text style={styles.productPrice}>{money(product.selling_price)}</Text><Text style={styles.stock}>Stock: {product.stock_qty}</Text><View style={styles.addButton}><Plus size={17} color={colors.red} strokeWidth={2.5} /></View></Pressable>)}</View>
        {visibleProducts.length === 0 && <Surface style={styles.noProducts}><Package size={28} color={colors.red} strokeWidth={1.8} /><Text style={styles.emptyTitle}>{products.length === 0 ? "Inventory is empty" : "No products found"}</Text><Text style={styles.stock}>{products.length === 0 ? "Add products in Inventory to start a sale." : "Try another search or category."}</Text><Pressable style={styles.emptyAction} onPress={() => { if (products.length === 0) router.push("/(tabs)/products"); else { setSearch(""); setCategory("All"); } }}><Text style={styles.emptyActionText}>{products.length === 0 ? "Open Inventory" : "Clear search and filters"}</Text></Pressable></Surface>}
        {cartNotice ? <Text style={styles.cartNotice}>{cartNotice}</Text> : null}
      </ScrollView>
      <Surface style={styles.cartSummary}><View><Text style={styles.cartItems}>{itemCount} {itemCount === 1 ? "item" : "items"} in cart</Text><Text style={styles.cartTotal}>{money(total)}</Text></View><Pressable style={styles.viewCart} onPress={() => router.push("/checkout")} disabled={!cart.length}><ShoppingCart size={15} color="white" strokeWidth={2} /><Text style={styles.viewCartText}>{cart.length ? "View Cart" : "Cart empty"}</Text></Pressable></Surface>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  scrollContent: { flexGrow: 1, paddingBottom: 76 },
  scanButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 11, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  scanText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  searchBox: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 12 },
  categoryScroller: { flexGrow: 0, marginVertical: 11 },
  categoryContent: { gap: 6 },
  category: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 18 },
  categoryActive: { backgroundColor: colors.red, borderColor: colors.red },
  categoryText: { color: "#707782", fontSize: 10 },
  categoryTextActive: { color: "white", fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  product: { width: "48.5%", minHeight: 165, position: "relative", padding: 9, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 11 },
  productArt: { height: 79, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  productImage: { width: "100%", height: "100%", borderRadius: 8 },
  productName: { marginTop: 7, color: colors.ink, fontSize: 12, fontWeight: "800" },
  productPrice: { marginTop: 4, color: colors.red, fontSize: 12, fontWeight: "800" },
  stock: { marginTop: 4, color: "#8c929c", fontSize: 10 },
  addButton: { position: "absolute", right: 8, bottom: 8, width: 31, height: 31, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 8 },
  dimmed: { opacity: 0.5 },
  noProducts: { alignItems: "center", gap: 5, marginTop: 12, paddingVertical: 20 },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  emptyAction: { minHeight: 40, justifyContent: "center", marginTop: 5, paddingHorizontal: 10, backgroundColor: "#fff0ef", borderRadius: 8 },
  emptyActionText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  cartSummary: { minHeight: 57, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9, paddingHorizontal: 12, backgroundColor: colors.dark, borderColor: colors.dark },
  cartItems: { color: "#e0e1e4", fontSize: 9 },
  cartTotal: { marginTop: 2, color: "white", fontSize: 15, fontWeight: "800" },
  viewCart: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 11, backgroundColor: colors.red, borderRadius: 8 },
  viewCartText: { color: "white", fontSize: 10, fontWeight: "800" },
  cartNotice: { marginTop: 8, color: colors.amber, fontSize: 9 },
});
