import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";

type MeetingDetail = {
  id: string;
  created_at: string;
  status: "pending" | "processing" | "ready" | "error";
  transcript: string | null;
  summary: string | null;
};

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Missing meeting id");
      return;
    }
    let cancelled = false;
    (async () => {
      const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!base || !anonKey) {
        if (!cancelled) setError("Supabase not configured");
        return;
      }
      try {
        const res = await fetch(
          `${base}/rest/v1/meetings?id=eq.${id}&select=id,created_at,status,transcript,summary`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
          }
        );
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        const row = Array.isArray(data) && data.length ? data[0] : null;
        if (!cancelled) {
          setMeeting(row);
          if (!row) setError("Meeting not found");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>Loading meeting…</Text>
      </View>
    );
  }

  if (error || !meeting) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Not found"}</Text>
      </View>
    );
  }

  const date = new Date(meeting.created_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.date}>{date}</Text>
      <Text style={styles.status}>Status: {meeting.status}</Text>

      {meeting.summary ? (
        <>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.body}>{meeting.summary}</Text>
        </>
      ) : null}

      {meeting.transcript ? (
        <>
          <Text style={styles.sectionTitle}>Transcript</Text>
          <Text style={styles.body}>{meeting.transcript}</Text>
        </>
      ) : meeting.status === "processing" ? (
        <Text style={styles.hint}>Transcript is being generated…</Text>
      ) : meeting.status === "pending" ? (
        <Text style={styles.hint}>Recording is being processed.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  date: { fontSize: 14, color: "#666", marginBottom: 4 },
  status: { fontSize: 14, color: "#666", marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  body: { fontSize: 16, lineHeight: 24, marginBottom: 24, color: "#333" },
  hint: { color: "#666", fontStyle: "italic" },
  error: { color: "#c53030" },
});
