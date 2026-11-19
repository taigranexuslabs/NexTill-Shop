import { useMemo, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams } from "expo-router";
import { ArrowLeft, Camera, Package, Plus, ScanLine, Search, X } from "lucide-react-native";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useStore } from "../../src/StoreProvider";
import { AppScreen, PrimaryButton, ScreenHeader, Surface } from "../../src/components/Screen";
import { persistProductPhoto } from "../../src/lib/productImages";
import { colors } from "../../src/theme";

const blankForm = () => ({ name: "", sku: "", barcode: "", category: "Drinks", unit: "unit", imageUrl: "", cloudImageUrl: "", costPrice: "", sellingPrice: "", stockQty: "", lowStockThreshold: "5" });
const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;

function ProductField({ label, value, onChangeText, placeholder, keyboardType = "default", editable = true, autoCapitalize = "sentences" }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={[styles.input, !editable && styles.readOnly]} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} editable={editable} autoCapitalize={autoCapitalize} accessibilityLabel={label.replace(" *", "")} /></View>;
}

export default function ProductsScreen() {
  const { products, saveProduct } = useStore();
  const params = useLocalSearchParams();
  const scannedBarcode = typeof params.barcode === "string" ? params.barcode : "";
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dismissedBarcode, setDismissedBarcode] = useState("");
  const [cameraMode, setCameraMode] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const scanHandled = useRef(false);
  const scannedFormActive = Boolean(scannedBarcode && scannedBarcode !== dismissedBarcode);
  const showNewForm = mode === "new" || scannedFormActive;
  const editingProduct = mode !== null && mode !== "new" && !scannedFormActive;
  const showingForm = editingProduct || showNewForm;
  const formValues = scannedFormActive ? { ...form, barcode: scannedBarcode } : form;
  const categories = useMemo(() => ["All", ...new Set(products.map((product) => product.category).filter(Boolean))], [products]);
  const filtered = useMemo(() => products.filter((product) => {
    const matchesQuery = `${product.name} ${product.sku} ${product.barcode || ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
    const stock = Number(product.stock_qty);
    const matchesStock = stockFilter === "All"
      || (stockFilter === "Low" && stock > 0 && stock <= Number(product.low_stock_threshold))
      || (stockFilter === "Out" && stock <= 0);
    return matchesQuery && matchesCategory && matchesStock;
  }), [products, query, selectedCategory, stockFilter]);

  function beginEdit(product) {
    setForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || "",
      category: product.category,
      unit: product.unit,
      imageUrl: product.image_url || "",
      cloudImageUrl: product.cloud_image_url || "",
      costPrice: String(product.cost_price),
      sellingPrice: String(product.selling_price),
      stockQty: String(product.stock_qty),
      lowStockThreshold: String(product.low_stock_threshold),
    });
    setDismissedBarcode(scannedBarcode);
    setError("");
    setMode(product);
  }

  async function startCamera(nextMode) {
    setError("");
    try {
      const currentPermission = permission?.granted ? permission : await requestPermission();
      if (!currentPermission.granted) {
        setError("Camera permission is needed to take product photos or scan barcodes.");
        return;
      }
      scanHandled.current = false;
      setCameraReady(false);
      setCameraMode(nextMode);
    } catch (reason) {
      setError(reason.message || "Could not open the camera.");
    }
  }

  async function captureProductPhoto() {
    if (!cameraRef.current || !cameraReady || cameraBusy) return;
    setCameraBusy(true);
    setError("");
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.65 });
      const imageUrl = await persistProductPhoto(picture.uri);
      setForm((current) => ({ ...current, imageUrl }));
      setCameraMode(null);
    } catch (reason) {
      setError(reason.message || "Could not save the product photo.");
    } finally {
      setCameraBusy(false);
    }
  }

  function handleBarcodeScanned({ data }) {
    if (scanHandled.current) return;
    scanHandled.current = true;
    setDismissedBarcode(scannedBarcode);
    setForm((current) => ({ ...current, barcode: data.trim() }));
    setCameraMode(null);
    setError("");
  }

  const cameraControls = (
    <Surface style={styles.photoCard}>
      <View style={styles.photoRow}>
        {form.imageUrl
          ? <Image source={{ uri: form.imageUrl }} style={styles.photoPreview} />
          : <View style={styles.photoPlaceholder}><Camera size={28} color={colors.red} strokeWidth={1.8} /></View>}
        <View style={styles.photoCopy}>
          <Text style={styles.photoTitle}>{form.imageUrl ? "Product photo" : "Add a product photo"}</Text>
          <Text style={styles.photoHint}>Take a clear photo to recognize products at checkout.</Text>
          <Pressable style={styles.secondaryButton} onPress={() => startCamera("photo")}>
            <Text style={styles.secondaryButtonText}>{form.imageUrl ? "Retake photo" : "Take photo"}</Text>
          </Pressable>
        </View>
      </View>
      {cameraMode ? (
        <View style={styles.cameraPanel}>
          <CameraView
            ref={cameraRef}
            style={styles.cameraPreview}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
            barcodeScannerSettings={cameraMode === "barcode" ? { barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"] } : undefined}
            onBarcodeScanned={cameraMode === "barcode" ? handleBarcodeScanned : undefined}
            onMountError={({ message }) => { setCameraMode(null); setError(`Camera could not start: ${message}`); }}
          />
          {cameraMode === "photo" ? (
            <PrimaryButton title={cameraBusy ? "Saving photo…" : cameraReady ? "Capture photo" : "Opening camera…"} onPress={captureProductPhoto} disabled={cameraBusy || !cameraReady} style={styles.cameraAction} />
          ) : <Text style={styles.scanHint}>Point the camera at a product barcode.</Text>}
          <Pressable onPress={() => setCameraMode(null)} style={styles.cameraCancel}><Text style={styles.link}>Cancel camera</Text></Pressable>
        </View>
      ) : null}
      <Pressable style={styles.scanBarcodeButton} onPress={() => startCamera("barcode")}>
        <ScanLine size={15} color={colors.red} strokeWidth={2} /><Text style={styles.secondaryButtonText}>Scan barcode</Text>
      </Pressable>
    </Surface>
  );

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await saveProduct(formValues, mode && mode !== "new" && !scannedFormActive ? mode : null);
      setMode(null);
      setForm(blankForm());
      setDismissedBarcode(scannedBarcode);
    } catch (reason) {
      setError(reason.message || "Could not save product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen scroll={!showingForm} contentStyle={showingForm ? styles.formScreenContainer : undefined}>
      {showingForm ? (
        <KeyboardAvoidingView style={styles.formScreen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScreenHeader
            title={editingProduct ? "Edit Product" : "Add Product"}
            subtitle={editingProduct ? "Updates are saved on this device first" : "Create a product while online or offline"}
            action={<Pressable style={styles.cancelButton} onPress={() => { setMode(null); setDismissedBarcode(scannedBarcode); setError(""); }}><ArrowLeft size={16} color={colors.red} /><Text style={styles.link}>Back</Text></Pressable>}
          />
          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContent} keyboardShouldPersistTaps="handled">
            <Surface style={styles.formCard}>
              {cameraControls}
              <ProductField label="Product name *" value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="e.g. Coca Cola" />
              <ProductField label="SKU *" value={form.sku} onChangeText={(sku) => setForm({ ...form, sku })} placeholder="e.g. CC001" autoCapitalize="characters" />
              <ProductField label="Barcode" value={formValues.barcode} onChangeText={(barcode) => { setDismissedBarcode(scannedBarcode); setForm({ ...form, barcode }); }} placeholder="Enter or scan barcode" autoCapitalize="characters" />
              <Pressable style={styles.scanFieldButton} onPress={() => startCamera("barcode")}><ScanLine size={15} color={colors.red} strokeWidth={2} /><Text style={styles.secondaryButtonText}>Scan barcode</Text></Pressable>
              <ProductField label="Category" value={form.category} onChangeText={(category) => setForm({ ...form, category })} placeholder="e.g. Drinks or Snacks" />
              <ProductField label="Unit" value={form.unit} onChangeText={(unit) => setForm({ ...form, unit })} placeholder="e.g. piece, pack, kg" />
              <ProductField label="Cost price (Rs)" value={form.costPrice} onChangeText={(costPrice) => setForm({ ...form, costPrice })} placeholder="0.00" keyboardType="decimal-pad" />
              <ProductField label="Selling price (Rs) *" value={form.sellingPrice} onChangeText={(sellingPrice) => setForm({ ...form, sellingPrice })} placeholder="0.00" keyboardType="decimal-pad" />
              <ProductField label={editingProduct ? "Current stock" : "Opening stock"} value={form.stockQty} onChangeText={editingProduct ? () => {} : (stockQty) => setForm({ ...form, stockQty })} placeholder="0" keyboardType="decimal-pad" editable={!editingProduct} />
              <ProductField label="Low stock alert" value={form.lowStockThreshold} onChangeText={(lowStockThreshold) => setForm({ ...form, lowStockThreshold })} placeholder="5" keyboardType="decimal-pad" />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </Surface>
          </ScrollView>
          <View style={styles.formAction}><PrimaryButton title={saving ? "Saving…" : editingProduct ? "Save Changes" : "Save Product"} onPress={submit} disabled={saving} /></View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <ScreenHeader title="Products" subtitle={`${products.length} products · stored on this device`} action={<Pressable style={styles.addButton} onPress={() => { setForm(blankForm()); setDismissedBarcode(scannedBarcode); setMode("new"); }}><Plus size={15} color="white" strokeWidth={2.5} /><Text style={styles.addText}>Add</Text></Pressable>} />
          <View style={styles.searchBox}><Search size={17} color="#858c95" strokeWidth={2} /><TextInput value={query} onChangeText={setQuery} style={styles.search} placeholder="Search name, SKU or barcode" accessibilityLabel="Search products" returnKeyType="search" /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroller} contentContainerStyle={styles.categoryContent}>
            {categories.map((category) => <Pressable key={category} onPress={() => setSelectedCategory(category)} style={[styles.categoryChip, category === selectedCategory && styles.categoryChipActive]}><Text style={[styles.categoryChipText, category === selectedCategory && styles.categoryChipTextActive]}>{category}</Text></Pressable>)}
          </ScrollView>
          <View style={styles.filterRow}>
            <View style={styles.stockFilters}>{["All", "Low", "Out"].map((filter) => <Pressable key={filter} onPress={() => setStockFilter(filter)} style={[styles.stockFilter, stockFilter === filter && styles.stockFilterActive]}><Text style={[styles.stockFilterText, stockFilter === filter && styles.stockFilterTextActive]}>{filter}</Text></Pressable>)}</View>
            <Text style={styles.filterText}>{filtered.length} items</Text>
          </View>
          <View style={styles.productGrid}>{filtered.map((product) => {
            const stock = Number(product.stock_qty);
            const low = stock <= Number(product.low_stock_threshold);
            return <Pressable key={product.id} style={styles.productCard} onPress={() => beginEdit(product)}>
              <View style={styles.productArt}>{product.image_url ? <Image source={{ uri: product.image_url }} style={styles.productImage} /> : <Package size={28} color={colors.red} strokeWidth={1.8} />}</View>
              <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
              <Text numberOfLines={1} style={styles.muted}>{product.category} · {product.sku}</Text>
              <View style={styles.productMeta}><Text style={styles.price}>{money(product.selling_price)}</Text><Text style={[styles.stockBadge, low && styles.lowStockBadge, stock <= 0 && styles.outStockBadge]}>{stock <= 0 ? "Out of stock" : low ? "Low stock" : `${stock} in stock`}</Text></View>
            </Pressable>;
          })}</View>
          {filtered.length === 0 && <Surface style={styles.empty}><Text style={styles.emptyText}>{products.length === 0 ? "No products yet. Add your first product; it will be saved locally." : "No products match your search and filters."}</Text>{products.length === 0 ? <PrimaryButton title="Add Product" onPress={() => { setForm(blankForm()); setDismissedBarcode(scannedBarcode); setMode("new"); }} /> : <Pressable style={styles.clearFilters} onPress={() => { setQuery(""); setSelectedCategory("All"); setStockFilter("All"); }}><X size={15} color={colors.red} /><Text style={styles.link}>Clear search and filters</Text></Pressable>}</Surface>}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 10, backgroundColor: colors.red, borderRadius: 8 },
  addText: { color: "white", fontSize: 11, fontWeight: "800" },
  searchBox: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 9 },
  search: { flex: 1, color: colors.ink, fontSize: 12 },
  categoryScroller: { flexGrow: 0, marginTop: 10 },
  categoryContent: { gap: 6, paddingVertical: 2 },
  categoryChip: { minHeight: 40, justifyContent: "center", paddingHorizontal: 11, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 20 },
  categoryChipActive: { backgroundColor: colors.red, borderColor: colors.red },
  categoryChipText: { color: "#707782", fontSize: 10 },
  categoryChipTextActive: { color: "white", fontWeight: "800" },
  filterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 8 },
  filterText: { color: "#999fa8", fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  stockFilters: { flexDirection: "row", gap: 5 },
  stockFilter: { minHeight: 36, justifyContent: "center", paddingHorizontal: 9, backgroundColor: "white", borderRadius: 16 },
  stockFilterActive: { backgroundColor: "#fff0ef" },
  stockFilterText: { color: "#858c95", fontSize: 8, fontWeight: "700" },
  stockFilterTextActive: { color: colors.red },
  productGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 9 },
  productCard: { width: "48.5%", minHeight: 156, padding: 9, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 11 },
  productArt: { height: 79, alignItems: "center", justifyContent: "center", marginBottom: 8, overflow: "hidden", backgroundColor: "#fff0ef", borderRadius: 8 },
  productName: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  muted: { marginTop: 3, color: "#8e949e", fontSize: 9 },
  price: { marginTop: 3, color: colors.red, fontSize: 11, fontWeight: "800" },
  productMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, marginTop: 4 },
  stockBadge: { color: colors.green, fontSize: 8, fontWeight: "700" },
  lowStockBadge: { color: colors.amber },
  outStockBadge: { color: colors.red },
  productImage: { width: "100%", height: "100%", resizeMode: "contain" },
  formCard: { padding: 14 },
  formScreenContainer: { paddingBottom: 0 },
  formScreen: { flex: 1 },
  formScroll: { flex: 1 },
  formScrollContent: { paddingBottom: 12 },
  formAction: { paddingTop: 8, paddingBottom: 8, backgroundColor: colors.background },
  cancelButton: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 5 },
  photoCard: { gap: 10, marginBottom: 13, padding: 10, backgroundColor: "#f8f8f9", borderColor: colors.line },
  photoRow: { alignItems: "center", gap: 9 },
  photoPreview: { width: 92, height: 92, resizeMode: "contain", backgroundColor: "white", borderRadius: 9 },
  photoPlaceholder: { width: 92, height: 92, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 9 },
  photoCopy: { alignItems: "center" },
  photoTitle: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  photoHint: { marginTop: 4, color: colors.muted, fontSize: 9, lineHeight: 13, textAlign: "center" },
  secondaryButton: { minHeight: 38, justifyContent: "center", marginTop: 7, paddingHorizontal: 10, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 7 },
  secondaryButtonText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  cameraPanel: { gap: 8 },
  cameraPreview: { height: 210, overflow: "hidden", backgroundColor: colors.dark, borderRadius: 9 },
  cameraAction: { marginTop: 0 },
  scanHint: { color: colors.muted, fontSize: 9, textAlign: "center" },
  cameraCancel: { alignItems: "center", paddingVertical: 5 },
  scanBarcodeButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 7 },
  scanFieldButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, minHeight: 40, marginTop: -4, marginBottom: 10, paddingVertical: 4 },
  field: { marginBottom: 10 },
  label: { marginBottom: 5, color: "#424953", fontSize: 11, fontWeight: "700" },
  input: { height: 44, paddingHorizontal: 10, color: colors.ink, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 8, fontSize: 13 },
  readOnly: { color: colors.muted, backgroundColor: "#f5f6f7" },
  error: { marginBottom: 8, color: colors.red, fontSize: 10 },
  link: { color: colors.red, fontSize: 10, fontWeight: "800" },
  empty: { gap: 12, marginTop: 12 },
  emptyText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  clearFilters: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 4 },
});
