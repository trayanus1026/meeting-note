import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  addNotificationResponseListener,
  requestNotificationPermissionsIfNeeded,
} from "../lib/notifications";

function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  router: ReturnType<typeof useRouter>,
): void {
  const data = response.notification.request.content.data as {
    meetingId?: string;
  };
  if (data?.meetingId) {
    router.push({
      pathname: "/meeting/[id]",
      params: { id: data.meetingId },
    } as never);
  }
}

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    requestNotificationPermissionsIfNeeded();
  }, []);

  // Handle notification that launched the app from cold start
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response, router);
      }
    });
  }, [router]);

  // Handle notification tap when app is already running
  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      handleNotificationResponse(response, router);
    });
    return () => sub.remove();
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="meeting/[id]" options={{ headerShown: true, title: "Meeting" }} />
    </Stack>
  );
}
