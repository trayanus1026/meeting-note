# In-Person Meeting Notes App

Mobile app that records in-person meetings, continues recording in the background, and delivers AI-generated transcripts via push notifications.

**User flow:** Tap record → put phone in pocket → stop when done → receive notification when transcript is ready → tap to view meeting.

## How to Run Locally

### Prerequisites

- Node 20+, npm or yarn
- Python 3.11+
- [Expo Go](https://expo.dev/go) (or dev client for background recording)
- Supabase project
- OpenAI API key

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In SQL Editor, run `supabase/migrations/001_meetings.sql`.
3. In Storage, create a **public** bucket named `recordings`. Add policies:
   - **Insert:** `anon` can insert into `recordings`.
   - **Select:** `anon` can select from `recordings` (public read for backend download).
4. Copy Project URL and anon key from Settings → API.

### 2. Environment

**App (Expo)** — create `meeting-note/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_BACKEND_URL=http://YOUR_LOCAL_IP:8000
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

Use your machine’s LAN IP for `EXPO_PUBLIC_BACKEND_URL` so the device/emulator can reach the backend (e.g. `http://192.168.1.10:8000`).

**Backend** — create `meeting-note/backend/.env`:

```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. App

```bash
cd meeting-note
npm install
npx expo start
```

Run on device/emulator (iOS/Android). For **background recording** use a **development build** (`npx expo prebuild` then run the native app); Expo Go may limit background behavior.

### 4. Backend

```bash
cd meeting-note/backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Test Flow

1. In the app: tap **Record**, wait a few seconds, tap **Stop**.
2. App uploads to Supabase Storage, creates a meeting row, and calls `POST /process-meeting`.
3. Backend downloads audio, transcribes with Whisper, summarizes with GPT-4o-mini, updates the meeting, and sends an Expo push notification.
4. When the notification arrives, tap it to open the meeting detail screen.

---

## Architecture Decisions

- **Expo Router (file-based):** Single `app/` tree with `(tabs)` and `meeting/[id]` keeps routing explicit and supports deep links (`meetingnote://meeting/<id>`).
- **Custom config plugin (`plugins/withBackgroundAudio.js`):** Centralizes native config for background audio: iOS `UIBackgroundModes` + `NSMicrophoneUsageDescription`; Android `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`. Keeps app.config clean and documents requirements.
- **expo-audio:** Single API for recording with `staysActiveInBackground`; aligns with Expo SDK 54 and the plugin.
- **Supabase:** Postgres + Storage + RLS. One table `meetings`; anon insert/select for the app, service role for backend updates. Storage bucket `recordings` for uploads; backend fetches by public URL.
- **Backend (FastAPI):** Single responsibility: `POST /process-meeting` (audio_url, meeting_id, push_token). Download → Whisper → summarize → update DB → Expo push. No auth on this endpoint (meeting_id is UUID); in production you’d tie meetings to auth and validate tokens.
- **Push + deep link:** Expo Push with `data: { meetingId }`; app listens for `notificationResponseReceived` and navigates to `/meeting/[id]`.

---

## What I’d Improve With More Time

1. **Auth:** Supabase Auth for sign-in; RLS on `meetings` by `user_id`; pass JWT or user context to backend and validate before processing.
2. **Background upload:** Queue upload when app is backgrounded so it completes even if the user leaves the app right after stopping the recording.
3. **Larger files:** Chunk audio for Whisper when >25MB (split with ffmpeg, transcribe chunks, merge text).
4. **Retries and idempotency:** Retry backend call and storage upload with backoff; idempotent processing so duplicate requests don’t double-process.
5. **Foreground service (Android):** Ensure expo-audio’s foreground service is declared with `foregroundServiceType="microphone"` in the built app; if not, extend the config plugin to inject it.
6. **Testing:** Unit tests for backend pipeline; E2E for “record → stop → see meeting” and “tap notification → open meeting”.
7. **Offline:** Persist “pending upload” recordings and sync when back online.

---

## Project Structure

```
/app
  /(tabs)          — tab navigation
    index.tsx      — home / recording screen
    meetings.tsx   — meetings list
  meeting/[id].tsx — meeting detail (deep link target)
  _layout.tsx      — root stack + notification deep link
/plugins
  withBackgroundAudio.js — custom Expo config plugin
/backend
  main.py          — FastAPI: POST /process-meeting
  requirements.txt
/supabase
  migrations/001_meetings.sql
```

## Evaluation Notes

- **Config plugin:** Implements iOS background audio + microphone permission and Android permissions (RECORD_AUDIO, FOREGROUND_SERVICE*, POST_NOTIFICATIONS).
- **Background recording:** expo-audio with `staysActiveInBackground`; requires a dev build for reliable background behavior.
- **Notifications + deep link:** Expo Push with `meetingId` in payload; tap opens `/meeting/[id]`.
- **Backend:** Whisper for transcription, GPT-4o-mini for summary; Supabase for storage and DB; Expo Push for delivery.
