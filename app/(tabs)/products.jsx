import { useMemo, useRef, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams } from "expo-router";
import { ArrowLeft, Camera, CreditCard, Package, Plus, ScanLine, Search, Trash2, X } from "lucide-react-native";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useStore } from "../../src/StoreProvider";
import { AppScreen, PrimaryButton, ScreenHeader, Surface } from "../../src/components/Screen";
import { persistProductPhoto } from "../../src/lib/productImages";
import { colors } from "../../src/theme";

const blankForm = () => ({ name: "", barcode: "", additionalBarcodes: [], category: "Drinks", unit: "unit", imageUrl: "", cloudImageUrl: "", costPrice: "", sellingPrice: "", stockQty: "", lowStockThreshold: "5" });
const money = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;

function ProductField({ label, value, onChangeText, placeholder, keyboardType = "default", editable = true, autoCapitalize = "sentences" }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={[styles.input, !editable && styles.readOnly]} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} editable={editable} autoCapitalize={autoCapitalize} accessibilityLabel={label.replace(" *", "")} /></View>;
}

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionIcon}><Icon size={16} color={colors.red} strokeWidth={2} /></View>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export default function ProductsScreen() {
  const { products, saveProduct, archiveProduct } = useStore();
  const params = useLocalSearchParams();
  const scannedBarcode = typeof params.barcode === "string" ? params.barcode : "";
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [barcodeDraft, setBarcodeDraft] = useState("");
  const [dismissedBarcode, setDismissedBarcode] = useState("");
  const [cameraMode, setCameraMode] = useState(null);
  const [barcodeCameraLocation, setBarcodeCameraLocation] = useState(null);
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
    const matchesQuery = `${product.name} ${product.barcodes?.join(" ") || product.barcode || ""}`.toLowerCase().includes(query.toLowerCase());
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
      barcode: product.barcode || "",
      additionalBarcodes: (product.barcodes || (product.barcode ? [product.barcode] : [])).filter((barcode) => barcode !== product.barcode),
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
    setBarcodeDraft("");
    setMode(product);
  }

  function addAdditionalBarcode(value = barcodeDraft) {
    const barcode = value.trim();
    if (!barcode) return false;
    const existing = [formValues.barcode, ...form.additionalBarcodes].filter(Boolean);
    if (existing.includes(barcode)) {
      setError("This barcode is already added to the product.");
      return false;
    }
    setForm((current) => ({ ...current, additionalBarcodes: [...current.additionalBarcodes, barcode] }));
    setBarcodeDraft("");
    setError("");
    return true;
  }

  async function startCamera(nextMode, barcodeLocation = null) {
    setError("");
    try {
      const currentPermission = permission?.granted ? permission : await requestPermission();
      if (!currentPermission.granted) {
        setError("Camera permission is needed to take product photos or scan barcodes.");
        return;
      }
      scanHandled.current = false;
      setCameraReady(false);
      setBarcodeCameraLocation(barcodeLocation);
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
    const barcode = data.trim();
    if (cameraMode === "additionalBarcode") {
      const existing = [formValues.barcode, ...form.additionalBarcodes].filter(Boolean);
      if (existing.includes(barcode)) {
        setError("This barcode is already added to the product.");
      } else {
        setForm((current) => ({ ...current, additionalBarcodes: [...current.additionalBarcodes, barcode] }));
        setError("");
      }
    } else {
      setForm((current) => ({ ...current, barcode }));
      setError("");
    }
    setCameraMode(null);
  }

  function startBarcodeCamera() {
    return startCamera(formValues.barcode.trim() ? "additionalBarcode" : "barcode", "primary");
  }

  function renderBarcodeCamera() {
    if (!cameraMode || cameraMode === "photo") return null;

    return (
      <View style={styles.cameraPanel}>
        <View style={styles.cameraPreview}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"] }}
            onBarcodeScanned={handleBarcodeScanned}
            onMountError={({ message }) => { setCameraMode(null); setError(`Camera could not start: ${message}`); }}
          />
          <View pointerEvents="none" style={styles.scannerOverlay}>
            <View style={styles.scannerTitle}>
              <ScanLine size={15} color="white" />
              <Text style={styles.scannerTitleText}>Barcode scanner</Text>
            </View>
            <View style={styles.scannerFrame}>
              <View style={[styles.scannerCorner, styles.scannerCornerTL]} />
              <View style={[styles.scannerCorner, styles.scannerCornerTR]} />
              <View style={[styles.scannerCorner, styles.scannerCornerBL]} />
              <View style={[styles.scannerCorner, styles.scannerCornerBR]} />
              <View style={styles.scannerLine} />
            </View>
            <Text style={styles.scanHint}>Align the barcode inside the frame</Text>
          </View>
        </View>
        <Pressable onPress={() => setCameraMode(null)} style={styles.cameraCancel}>
          <Text style={styles.link}>Cancel scanner</Text>
        </Pressable>
      </View>
    );
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
      {cameraMode === "photo" ? (
        <View style={styles.cameraPanel}>
          <View style={styles.cameraPreview}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              onCameraReady={() => setCameraReady(true)}
              onMountError={({ message }) => { setCameraMode(null); setError(`Camera could not start: ${message}`); }}
            />
          </View>
          <PrimaryButton title={cameraBusy ? "Saving photo…" : cameraReady ? "Capture photo" : "Opening camera…"} onPress={captureProductPhoto} disabled={cameraBusy || !cameraReady} style={styles.cameraAction} />
          <Pressable onPress={() => setCameraMode(null)} style={styles.cameraCancel}><Text style={styles.link}>Cancel camera</Text></Pressable>
        </View>
      ) : null}
    </Surface>
  );

  async function submit() {
    if (barcodeDraft.trim()) {
      setError("Tap Add barcode before saving to include the entered code.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveProduct({
        ...formValues,
        barcodes: [formValues.barcode, ...formValues.additionalBarcodes].filter(Boolean),
      }, mode && mode !== "new" && !scannedFormActive ? mode : null);
      setMode(null);
      setForm(blankForm());
      setBarcodeDraft("");
      setDismissedBarcode(scannedBarcode);
    } catch (reason) {
      setError(reason.message || "Could not save product.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct() {
    if (!editingProduct) return;
    setArchiving(true);
    setError("");
    try {
      await archiveProduct(editingProduct);
      setMode(null);
      setForm(blankForm());
      setBarcodeDraft("");
      setDismissedBarcode(scannedBarcode);
    } catch (reason) {
      setError(reason.message || "Could not delete this product.");
    } finally {
      setArchiving(false);
    }
  }

  function confirmDelete() {
    if (!editingProduct) return;
    Alert.alert(
      "Delete product?",
      `${editingProduct.name} will be removed from active inventory. Existing sales history will be kept.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete product", style: "destructive", onPress: () => { void removeProduct(); } },
      ],
    );
  }

  return (
    <AppScreen scroll={!showingForm} contentStyle={showingForm ? styles.formScreenContainer : undefined}>
      {showingForm ? (
        <KeyboardAvoidingView style={styles.formScreen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScreenHeader
            title={editingProduct ? "Edit item" : "Add an item"}
            subtitle={editingProduct ? "Update its details, price, or stock." : "Add the items you sell in your shop."}
            action={<Pressable style={styles.cancelButton} onPress={() => { setMode(null); setDismissedBarcode(scannedBarcode); setError(""); }}><ArrowLeft size={16} color={colors.red} /><Text style={styles.link}>Back</Text></Pressable>}
          />
          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.formStack}>
              {cameraControls}
              <Surface style={styles.formSection}>
                <SectionHeading icon={Package} title="Item details" subtitle="What is this item called and how do you sell it?" />
                <ProductField label="Product name *" value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="e.g. Coca Cola" />
                <ProductField label="Category" value={form.category} onChangeText={(category) => setForm({ ...form, category })} placeholder="e.g. Drinks or Snacks" />
                <ProductField label="Unit" value={form.unit} onChangeText={(unit) => setForm({ ...form, unit })} placeholder="e.g. piece, pack, kg" />
              </Surface>
              <Surface style={styles.formSection}>
                <SectionHeading icon={ScanLine} title="Barcode (optional)" subtitle="Add a barcode to find this item faster at checkout." />
                <ProductField label="Primary barcode" value={formValues.barcode} onChangeText={(barcode) => { setDismissedBarcode(scannedBarcode); setForm({ ...form, barcode }); }} placeholder="Enter or scan barcode" autoCapitalize="characters" />
                {barcodeCameraLocation === "primary" ? renderBarcodeCamera() : null}
                <Pressable style={styles.scanFieldButton} onPress={startBarcodeCamera}>
                  <ScanLine size={15} color={colors.red} strokeWidth={2} />
                  <Text style={styles.secondaryButtonText}>{formValues.barcode ? "Scan another barcode" : "Scan barcode"}</Text>
                </Pressable>
                <View style={styles.additionalBarcodeSection}>
                  <Text style={styles.label}>Additional barcodes</Text>
                  <View style={styles.barcodeInputRow}>
                    <TextInput
                      style={styles.barcodeInput}
                      value={barcodeDraft}
                      onChangeText={(value) => { setBarcodeDraft(value); setError(""); }}
                      onSubmitEditing={() => addAdditionalBarcode()}
                      placeholder="Enter another code"
                      autoCapitalize="characters"
                      returnKeyType="done"
                      accessibilityLabel="Additional product barcode"
                    />
                    <Pressable style={styles.addBarcodeButton} onPress={() => addAdditionalBarcode()} accessibilityRole="button" accessibilityLabel="Add barcode">
                      <Plus size={16} color="white" />
                    </Pressable>
                  </View>
                  {barcodeCameraLocation === "additional" ? renderBarcodeCamera() : null}
                  <Text style={styles.barcodeHint}>Every barcode identifies this same product and shares its stock count.</Text>
                  {form.additionalBarcodes.length > 0 ? (
                    <View style={styles.barcodeChips}>
                      {form.additionalBarcodes.map((barcode) => (
                        <View key={barcode} style={styles.barcodeChip}>
                          <Text style={styles.barcodeChipText}>{barcode}</Text>
                          <Pressable
                            style={styles.removeBarcode}
                            onPress={() => setForm((current) => ({ ...current, additionalBarcodes: current.additionalBarcodes.filter((item) => item !== barcode) }))}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove barcode ${barcode}`}
                          >
                            <X size={13} color={colors.muted} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <Pressable style={styles.scanAliasButton} onPress={() => startCamera("additionalBarcode", "additional")} accessibilityRole="button">
                    <ScanLine size={14} color={colors.red} />
                    <Text style={styles.secondaryButtonText}>Scan an additional barcode</Text>
                  </Pressable>
                </View>
              </Surface>
              <Surface style={styles.formSection}>
                <SectionHeading icon={CreditCard} title="Prices" subtitle="Enter what you pay and what you charge." />
                <ProductField label="Cost price (Rs)" value={form.costPrice} onChangeText={(costPrice) => setForm({ ...form, costPrice })} placeholder="0.00" keyboardType="decimal-pad" />
                <ProductField label="Selling price (Rs) *" value={form.sellingPrice} onChangeText={(sellingPrice) => setForm({ ...form, sellingPrice })} placeholder="0.00" keyboardType="decimal-pad" />
              </Surface>
              <Surface style={styles.formSection}>
                <SectionHeading icon={Package} title="Stock" subtitle="How many do you have? We can remind you when low." />
                <ProductField label={editingProduct ? "Current stock" : "Opening stock"} value={form.stockQty} onChangeText={editingProduct ? () => {} : (stockQty) => setForm({ ...form, stockQty })} placeholder="0" keyboardType="decimal-pad" editable={!editingProduct} />
                <ProductField label="Low stock alert" value={form.lowStockThreshold} onChangeText={(lowStockThreshold) => setForm({ ...form, lowStockThreshold })} placeholder="5" keyboardType="decimal-pad" />
              </Surface>
            </View>
          </ScrollView>
          <View style={styles.formAction}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PrimaryButton title={saving ? "Saving…" : editingProduct ? "Save Changes" : "Save Product"} onPress={submit} disabled={saving || archiving} />
            {editingProduct ? (
              <Pressable style={[styles.deleteButton, (saving || archiving) && styles.disabledButton]} onPress={confirmDelete} disabled={saving || archiving} accessibilityRole="button">
                <Trash2 size={16} color={colors.red} />
                <Text style={styles.deleteButtonText}>{archiving ? "Deleting…" : "Delete product"}</Text>
              </Pressable>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <ScreenHeader title="Stock" subtitle={`${products.length} items in your shop`} action={<Pressable style={styles.addButton} onPress={() => { setForm(blankForm()); setDismissedBarcode(scannedBarcode); setMode("new"); }}><Plus size={18} color="white" strokeWidth={2.5} /><Text style={styles.addText}>Add item</Text></Pressable>} />
          <View style={styles.searchBox}><Search size={18} color="#78837f" strokeWidth={2} /><TextInput value={query} onChangeText={setQuery} style={styles.search} placeholder="Find an item by name or code" accessibilityLabel="Search products" returnKeyType="search" /></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroller} contentContainerStyle={styles.categoryContent}>
            {categories.map((category) => <Pressable key={category} onPress={() => setSelectedCategory(category)} style={[styles.categoryChip, category === selectedCategory && styles.categoryChipActive]}><Text style={[styles.categoryChipText, category === selectedCategory && styles.categoryChipTextActive]}>{category}</Text></Pressable>)}
          </ScrollView>
          <View style={styles.filterRow}>
            <View style={styles.stockFilters}>{[["All", "All stock"], ["Low", "Running low"], ["Out", "Out of stock"]].map(([filter, label]) => <Pressable key={filter} onPress={() => setStockFilter(filter)} style={[styles.stockFilter, stockFilter === filter && styles.stockFilterActive]}><Text style={[styles.stockFilterText, stockFilter === filter && styles.stockFilterTextActive]}>{label}</Text></Pressable>)}</View>
            <Text style={styles.filterText}>{filtered.length} items</Text>
          </View>
          <View style={styles.productGrid}>{filtered.map((product) => {
            const stock = Number(product.stock_qty);
            const low = stock <= Number(product.low_stock_threshold);
            return <Pressable key={product.id} style={styles.productCard} onPress={() => beginEdit(product)}>
              <View style={styles.productArt}>{product.image_url ? <Image source={{ uri: product.image_url }} style={styles.productImage} /> : <Package size={28} color={colors.red} strokeWidth={1.8} />}</View>
              <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
              <Text numberOfLines={1} style={styles.muted}>{product.category}</Text>
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
  addButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 13, backgroundColor: colors.red, borderRadius: 12 },
  addText: { color: "white", fontSize: 12, fontWeight: "800" },
  searchBox: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 13 },
  search: { flex: 1, color: colors.ink, fontSize: 14 },
  categoryScroller: { flexGrow: 0, marginTop: 10 },
  categoryContent: { gap: 6, paddingVertical: 2 },
  categoryChip: { minHeight: 42, justifyContent: "center", paddingHorizontal: 14, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 21 },
  categoryChipActive: { backgroundColor: colors.red, borderColor: colors.red },
  categoryChipText: { color: "#626f6b", fontSize: 12 },
  categoryChipTextActive: { color: "white", fontWeight: "800" },
  filterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 8 },
  filterText: { color: "#78837f", fontSize: 11, fontWeight: "700" },
  stockFilters: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stockFilter: { minHeight: 40, justifyContent: "center", paddingHorizontal: 11, backgroundColor: "white", borderRadius: 20 },
  stockFilterActive: { backgroundColor: "#fff0ef" },
  stockFilterText: { color: "#626f6b", fontSize: 11, fontWeight: "700" },
  stockFilterTextActive: { color: colors.red },
  productGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 9 },
  productCard: { width: "48.5%", minHeight: 176, padding: 11, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 15 },
  productArt: { height: 90, alignItems: "center", justifyContent: "center", marginBottom: 9, overflow: "hidden", backgroundColor: "#fff0ef", borderRadius: 10 },
  productName: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  muted: { marginTop: 4, color: "#78837f", fontSize: 11 },
  price: { marginTop: 4, color: colors.red, fontSize: 13, fontWeight: "800" },
  productMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, marginTop: 4 },
  stockBadge: { color: colors.green, fontSize: 10, fontWeight: "700" },
  lowStockBadge: { color: colors.amber },
  outStockBadge: { color: colors.red },
  productImage: { width: "100%", height: "100%", resizeMode: "contain" },
  formScreenContainer: { paddingBottom: 0 },
  formScreen: { flex: 1 },
  formScroll: { flex: 1 },
  formScrollContent: { gap: 10, paddingBottom: 12 },
  formStack: { gap: 10 },
  formSection: { padding: 17 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 12 },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  sectionSubtitle: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 17 },
  formAction: { gap: 7, paddingTop: 8, paddingBottom: 8, backgroundColor: colors.background },
  cancelButton: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 5 },
  photoCard: { gap: 10, marginBottom: 0, padding: 14, backgroundColor: "white", borderColor: colors.line },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  photoPreview: { width: 78, height: 78, resizeMode: "cover", backgroundColor: "#f8f8f9", borderRadius: 10 },
  photoPlaceholder: { width: 78, height: 78, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 10 },
  photoCopy: { flex: 1, alignItems: "flex-start" },
  photoTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  photoHint: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 17 },
  secondaryButton: { minHeight: 34, justifyContent: "center", marginTop: 8, paddingHorizontal: 10, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 7 },
  secondaryButtonText: { color: colors.red, fontSize: 10, fontWeight: "800" },
  cameraPanel: { gap: 8 },
  cameraPreview: { height: 210, overflow: "hidden", backgroundColor: colors.dark, borderRadius: 9 },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "space-between", paddingVertical: 12, backgroundColor: "rgba(0,0,0,0.12)" },
  scannerTitle: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(0,0,0,0.52)", borderRadius: 16 },
  scannerTitleText: { color: "white", fontSize: 10, fontWeight: "800" },
  scannerFrame: { width: "76%", height: 72, borderWidth: 1, borderColor: "rgba(255,255,255,0.65)" },
  scannerCorner: { position: "absolute", width: 15, height: 15, borderColor: colors.red },
  scannerCornerTL: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3 },
  scannerCornerTR: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3 },
  scannerCornerBL: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3 },
  scannerCornerBR: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3 },
  scannerLine: { position: "absolute", top: "50%", left: 4, right: 4, height: 2, backgroundColor: colors.red },
  cameraAction: { marginTop: 0 },
  scanHint: { color: colors.muted, fontSize: 9, textAlign: "center" },
  cameraCancel: { alignItems: "center", paddingVertical: 5 },
  scanFieldButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, marginTop: -6, marginBottom: 8, paddingHorizontal: 10, backgroundColor: "#fff5f4", borderRadius: 7 },
  additionalBarcodeSection: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  barcodeInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barcodeInput: { flex: 1, height: 44, paddingHorizontal: 10, color: colors.ink, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 8, fontSize: 13 },
  addBarcodeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.red, borderRadius: 8 },
  barcodeHint: { marginTop: 5, color: colors.muted, fontSize: 9, lineHeight: 13 },
  barcodeChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  barcodeChip: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 9, paddingRight: 3, backgroundColor: "#f4f5f7", borderRadius: 18 },
  barcodeChipText: { color: colors.ink, fontSize: 10, fontWeight: "700" },
  removeBarcode: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  scanAliasButton: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  deleteButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: "#f0c9c7", borderRadius: 9, backgroundColor: "white" },
  disabledButton: { opacity: 0.5 },
  deleteButtonText: { color: colors.red, fontSize: 11, fontWeight: "800" },
  field: { marginBottom: 10 },
  label: { marginBottom: 5, color: "#424953", fontSize: 11, fontWeight: "700" },
  input: { height: 44, paddingHorizontal: 10, color: colors.ink, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 8, fontSize: 13 },
  readOnly: { color: colors.muted, backgroundColor: "#f5f6f7" },
  error: { marginBottom: 2, padding: 10, color: colors.red, backgroundColor: "#fff0ef", borderRadius: 8, fontSize: 10, lineHeight: 14 },
  link: { color: colors.red, fontSize: 10, fontWeight: "800" },
  empty: { gap: 12, marginTop: 12 },
  emptyText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  clearFilters: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 4 },
});
