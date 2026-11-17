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
  where,
  orderBy,
  limit,
} from "@/lib/firebase/repo";
import { attachNamedUser, profileLite } from "@/lib/firebase/hydrate";
import { subscribeLive } from "@/lib/firebase/live-subscribe";

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
    return subscribeLive(COLLECTIONS.conversationMembers, [where("user_id", "==", userId)], () =>
      qc.invalidateQueries({ queryKey: ["conversations", userId] }),
    );
  }, [userId, qc]);

  return query;
}

const MESSAGE_WINDOW = 80;
const LOCAL_MESSAGE_PREFIX = "local-";

async function hydrateMessages(rows: Omit<Message, "sender">[]): Promise<Message[]> {
  const chronological = rows
    .slice()
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, MESSAGE_WINDOW)
    .reverse();
  return Promise.all(
    chronological.map(async (row) => ({ ...row, sender: await profileLite(row.sender_id) })),
  );
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
        limit(MESSAGE_WINDOW),
      ]);
      return hydrateMessages(rows);
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    let seq = 0;
    // Snapshot → cache directly (cached sender profiles); listener re-arms on errors.
    const unsub = subscribeLive<Omit<Message, "sender">>(
      COLLECTIONS.messages,
      [where("conversation_id", "==", conversationId)],
      (rows) => {
        const mine = ++seq;
        void hydrateMessages(rows).then((hydrated) => {
          if (cancelled || mine !== seq) return;
          qc.setQueryData<Message[]>(["messages", conversationId], (previous) => {
            const pending = (previous ?? []).filter(
              (m) =>
                m.id.startsWith(LOCAL_MESSAGE_PREFIX) &&
                !hydrated.some((c) => c.sender_id === m.sender_id && c.body === m.body),
            );
            return pending.length ? [...hydrated, ...pending] : hydrated;
          });
        });
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [conversationId, qc]);

  return query;
}

export function useSendMessage() {
  const qc = useQueryClient();
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
    // Optimistic: the sender's bubble appears instantly; the snapshot replaces it.
    onMutate: async (input) => {
      const localId = `${LOCAL_MESSAGE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const sender = await profileLite(input.senderId);
      qc.setQueryData<Message[]>(["messages", input.conversationId], (previous) => [
        ...(previous ?? []),
        {
          id: localId,
          conversation_id: input.conversationId,
          sender_id: input.senderId,
          body: input.body,
          created_at: new Date().toISOString(),
          sender,
        },
      ]);
      return { localId };
    },
    onError: (_error, input, context) => {
      if (!context?.localId) return;
      qc.setQueryData<Message[]>(["messages", input.conversationId], (previous) =>
        (previous ?? []).filter((m) => m.id !== context.localId),
      );
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
      // Phase 8: school-scoped people picker — global users list is denied by rules.
      const me = await getById<{ school_id?: string | null }>(COLLECTIONS.users, userId!);
      const schoolId = me?.school_id;
      if (!schoolId) return [];
      const rows = await findMany<{
        full_name: string;
        avatar_url: string | null;
        school_id?: string | null;
      }>(COLLECTIONS.users, [where("school_id", "==", schoolId), limit(80)]);
      const needle = search.trim().toLowerCase();
      return rows
        .filter((p) => p.id !== userId)
        .filter((p) => !needle || (p.full_name ?? "").toLowerCase().includes(needle))
        .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""))
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
