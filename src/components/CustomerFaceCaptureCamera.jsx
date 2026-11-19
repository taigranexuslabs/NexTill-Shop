import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCameraDevice, useCameraPermission, usePhotoOutput } from "react-native-vision-camera";
import { Camera as FaceCamera } from "react-native-vision-camera-face-detector";
import { X } from "lucide-react-native";
import { persistCustomerPhoto } from "../lib/customerPhotos";
import { colors } from "../theme";

const alignmentDuration = 850;
const FaceDetectorCamera = memo(FaceCamera);

export default function CustomerFaceCaptureCamera({ onCaptured, onCancel }) {
  const camera = useRef(null);
  const cameraReady = useRef(false);
  const cameraSize = useRef({ width: 0, height: 0 });
  const alignmentStartedAt = useRef(null);
  const captureInProgress = useRef(false);
  const guidanceRef = useRef("");
  const [guidance, setGuidance] = useState("Center one face inside the guide.");
  const [capturing, setCapturing] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("front");
  const photoOutput = usePhotoOutput({ containerFormat: "jpeg", quality: 0.8 });
  const outputs = useMemo(() => [photoOutput], [photoOutput]);

  const updateGuidance = useCallback((nextGuidance) => {
    if (guidanceRef.current === nextGuidance) return;
    guidanceRef.current = nextGuidance;
    setGuidance(nextGuidance);
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!camera.current || !cameraReady.current || captureInProgress.current) return;
    captureInProgress.current = true;
    setCapturing(true);
    updateGuidance("Capturing photo…");
    try {
      const photo = await photoOutput.capturePhotoToFile(
        { enableShutterSound: true },
        {},
      );
      const uri = photo.filePath.startsWith("file://") ? photo.filePath : `file://${photo.filePath}`;
      const savedUri = await persistCustomerPhoto(uri);
      onCaptured(savedUri);
    } catch (reason) {
      captureInProgress.current = false;
      setCapturing(false);
      alignmentStartedAt.current = null;
      updateGuidance(reason.message || "Could not capture the face photo. Please try again.");
    }
  }, [onCaptured, photoOutput, updateGuidance]);

  const handleFacesDetected = useCallback((faces) => {
    const size = cameraSize.current;
    if (faces.length !== 1 || size.width <= 0 || size.height <= 0) {
      alignmentStartedAt.current = null;
      updateGuidance(faces.length > 1
        ? "Keep only the customer inside the camera frame."
        : "Center one face inside the guide.");
      return;
    }

    const { bounds } = faces[0];
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const insideGuide = centerX >= size.width * 0.2
      && centerX <= size.width * 0.8
      && centerY >= size.height * 0.17
      && centerY <= size.height * 0.83
      && bounds.width <= size.width * 0.6
      && bounds.height <= size.height * 0.72;

    if (!insideGuide) {
      alignmentStartedAt.current = null;
      updateGuidance("Move the face into the guide and hold still.");
      return;
    }

    if (alignmentStartedAt.current === null) {
      alignmentStartedAt.current = Date.now();
      updateGuidance("Hold still…");
      return;
    }

    if (Date.now() - alignmentStartedAt.current >= alignmentDuration) {
      alignmentStartedAt.current = null;
      void capturePhoto();
    }
  }, [capturePhoto, updateGuidance]);

  const handleLayout = useCallback(({ nativeEvent }) => {
    cameraSize.current = {
      width: nativeEvent.layout.width,
      height: nativeEvent.layout.height,
    };
  }, []);

  const handlePreviewStarted = useCallback(() => {
    cameraReady.current = true;
  }, []);

  const handleCameraError = useCallback((reason) => {
    alignmentStartedAt.current = null;
    updateGuidance(reason.message || "Face detection stopped. Check the camera and try again.");
  }, [updateGuidance]);

  async function allowCamera() {
    setPermissionError("");
    try {
      const granted = await requestPermission();
      if (!granted) setPermissionError("Camera access is needed for face capture.");
    } catch (reason) {
      setPermissionError(reason.message || "Could not request camera access.");
    }
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Optional customer photo</Text>
          <Text style={styles.subtitle}>Face detection is on-device and does not identify anyone.</Text>
        </View>
        <Pressable style={styles.close} onPress={onCancel} disabled={capturing} accessibilityLabel="Skip face photo">
          <X size={18} color={colors.ink} />
        </Pressable>
      </View>
      {hasPermission && device ? (
        <View style={styles.preview} onLayout={handleLayout}>
          <FaceDetectorCamera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            cameraFacing="front"
            outputs={outputs}
            autoMode
            performanceMode="fast"
            runClassifications={false}
            runContours={false}
            runLandmarks={false}
            onPreviewStarted={handlePreviewStarted}
            onFacesDetected={handleFacesDetected}
            onError={handleCameraError}
          />
          <View pointerEvents="none" style={styles.guide}>
            <View style={styles.guideCornerTopLeft} />
            <View style={styles.guideCornerTopRight} />
            <View style={styles.guideCornerBottomLeft} />
            <View style={styles.guideCornerBottomRight} />
          </View>
          <View pointerEvents="none" style={styles.cameraLabel}>
            <Text style={styles.guidance}>{capturing ? "Saving photo…" : guidance}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.permission}>
          <Text style={styles.permissionText}>
            {hasPermission ? "No front-facing camera is available on this device." : "Allow camera access to enable automatic face capture."}
          </Text>
          {permissionError ? <Text style={styles.error}>{permissionError}</Text> : null}
          {!hasPermission ? (
            <Pressable style={styles.allowButton} onPress={allowCamera}>
              <Text style={styles.allowText}>Allow camera</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <Text style={styles.privacy}>The photo is optional, saved on this device, and can be removed before completing the sale.</Text>
      <Pressable style={styles.skipButton} onPress={onCancel} disabled={capturing}>
        <Text style={styles.skipText}>Skip photo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 14, backgroundColor: colors.background, borderRadius: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 11 },
  headerCopy: { flex: 1 },
  title: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 9, lineHeight: 14 },
  close: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 18 },
  preview: { height: 420, position: "relative", overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: colors.dark, borderRadius: 11 },
  guide: { position: "absolute", width: "64%", height: "64%", borderWidth: 1, borderColor: "rgba(255,255,255,.55)", borderRadius: 22 },
  guideCornerTopLeft: { position: "absolute", top: -1, left: -1, width: 22, height: 22, borderTopColor: colors.red, borderLeftColor: colors.red, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 },
  guideCornerTopRight: { position: "absolute", top: -1, right: -1, width: 22, height: 22, borderTopColor: colors.red, borderRightColor: colors.red, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 },
  guideCornerBottomLeft: { position: "absolute", bottom: -1, left: -1, width: 22, height: 22, borderBottomColor: colors.red, borderLeftColor: colors.red, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 },
  guideCornerBottomRight: { position: "absolute", right: -1, bottom: -1, width: 22, height: 22, borderBottomColor: colors.red, borderRightColor: colors.red, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 },
  cameraLabel: { position: "absolute", right: 8, bottom: 8, left: 8, alignItems: "center", paddingVertical: 8, backgroundColor: "rgba(0,0,0,.62)", borderRadius: 8 },
  guidance: { color: "white", fontSize: 10, fontWeight: "700", textAlign: "center" },
  permission: { minHeight: 250, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, backgroundColor: colors.dark, borderRadius: 11 },
  permissionText: { color: "white", fontSize: 11, lineHeight: 17, textAlign: "center" },
  allowButton: { minHeight: 42, justifyContent: "center", marginTop: 14, paddingHorizontal: 15, backgroundColor: colors.red, borderRadius: 8 },
  allowText: { color: "white", fontSize: 10, fontWeight: "800" },
  error: { marginTop: 9, color: "#ffc4c1", fontSize: 9, textAlign: "center" },
  privacy: { marginTop: 9, color: colors.muted, fontSize: 9, lineHeight: 13, textAlign: "center" },
  skipButton: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 3 },
  skipText: { color: colors.red, fontSize: 10, fontWeight: "800" },
});
