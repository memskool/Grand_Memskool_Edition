import { useCallback, useEffect, useState } from "react";
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
import { notifyMessageSent } from "@/lib/messaging.functions";

export type ConversationKind = "direct" | "group" | "clinic";

export type Conversation = {
  id: string;
  kind: string;
  title: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
  member_ids?: string[];
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
      const ids = [...new Set(memberships.map((m) => m.conversation_id))];
      if (!ids.length) return [];
      // Firestore `in` takes 30 ids: fetch every chunk (people with 30+ chats lost the rest).
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
      const rows = (
        await Promise.all(
          chunks.map((chunk) =>
            findMany<Conversation>(COLLECTIONS.conversations, [where(documentId(), "in", chunk)]),
          ),
        )
      ).flat();
      // Most recent activity first (updated_at moves on every message).
      rows.sort((a, b) =>
        (b.updated_at ?? b.created_at ?? "").localeCompare(a.updated_at ?? a.created_at ?? ""),
      );
      return Promise.all(
        rows.map(async (row) => {
          const memberIds = row.member_ids?.length
            ? row.member_ids
            : (
                await findMany<{ user_id: string }>(COLLECTIONS.conversationMembers, [
                  where("conversation_id", "==", row.id),
                ])
              ).map((m) => m.user_id);
          const hydrated = await Promise.all(
            [...new Set(memberIds)].map(async (memberId) => {
              const profile = await profileLite(memberId);
              return {
                user_id: memberId,
                profile: profile
                  ? { full_name: profile.full_name, avatar_url: profile.avatar_url }
                  : null,
              };
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
    // Only the latest window is live; older pages load on demand (useOlderMessages).
    const unsub = subscribeLive<Omit<Message, "sender">>(
      COLLECTIONS.messages,
      [
        where("conversation_id", "==", conversationId),
        orderBy("created_at", "desc"),
        limit(MESSAGE_WINDOW),
      ],
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

/** "Load older messages": pages back from the oldest message currently shown. */
export function useOlderMessages(conversationId: string | undefined, latestCount: number) {
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  useEffect(() => {
    setItems([]);
    setExhausted(false);
  }, [conversationId]);

  const loadMore = useCallback(
    async (oldestShown: string | null) => {
      if (!conversationId || !oldestShown || loading) return;
      setLoading(true);
      try {
        const rows = await findMany<Omit<Message, "sender">>(COLLECTIONS.messages, [
          where("conversation_id", "==", conversationId),
          where("created_at", "<", oldestShown),
          orderBy("created_at", "desc"),
          limit(MESSAGE_WINDOW),
        ]);
        const page = await Promise.all(
          rows
            .slice()
            .reverse()
            .map(async (row) => ({ ...row, sender: await profileLite(row.sender_id) })),
        );
        setItems((prev) => [...page, ...prev]);
        if (rows.length < MESSAGE_WINDOW) setExhausted(true);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, loading],
  );

  return {
    items,
    loading,
    // Older history can exist only once the live window is full.
    hasMore: !exhausted && latestCount >= MESSAGE_WINDOW,
    loadMore,
  };
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { conversationId: string; senderId: string; body: string }) => {
      const messageId = await createDoc(COLLECTIONS.messages, {
        conversation_id: input.conversationId,
        sender_id: input.senderId,
        body: input.body,
        created_at: new Date().toISOString(),
      });
      await patchById(COLLECTIONS.conversations, input.conversationId, {
        updated_at: new Date().toISOString(),
      });
      // Tell the other members (bell + web push). Best-effort: the message is already sent.
      void notifyMessageSent({ data: { message_id: messageId } }).catch(() => undefined);
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
