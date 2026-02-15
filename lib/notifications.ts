import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let pushToken: string | null = null;

/**
 * Request permissions and return Expo push token for this device.
 * Returns null if not a physical device or permission denied.
 */
export async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  try {
    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID ?? undefined,
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
  handler: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
