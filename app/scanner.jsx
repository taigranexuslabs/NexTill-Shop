import { useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Plus, ScanLine, Search, X } from "lucide-react-native";
import { useStore } from "../src/StoreProvider";
import { AppScreen, ScreenHeader, Surface, PrimaryButton } from "../src/components/Screen";
import { colors } from "../src/theme";

export default function ScannerScreen() {
  const { products, addToCart } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [handled, setHandled] = useState(false);

  function lookup(code) {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setMessage("Enter a barcode or SKU to search.");
      return;
    }
    const product = products.find((item) => item.barcodes?.includes(normalizedCode) || item.barcode === normalizedCode || item.sku.toLowerCase() === normalizedCode.toLowerCase());
    if (!product) {
      setValue(code);
      setMessage("Product not found. Search your inventory or add it.");
      setHandled(true);
      return;
    }
    const result = addToCart(product);
    if (result === true) {
      router.back();
    } else {
      setMessage(result);
    }
  }

  async function startScanning() {
    try {
      const nextPermission = permission?.granted ? permission : await requestPermission();
      if (nextPermission.granted) {
        setHandled(false);
        setScanning(true);
      } else {
        setMessage("Camera permission is unavailable. You can still enter the barcode manually.");
      }
    } catch (reason) {
      setMessage(reason.message || "Could not request camera access. Enter the barcode or SKU manually.");
    }
  }

  return (
    <AppScreen>
      <ScreenHeader title="Barcode Scanner" subtitle="Align barcode inside the frame" action={<Pressable style={styles.closeButton} onPress={() => router.back()} accessibilityLabel="Close scanner"><X size={19} color={colors.ink} /></Pressable>} />
      <View style={styles.cameraBox}>
        {scanning && permission?.granted ? <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"] }}
          onBarcodeScanned={handled ? undefined : ({ data }) => lookup(data)}
        /> : <View style={styles.cameraPlaceholder}><ScanLine size={38} color="#ff625d" strokeWidth={1.7} /><Text style={styles.cameraText}>Camera scanner</Text><Text style={styles.cameraHint}>Camera access is requested only when you start scanning.</Text></View>}
        <View pointerEvents="none" style={styles.scanFrame}><View style={styles.cornerTL} /><View style={styles.cornerTR} /><View style={styles.cornerBL} /><View style={styles.cornerBR} /><View style={styles.scanLine} /></View>
      </View>
      {!scanning ? <PrimaryButton title={permission?.granted ? "Start camera scan" : "Allow camera and scan"} onPress={startScanning} style={styles.cameraButton} /> : <Pressable style={styles.stopButton} onPress={() => { setScanning(false); setHandled(false); }}><Text style={styles.stopText}>Stop scanning</Text></Pressable>}
      <Surface style={styles.manualCard}>
        <Text style={styles.manualTitle}>Enter barcode or SKU manually</Text>
        <View style={styles.searchBox}><Search size={17} color="#858c95" strokeWidth={2} /><TextInput value={value} onChangeText={(text) => { setValue(text); setMessage(""); setHandled(false); }} onSubmitEditing={() => lookup(value)} placeholder="Barcode or SKU" autoCapitalize="characters" style={styles.input} accessibilityLabel="Barcode or SKU" returnKeyType="search" /></View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <PrimaryButton title="Find product" onPress={() => lookup(value)} />
        {message.startsWith("Product not found") ? <Pressable style={styles.addProduct} onPress={() => { router.replace({ pathname: "/(tabs)/products", params: { barcode: value } }); }}><Plus size={14} color={colors.red} strokeWidth={2.5} /><Text style={styles.link}>Add this product</Text></Pressable> : null}
      </Surface>
      <Text style={styles.footnote}>If camera permission is denied, manual barcode entry remains available.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 22 },
  cameraBox: { height: 280, position: "relative", overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#191a1f", borderRadius: 16 },
  cameraPlaceholder: { alignItems: "center", paddingHorizontal: 20 },
  cameraText: { marginTop: 9, color: "white", fontSize: 12, fontWeight: "800" },
  cameraHint: { maxWidth: 230, marginTop: 5, color: "#b9bbc2", fontSize: 9, textAlign: "center", lineHeight: 14 },
  scanFrame: { position: "absolute", width: "76%", height: 115, borderColor: "rgba(255,255,255,.35)", borderWidth: 1 },
  cornerTL: { position: "absolute", top: -1, left: -1, width: 20, height: 20, borderTopColor: colors.red, borderLeftColor: colors.red, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { position: "absolute", top: -1, right: -1, width: 20, height: 20, borderTopColor: colors.red, borderRightColor: colors.red, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { position: "absolute", bottom: -1, left: -1, width: 20, height: 20, borderBottomColor: colors.red, borderLeftColor: colors.red, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { position: "absolute", bottom: -1, right: -1, width: 20, height: 20, borderBottomColor: colors.red, borderRightColor: colors.red, borderBottomWidth: 2, borderRightWidth: 2 },
  scanLine: { position: "absolute", top: "50%", left: 8, right: 8, height: 2, backgroundColor: colors.red },
  cameraButton: { marginTop: 10 },
  stopButton: { minHeight: 40, alignItems: "center", justifyContent: "center", marginTop: 10, backgroundColor: "#32353d", borderRadius: 8 },
  stopText: { color: "white", fontSize: 10, fontWeight: "700" },
  manualCard: { marginTop: 12 },
  manualTitle: { marginBottom: 9, color: colors.ink, fontSize: 11, fontWeight: "800" },
  searchBox: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 9, paddingHorizontal: 10, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 8 },
  input: { flex: 1, minHeight: 42, paddingHorizontal: 2, color: colors.ink, fontSize: 13 },
  message: { marginBottom: 8, color: colors.amber, fontSize: 9 },
  addProduct: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 6 },
  link: { color: colors.red, fontSize: 11, fontWeight: "800" },
  footnote: { marginTop: 11, color: "#8f96a0", fontSize: 8, textAlign: "center" },
});
