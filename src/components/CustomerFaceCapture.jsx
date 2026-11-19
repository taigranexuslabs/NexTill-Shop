import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TurboModuleRegistry, View } from "react-native";
import { colors } from "../theme";

export default function CustomerFaceCapture({ onCaptured, onCancel }) {
  const [CameraCapture, setCameraCapture] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!TurboModuleRegistry.get("NitroModules")) {
          throw new Error("This app install is missing the native camera modules. Rebuild and reinstall the development build; Expo Go cannot run face capture.");
        }
        return import("./CustomerFaceCaptureCamera");
      })
      .then((module) => {
        if (active) setCameraCapture(() => module.default);
      })
      .catch((reason) => {
        if (active) setLoadError(reason.message || "Face capture is not available in this app build.");
      });
    return () => { active = false; };
  }, []);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        {CameraCapture ? <CameraCapture onCaptured={onCaptured} onCancel={onCancel} /> : (
          <View style={styles.panel}>
            <Text style={styles.title}>{loadError ? "Face capture unavailable" : "Preparing face camera…"}</Text>
            <Text style={styles.message}>
              {loadError
                ? loadError
                : "Starting on-device face detection."}
            </Text>
            <Pressable style={styles.skipButton} onPress={onCancel}>
              <Text style={styles.skipText}>Skip photo</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: 14, backgroundColor: "rgba(14,16,20,.72)" },
  panel: { padding: 18, backgroundColor: colors.background, borderRadius: 16 },
  title: { color: colors.ink, fontSize: 15, fontWeight: "900", textAlign: "center" },
  message: { marginTop: 9, color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: "center" },
  skipButton: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 8 },
  skipText: { color: colors.red, fontSize: 10, fontWeight: "800" },
});
