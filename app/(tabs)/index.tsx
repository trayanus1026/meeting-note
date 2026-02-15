import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  setAudioModeAsync,
  AudioModule,
} from "expo-audio";
import { uploadAndProcessMeeting } from "../../lib/uploadMeeting";

export default function RecordScreen() {
  const router = useRouter();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const requestPermissions = useCallback(async () => {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    setPermissionGranted(granted);
    if (!granted) {
      Alert.alert(
        "Microphone access required",
        "Please enable microphone access in Settings to record meetings."
      );
    }
    return granted;
  }, []);

  useEffect(() => {
    (async () => {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionGranted(granted);

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'duckOthers', // duck others
      });
    })();
  }, []);

  const startRecording = useCallback(async () => {
    if (permissionGranted === false) {
      const ok = await requestPermissions();
      if (!ok) return;
    }
    try {
      setIsPreparing(true);
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not start recording. Please try again.");
    } finally {
      setIsPreparing(false);
    }
  }, [audioRecorder, permissionGranted, requestPermissions]);

  const stopRecording = useCallback(async () => {
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) {
        Alert.alert("Error", "No recording file. Please try again.");
        return;
      }
      setUploading(true);
      const result = await uploadAndProcessMeeting(uri);
      setUploading(false);
      if ("meetingId" in result) {
        router.push({ pathname: "/meeting/[id]", params: { id: result.meetingId } } as never);
      } else {
        Alert.alert("Upload failed", result.error);
      }
    } catch (e) {
      console.error(e);
      setUploading(false);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  }, [audioRecorder, router]);

  if (permissionGranted === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>Checking microphone permission…</Text>
      </View>
    );
  }

  const isRecording = recorderState?.isRecording ?? false;
  const durationSec = recorderState?.durationMillis != null ? recorderState.durationMillis / 1000 : 0;
  const durationStr = `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, "0")}`;
  const busy = isPreparing || uploading;

  return (
    <View style={styles.container}>
      <View style={styles.main}>
        <Text style={styles.title}>
          {uploading ? "Uploading…" : isRecording ? "Recording…" : "Tap to start recording"}
        </Text>
        {isRecording && (
          <Text style={styles.duration}>{durationStr}</Text>
        )}
        <Text style={styles.hint}>
          {uploading
            ? "Your recording is being uploaded. You'll get a notification when the transcript is ready."
            : isRecording
              ? "You can lock the screen or switch apps. Recording continues in the background."
              : "Put your phone in your pocket and record the meeting. Stop when done."}
        </Text>
      </View>

      <Pressable
        style={[
          styles.button,
          isRecording && styles.buttonStop,
          busy && styles.buttonDisabled,
        ]}
        onPress={isRecording ? stopRecording : startRecording}
        disabled={busy}
      >
        <Text style={styles.buttonLabel}>
          {isPreparing ? "Preparing…" : uploading ? "Uploading…" : isRecording ? "Stop" : "Record"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  main: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  duration: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 16,
    fontVariant: ["tabular-nums"],
  },
  hint: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonStop: {
    backgroundColor: "#c53030",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
