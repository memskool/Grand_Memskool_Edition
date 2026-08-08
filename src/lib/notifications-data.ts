import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { flushNotifications } from "@/lib/notifications.functions";

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
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("user_id, email_enabled, sms_enabled")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? { user_id: userId!, email_enabled: true, sms_enabled: true };
    },
  });
}

export function useSaveNotificationPreferences(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { email_enabled: boolean; sms_enabled: boolean }) => {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: userId!, ...values }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-preferences", userId] }),
  });
}

/**
 * Nudges the server to deliver queued email/SMS immediately after an action
 * that created notifications. Deliberately swallows errors — an alert that is
 * only delayed must never surface as a failed academic operation.
 */
export function triggerNotificationDelivery() {
  void flushNotifications().catch(() => undefined);
}
