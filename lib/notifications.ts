import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const ANDROID_DEFAULT_CHANNEL_ID = "default";

/**
 * Ensure Android notification channel exists before requesting permission or getting token.
 * Android 13+ requires a channel before the permission prompt and getExpoPushTokenAsync.
 */
async function ensureDefaultChannelAsync(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(
      ANDROID_DEFAULT_CHANNEL_ID,
      {
        name: "Default",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: "default",
      },
    );
  }
}

let pushToken: string | null = null;

/**
 * Request notification permission early (needed on Android 13+ for notifications to show).
 * Called on app load so the system prompt appears and the user can tap "Allow" once.
 * Creates default channel first (required on Android 13+).
 */
export async function requestNotificationPermissionsIfNeeded(): Promise<void> {
  await ensureDefaultChannelAsync();
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }
}

function getProjectId(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_PROJECT_ID ??
    Constants.expoConfig?.extra?.eas?.projectId
  );
}

/**
 * Request permissions and return Expo push token for this device.
 * Returns null if permission denied or getExpoPushTokenAsync fails (e.g. Firebase not set up).
 */
export async function getPushToken(): Promise<string | null> {
  await ensureDefaultChannelAsync();
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId = getProjectId();
  if (!projectId) {
    console.warn(
      "getPushToken: EXPO_PUBLIC_PROJECT_ID or extra.eas.projectId not set",
    );
    return null;
  }

  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    pushToken = tokenResult.data;
    return pushToken;
  } catch (e) {
    console.error("getExpoPushTokenAsync error:", e);
    return null;
  }
}

export function getStoredPushToken(): string | null {
  return pushToken;
}

/**
 * Add listener for when user taps the notification. Use for deep linking to meeting.
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

const ANDROID_CHANNEL_ID = "meeting-notes";

/**
 * Show a local notification after upload (immediate feedback).
 * The backend will send a push notification when the transcript is actually ready.
 * Tap opens the meeting via addNotificationResponseListener.
 */
export async function showRecordingUploadedNotification(
  meetingId: string,
): Promise<void> {
  try {
    // Ensure we have permission before scheduling (Android 13+ requires grant)
    await ensureDefaultChannelAsync();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const { status: newStatus } =
        await Notifications.requestPermissionsAsync();
      status = newStatus;
    }
    if (status !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: "Meeting notes",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Recording uploaded",
        body: "We'll notify you when the transcript is ready. Tap to view meeting.",
        data: { meetingId },
        ...(Platform.OS === "android" && { channelId: ANDROID_CHANNEL_ID }),
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("showRecordingUploadedNotification:", e);
  }
}
