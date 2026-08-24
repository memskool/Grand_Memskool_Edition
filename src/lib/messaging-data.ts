import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  COLLECTIONS,
  createDoc,
  documentId,
  findMany,
  findOne,
  getById,
  patchById,
  removeById,
  setById,
  subscribeMany,
  where,
  orderBy,
  limit,
} from "@/lib/firebase/repo";
import { attachNamedUser } from "@/lib/firebase/hydrate";

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

export function useMyConversations(userId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["conversations", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Conversation[]> => {
      const memberships = await findMany<{ conversation_id: string }>(
        COLLECTIONS.conversationMembers,
        [where("user_id", "==", userId!)],
      );
      const ids = memberships.map((m) => m.conversation_id);
      if (!ids.length) return [];
      const rows = await findMany<Conversation>(COLLECTIONS.conversations, [
        where(documentId(), "in", ids.slice(0, 30)),
      ]);
      rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      return Promise.all(
        rows.map(async (row) => {
          const members = await findMany<{ user_id: string }>(COLLECTIONS.conversationMembers, [
            where("conversation_id", "==", row.id),
          ]);
          const hydrated = await Promise.all(
            members.map(async (m) => {
              const withProfile = await attachNamedUser(m, m.user_id, "profile");
              return { user_id: m.user_id, profile: withProfile.profile };
            }),
          );
          return { ...row, members: hydrated };
        }),
      );
    },
  });

  useEffect(() => {
    if (!userId) return;
    return subscribeMany(COLLECTIONS.conversationMembers, [where("user_id", "==", userId)], () =>
      qc.invalidateQueries({ queryKey: ["conversations", userId] }),
    );
  }, [userId, qc]);

  return query;
}

export function useMessages(conversationId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<Message[]> => {
      const rows = await findMany<Omit<Message, "sender">>(COLLECTIONS.messages, [
        where("conversation_id", "==", conversationId!),
        orderBy("created_at", "desc"),
        limit(80),
      ]);
      const chronological = rows.slice().reverse();
      return Promise.all(
        chronological.map((row) => attachNamedUser(row, row.sender_id, "sender")),
      ) as Promise<Message[]>;
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    return subscribeMany(
      COLLECTIONS.messages,
      [where("conversation_id", "==", conversationId)],
      () => qc.invalidateQueries({ queryKey: ["messages", conversationId] }),
    );
  }, [conversationId, qc]);

  return query;
}

export function useSendMessage() {
  return useMutation({
    mutationFn: async (input: { conversationId: string; senderId: string; body: string }) => {
      await createDoc(COLLECTIONS.messages, {
        conversation_id: input.conversationId,
        sender_id: input.senderId,
        body: input.body,
        created_at: new Date().toISOString(),
      });
      await patchById(COLLECTIONS.conversations, input.conversationId, {
        updated_at: new Date().toISOString(),
      });
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
      const createdAt = new Date().toISOString();
      const members = Array.from(new Set([input.creatorId, ...input.memberIds])).slice(0, 20);
      const id = await createDoc(COLLECTIONS.conversations, {
        kind: input.kind,
        title: input.title ?? null,
        created_by: input.creatorId,
        member_ids: members,
        created_at: createdAt,
        updated_at: createdAt,
      });
      await Promise.all(
        members.map((user_id) =>
          setById(COLLECTIONS.conversationMembers, `${id}_${user_id}`, {
            conversation_id: id,
            user_id,
          }),
        ),
      );
      return id;
    },
    onSuccess: (_id, v) => qc.invalidateQueries({ queryKey: ["conversations", v.creatorId] }),
  });
}

export function useDirectory(userId?: string, search = "") {
  return useQuery({
    queryKey: ["directory", userId, search],
    enabled: !!userId,
    queryFn: async () => {
      const rows = await findMany<{ full_name: string; avatar_url: string | null }>(
        COLLECTIONS.users,
        [orderBy("full_name"), limit(50)],
      );
      const needle = search.trim().toLowerCase();
      return rows
        .filter((p) => p.id !== userId)
        .filter((p) => !needle || p.full_name.toLowerCase().includes(needle))
        .slice(0, 25)
        .map((p) => ({ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url }));
    },
  });
}

export function useUserRelations(userId?: string) {
  return useQuery({
    queryKey: ["user-relations", userId],
    enabled: !!userId,
    queryFn: async () => {
      const rows = await findMany<{ target_id: string; relation: RelationKind }>(
        COLLECTIONS.userRelations,
        [where("user_id", "==", userId!)],
      );
      return Promise.all(
        rows.map(async (row) => {
          const withProfile = await attachNamedUser(row, row.target_id, "profile");
          return {
            id: row.id,
            target_id: row.target_id,
            relation: row.relation,
            profile: withProfile.profile,
          };
        }),
      );
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
      const existing = await findOne<{ id: string }>(COLLECTIONS.userRelations, [
        where("user_id", "==", input.userId),
        where("target_id", "==", input.targetId),
        where("relation", "==", input.relation),
      ]);
      if (input.enabled) {
        if (existing) return;
        await createDoc(COLLECTIONS.userRelations, {
          user_id: input.userId,
          target_id: input.targetId,
          relation: input.relation,
        });
      } else if (existing) {
        await removeById(COLLECTIONS.userRelations, existing.id);
      }
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["user-relations", v.userId] }),
  });
}
