import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";

type Meeting = {
  id: string;
  created_at: string;
  status: "pending" | "processing" | "ready" | "error";
  transcript?: string | null;
  summary?: string | null;
};

export default function MeetingsScreen() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!base || !anonKey) {
        setMeetings([]);
        setError("Supabase not configured. Set EXPO_PUBLIC_SUPABASE_* in .env.");
        return;
      }
      const res = await fetch(`${base}/rest/v1/meetings?order=created_at.desc&select=id,created_at,status,transcript,summary`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setMeetings(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load meetings");
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const renderItem = ({ item }: { item: Meeting }) => {
    const date = new Date(item.created_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const statusLabel =
      item.status === "ready"
        ? "Ready"
        : item.status === "processing"
          ? "Processing…"
          : item.status === "error"
            ? "Error"
            : "Pending";

    return (
      <Pressable
        style={styles.row}
        onPress={() => router.push({ pathname: "/meeting/[id]", params: { id: item.id } })}
      >
        <View style={styles.rowContent}>
          <Text style={styles.rowDate}>{date}</Text>
          <Text style={styles.rowStatus}>{statusLabel}</Text>
        </View>
        <Text style={styles.chevron} numberOfLines={1}>
          →
        </Text>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>Loading meetings…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={fetchMeetings}>
          <Text style={styles.retryLabel}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={meetings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No meetings yet</Text>
            <Text style={styles.hint}>Record a meeting from the Record tab.</Text>
          </View>
        }
        contentContainerStyle={meetings.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  main: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  rowContent: { flex: 1 },
  rowDate: { fontSize: 16, fontWeight: "500" },
  rowStatus: { fontSize: 14, color: "#666", marginTop: 2 },
  chevron: { fontSize: 18, color: "#999" },
  hint: { color: "#666", marginTop: 8 },
  error: { color: "#c53030", textAlign: "center" },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#0a7ea4",
    borderRadius: 8,
  },
  retryLabel: { color: "#fff", fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { fontSize: 18, fontWeight: "500" },
  emptyList: { flexGrow: 1 },
});
