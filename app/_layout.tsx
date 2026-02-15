import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { addNotificationResponseListener } from "../lib/notifications";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
        const data = response.notification.request.content.data as { meetingId?: string };
      if (data?.meetingId) {
        router.push({ pathname: "/meeting/[id]", params: { id: data.meetingId } } as never);
      }
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
