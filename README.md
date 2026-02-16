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
3. In Storage, create a **public** bucket named `recordings`.
4. In SQL Editor, run `supabase/migrations/002_storage_recordings.sql` to allow anon insert/select on the bucket. (If you get "new row violates row-level security policy" on upload, you missed this step.)
5. Copy Project URL and anon key from Settings → API.

### 2. Environment

**App (Expo)** — create `meeting-note/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_BACKEND_URL=http://YOUR_LOCAL_IP:8000
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

Use your machine’s LAN IP for `EXPO_PUBLIC_BACKEND_URL` so the device/emulator can reach the backend (e.g. `http://192.168.1.10:8000`).

**Android push (FCM)** — required for “transcript ready” push notifications on Android. If you see `Default FirebaseApp is not initialized` or `getExpoPushTokenAsync error`, add Firebase:

1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Add an Android app with package name **`com.anonymous.meetingnote`** (or your `app.config.js` `android.package`).
3. Download **google-services.json** and place it in the project root: `meeting-note/google-services.json`.
4. Rebuild the app (`npx expo prebuild --clean` then `npx expo run:android`, or your usual Android build).

See [Expo FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/) for optional EAS/Google Service Account setup (for sending pushes from EAS).

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

### 6. Using LDPlayer (or other emulator instead of Android Studio)

If you use **LDPlayer** and see `could not connect to TCP port 5554` or `emulator-5554`, that’s because Expo/ADB is still trying to use the **Android Studio emulator** (port 5554), which isn’t running. LDPlayer uses a different ADB port, so you must point ADB at LDPlayer and run with `--device`.

**Quick fix (after LDPlayer is running):**

```bash
npm run android:ldplayer
```

This resets ADB, connects to LDPlayer on port **5555**, then runs the app and lets you pick the device. If LDPlayer uses another port (**62001** or **21503**), connect manually first:

```bash
adb kill-server
adb start-server
adb connect 127.0.0.1:62001
npm run android:device
```

**Manual steps** (if you prefer):

1. **Start LDPlayer** and wait until it’s fully booted.
2. **Reset ADB**: `adb kill-server` then `adb start-server`.
3. **Connect to LDPlayer** (port is often **5555**, **62001**, or **21503**; check LDPlayer settings or title bar): `adb connect 127.0.0.1:5555`.
4. If `emulator-5554` still appears: `adb disconnect emulator-5554`.
5. **Run and pick device**: `npx expo run:android --device` (or `npm run android:device`).

### 7. Android build fails with `ld.lld: unknown file type` (Windows)

If the build fails in `react-native-reanimated` with linker errors like `ld.lld: error: unknown file type .cpp.o`, this is a known Windows issue. The project overrides `reactNativeArchitectures` to **x86_64 only** in `android/build.gradle` (via `withBackgroundAudio` plugin), so Expo CLI’s `-PreactNativeArchitectures=x86_64,arm64-v8a` is forced to x86_64. This works for LDPlayer and avoids the failing arm64-v8a build.

Run a clean prebuild and rebuild:

```bash
npx expo prebuild --clean
npx expo run:android
```

If it still fails, clear the reanimated CMake cache: delete `node_modules\react-native-reanimated\android\.cxx`, then rebuild.

For production or real arm64 devices, remove the architecture override from `plugins/withBackgroundAudio.js` and set `buildArchs: ["x86_64", "arm64-v8a"]` in `app.config.js`, then prebuild and rebuild.

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
  migrations/002_storage_recordings.sql
```

## Evaluation Notes

- **Config plugin:** Implements iOS background audio + microphone permission and Android permissions (RECORD_AUDIO, FOREGROUND_SERVICE*, POST_NOTIFICATIONS).
- **Background recording:** expo-audio with `staysActiveInBackground`; requires a dev build for reliable background behavior.
- **Notifications + deep link:** Expo Push with `meetingId` in payload; tap opens `/meeting/[id]`.
- **Backend:** Whisper for transcription, GPT-4o-mini for summary; Supabase for storage and DB; Expo Push for delivery.
