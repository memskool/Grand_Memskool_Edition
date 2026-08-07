import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ConversationKind = "direct" | "group" | "clinic";

export type Conversation = {
  id: string;
  kind: string;
  title: string | null;
  created_by: string | null;
  created_at: string;
  members: { user_id: string; profile: { full_name: string; avatar_url: string | null } | null }[];
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender: { full_name: string; avatar_url: string | null } | null;
};

export type RelationKind = "mute" | "block";

/* --------------------------- conversations ---------------------------- */

export function useMyConversations(userId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["conversations", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Conversation[]> => {
      const { data: memberships, error: mErr } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", userId!);
      if (mErr) throw mErr;
      const ids = (memberships ?? []).map((m) => m.conversation_id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id, kind, title, created_by, created_at, members:conversation_members(user_id, profile:profiles!conversation_members_user_id_fkey(full_name, avatar_url))",
        )
        .in("id", ids)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Conversation[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`conversations-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations", userId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return query;
}

export function useMessages(conversationId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, conversation_id, sender_id, body, created_at, sender:profiles!messages_sender_id_fkey(full_name, avatar_url)",
        )
        .eq("conversation_id", conversationId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Message[];
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", conversationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  return query;
}

export function useSendMessage() {
  return useMutation({
    mutationFn: async (input: { conversationId: string; senderId: string; body: string }) => {
      const { error } = await supabase
        .from("messages")
        .insert({ conversation_id: input.conversationId, sender_id: input.senderId, body: input.body });
      if (error) throw error;
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", input.conversationId);
    },
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      creatorId: string;
      kind: ConversationKind;
      title?: string | null;
      memberIds: string[];
    }) => {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ kind: input.kind, title: input.title ?? null, created_by: input.creatorId })
        .select("id")
        .single();
      if (error) throw error;
      const members = Array.from(new Set([input.creatorId, ...input.memberIds])).map((user_id) => ({
        conversation_id: data.id,
        user_id,
      }));
      const { error: mErr } = await supabase.from("conversation_members").insert(members);
      if (mErr) throw mErr;
      return data.id;
    },
    onSuccess: (_id, v) => qc.invalidateQueries({ queryKey: ["conversations", v.creatorId] }),
  });
}

/* ------------------------------ directory ----------------------------- */

export function useDirectory(userId?: string, search = "") {
  return useQuery({
    queryKey: ["directory", userId, search],
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, full_name, avatar_url").neq("id", userId!).limit(25);
      if (search.trim()) q = q.ilike("full_name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* --------------------------- mutes and blocks ------------------------- */

export function useUserRelations(userId?: string) {
  return useQuery({
    queryKey: ["user-relations", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_relations")
        .select("id, target_id, relation, profile:profiles!user_relations_target_id_fkey(full_name, avatar_url)")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        target_id: string;
        relation: RelationKind;
        profile: { full_name: string; avatar_url: string | null } | null;
      }[];
    },
  });
}

export function useSetRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      targetId: string;
      relation: RelationKind;
      enabled: boolean;
    }) => {
      if (input.enabled) {
        const { error } = await supabase
          .from("user_relations")
          .upsert(
            { user_id: input.userId, target_id: input.targetId, relation: input.relation },
            { onConflict: "user_id,target_id,relation" },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_relations")
          .delete()
          .eq("user_id", input.userId)
          .eq("target_id", input.targetId)
          .eq("relation", input.relation);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["user-relations", v.userId] }),
  });
}
