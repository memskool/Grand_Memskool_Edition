import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClassroomSession = {
  id: string;
  class_id: string;
  host_id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
};

export type Participant = {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  hand_raised: boolean;
  mic_on: boolean;
  cam_on: boolean;
  camera_allowed: boolean;
  warned_at: string | null;
  is_host: boolean;
  profile: { full_name: string; avatar_url: string | null } | null;
};

export type ClassroomMessage = {
  id: string;
  session_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender: { full_name: string; avatar_url: string | null } | null;
};

/* ------------------------------ sessions ------------------------------ */

/**
 * Live sessions across a set of classes — powers the "LIVE now" badges so a
 * learner sees the moment their teacher opens a room.
 */
export function useLiveSessions(classIds: string[]) {
  const qc = useQueryClient();
  const key = classIds.slice().sort().join(",");

  const query = useQuery({
    queryKey: ["live-sessions", key],
    enabled: classIds.length > 0,
    refetchInterval: 20_000,
    queryFn: async (): Promise<ClassroomSession[]> => {
      const { data, error } = await supabase
        .from("classroom_sessions")
        .select("id, class_id, host_id, title, started_at, ended_at, is_active")
        .in("class_id", classIds)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as ClassroomSession[];
    },
  });

  useEffect(() => {
    if (!classIds.length) return;
    const channel = supabase
      .channel(`live-sessions-${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "classroom_sessions" },
        () => qc.invalidateQueries({ queryKey: ["live-sessions", key] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [key, classIds.length, qc]);

  return query;
}

export function useActiveSession(classId?: string) {

  return useQuery({
    queryKey: ["classroom-session", classId],
    enabled: !!classId,
    queryFn: async (): Promise<ClassroomSession | null> => {
      const { data, error } = await supabase
        .from("classroom_sessions")
        .select("id, class_id, host_id, title, started_at, ended_at, is_active")
        .eq("class_id", classId!)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { classId: string; hostId: string; title?: string }) => {
      const { data, error } = await supabase
        .from("classroom_sessions")
        .insert({ class_id: input.classId, host_id: input.hostId, title: input.title ?? null })
        .select("id, class_id, host_id, title, started_at, ended_at, is_active")
        .single();
      if (error) throw error;
      return data as ClassroomSession;
    },
    onSuccess: (s) => qc.invalidateQueries({ queryKey: ["classroom-session", s.class_id] }),
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (session: ClassroomSession) => {
      const { error } = await supabase
        .from("classroom_sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("id", session.id);
      if (error) throw error;
      await supabase
        .from("classroom_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("session_id", session.id)
        .is("left_at", null);
      return session;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["classroom-session", s.class_id] });
      qc.invalidateQueries({ queryKey: ["classroom-participants", s.id] });
    },
  });
}

/* ---------------------------- participants ---------------------------- */

const PARTICIPANT_SELECT =
  "id, session_id, user_id, joined_at, left_at, hand_raised, mic_on, cam_on, camera_allowed, warned_at, is_host, profile:profiles!classroom_participants_user_id_fkey(full_name, avatar_url)";

export function useParticipants(sessionId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["classroom-participants", sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await supabase
        .from("classroom_participants")
        .select(PARTICIPANT_SELECT)
        .eq("session_id", sessionId!)
        .order("joined_at");
      if (error) throw error;
      return (data ?? []) as unknown as Participant[];
    },
  });

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`participants-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "classroom_participants",
          filter: `session_id=eq.${sessionId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["classroom-participants", sessionId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, qc]);

  return query;
}

/** Joins the room (idempotent) — the database logs attendance automatically. */
export function useJoinRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; userId: string; isHost: boolean }) => {
      const { data, error } = await supabase
        .from("classroom_participants")
        .upsert(
          {
            session_id: input.sessionId,
            user_id: input.userId,
            is_host: input.isHost,
            joined_at: new Date().toISOString(),
            left_at: null,
          },
          { onConflict: "session_id,user_id" },
        )
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["classroom-participants", v.sessionId] }),
  });
}

export function useLeaveRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; userId: string }) => {
      const { error } = await supabase
        .from("classroom_participants")
        .update({
          left_at: new Date().toISOString(),
          hand_raised: false,
          mic_on: false,
          cam_on: false,
        })
        .eq("session_id", input.sessionId)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["classroom-participants", v.sessionId] }),
  });
}

export type ParticipantPatch = Partial<
  Pick<Participant, "hand_raised" | "mic_on" | "cam_on" | "camera_allowed" | "warned_at">
>;

export function useUpdateParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; userId: string; patch: ParticipantPatch }) => {
      const { error } = await supabase
        .from("classroom_participants")
        .update(input.patch)
        .eq("session_id", input.sessionId)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["classroom-participants", v.sessionId] }),
  });
}

/** Teacher bulk action across every learner still in the room. */
export function useBulkParticipantUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      patch: ParticipantPatch;
      exceptUserId?: string;
    }) => {
      let q = supabase
        .from("classroom_participants")
        .update(input.patch)
        .eq("session_id", input.sessionId)
        .is("left_at", null);
      if (input.exceptUserId) q = q.neq("user_id", input.exceptUserId);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["classroom-participants", v.sessionId] }),
  });
}

/* ------------------------------- chat --------------------------------- */

export function useClassroomChat(sessionId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["classroom-chat", sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<ClassroomMessage[]> => {
      const { data, error } = await supabase
        .from("classroom_messages")
        .select(
          "id, session_id, sender_id, body, created_at, sender:profiles!classroom_messages_sender_id_fkey(full_name, avatar_url)",
        )
        .eq("session_id", sessionId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as ClassroomMessage[];
    },
  });

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`classroom-chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "classroom_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["classroom-chat", sessionId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, qc]);

  return query;
}

export function useSendClassroomMessage() {
  return useMutation({
    mutationFn: async (input: { sessionId: string; senderId: string; body: string }) => {
      const { error } = await supabase
        .from("classroom_messages")
        .insert({ session_id: input.sessionId, sender_id: input.senderId, body: input.body });
      if (error) throw error;
    },
  });
}
