import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { classifyFirebase } from "@/lib/errors/app-error";
import type { AiIntent } from "@/types/ai";
import {
  deleteAiConversation,
  deleteAiMemory,
  listAiConversations,
  listAiMemory,
  listAiMessages,
  renameAiConversation,
  saveAiMemory,
  sendTutorTurn,
} from "./gateway.functions";

export function useAiConversations(enabled: boolean) {
  return useQuery({
    queryKey: ["ai-conversations"],
    enabled,
    queryFn: () => listAiConversations(),
  });
}

export function useAiMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["ai-messages", conversationId],
    enabled: !!conversationId,
    queryFn: () => listAiMessages({ data: { conversation_id: conversationId! } }),
  });
}

export function useSendTutorTurn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      intent: AiIntent;
      message: string;
      conversation_id: string | null;
      subject_id: string | null;
      lesson_id: string | null;
      assignment_id: string | null;
      missed_work_id: string | null;
      topic_id: string | null;
      image_path: string | null;
    }) => {
      try {
        return await sendTutorTurn({ data: input });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      qc.invalidateQueries({ queryKey: ["ai-messages", res.conversation_id] });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversation_id: string) => {
      try {
        return await deleteAiConversation({ data: { conversation_id } });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-conversations"] }),
  });
}

export function useRenameConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { conversation_id: string; title: string }) => {
      try {
        return await renameAiConversation({ data: input });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-conversations"] }),
  });
}

export function useAiMemory(enabled: boolean) {
  return useQuery({
    queryKey: ["ai-memory"],
    enabled,
    queryFn: () => listAiMemory(),
  });
}

export function useSaveMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: "struggle" | "goal" | "summary" | "preference" | "topic";
      topic: string | null;
      body: string;
    }) => {
      try {
        return await saveAiMemory({ data: input });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-memory"] }),
  });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await deleteAiMemory({ data: { id } });
      } catch (error) {
        throw classifyFirebase(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-memory"] }),
  });
}
