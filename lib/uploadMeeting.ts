import * as FileSystem from "expo-file-system";
import { supabase } from "./supabase";
import { getPushToken } from "./notifications";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export type UploadResult = { meetingId: string } | { error: string };

/**
 * Upload recorded audio to Supabase Storage, create meeting row, and trigger backend processing.
 * Backend will transcribe, summarize, update DB, and send push notification when ready.
 */
export async function uploadAndProcessMeeting(localUri: string): Promise<UploadResult> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return { error: "Supabase not configured" };
  }

  try {
    const fileName = `meetings/${Date.now()}-${Math.random().toString(36).slice(2)}.m4a`;
    const fileContent = await FileSystem.readAsStringAsync(localUri, {
      encoding: "base64",
    });
    const blob = base64ToBlob(fileContent, "audio/mp4");

    const { error: uploadError } = await supabase.storage.from("recordings").upload(fileName, blob, {
      contentType: "audio/mp4",
      upsert: false,
    });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { error: uploadError.message };
    }

    const { data: publicUrl } = supabase.storage.from("recordings").getPublicUrl(fileName);
    const audioUrl = publicUrl.publicUrl;

    const { data: meeting, error: insertError } = await supabase
      .from("meetings")
      .insert({
        status: "pending",
        transcript: null,
        summary: null,
        audio_path: fileName,
      })
      .select("id")
      .single();

    if (insertError || !meeting) {
      console.error("Insert error:", insertError);
      return { error: insertError?.message ?? "Failed to create meeting" };
    }

    const pushToken = await getPushToken();

    const res = await fetch(`${BACKEND_URL}/process-meeting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_url: audioUrl,
        meeting_id: meeting.id,
        push_token: pushToken ?? undefined,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Backend error:", res.status, text);
      return { meetingId: meeting.id, error: `Backend: ${res.status}` };
    }

    return { meetingId: meeting.id };
  } catch (e) {
    console.error(e);
    return { error: e instanceof Error ? e.message : "Upload failed" };
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
