import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { flushNotifications } from "@/lib/notifications.functions";
import { COLLECTIONS, getById, setById } from "@/lib/firebase/repo";

export type NotificationPreferences = {
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
};

export function useNotificationPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: ["notification-preferences", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<NotificationPreferences> => {
      const byId = await getById<NotificationPreferences>(COLLECTIONS.notificationPreferences, userId!);
      return (
        byId ?? {
          user_id: userId!,
          email_enabled: true,
          sms_enabled: true,
        }
      );
    },
  });
}

export function useSaveNotificationPreferences(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { email_enabled: boolean; sms_enabled: boolean }) => {
      if (!userId) throw new Error("Not signed in");
      await setById(COLLECTIONS.notificationPreferences, userId, {
        user_id: userId,
        ...values,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-preferences", userId] }),
  });
}

export function triggerNotificationDelivery() {
  void flushNotifications().catch(() => undefined);
}
