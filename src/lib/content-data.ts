import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FileCategory } from "@/lib/storage";

export const CLASS_LEVELS = [
  "Form One",
  "Form Two",
  "Form Three",
  "Form Four",
  "Form Five",
  "Form Six",
] as const;

export const LIBRARY_CATEGORIES = [
  { value: "course_material", label: "Course materials" },
  { value: "book", label: "Books" },
  { value: "research", label: "Research projects" },
] as const;

export type SubjectRow = { id: string; name: string; code: string };

export type LockerFolder = {
  id: string;
  name: string;
  class_level: string | null;
  subject_id: string | null;
  created_at: string;
  subject: { name: string; code: string } | null;
};

export type LockerItem = {
  id: string;
  title: string;
  kind: string;
  category: string;
  class_level: string | null;
  folder_id: string | null;
  subject_id: string | null;
  url: string | null;
  notes: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  from_missed_work: boolean;
  created_at: string;
  subject: { name: string; code: string } | null;
};

export type LibraryBook = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  category: string;
  class_level: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  subject: { name: string; code: string } | null;
};

export type MissedWorkItem = {
  id: string;
  title: string;
  category: string;
  lesson_date: string;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  reviewed: boolean;
  reviewed_at: string | null;
  released_to_locker: boolean;
  class_id: string | null;
  class: { name: string } | null;
};

/* ------------------------------------------------------------------ */
/* Subjects                                                            */
/* ------------------------------------------------------------------ */

export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async (): Promise<SubjectRow[]> => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, code")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Locker                                                              */
/* ------------------------------------------------------------------ */

export function useLockerFolders(userId?: string) {
  return useQuery({
    queryKey: ["locker-folders", userId],
    enabled: !!userId,
    queryFn: async (): Promise<LockerFolder[]> => {
      const { data, error } = await supabase
        .from("locker_folders")
        .select("id, name, class_level, subject_id, created_at, subject:subjects(name, code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LockerFolder[];
    },
  });
}

export function useLockerItems(userId?: string) {
  return useQuery({
    queryKey: ["locker-items", userId],
    enabled: !!userId,
    queryFn: async (): Promise<LockerItem[]> => {
      const { data, error } = await supabase
        .from("locker_items")
        .select(
          `id, title, kind, category, class_level, folder_id, subject_id, url, notes,
           file_path, file_name, file_size, mime_type, from_missed_work, created_at,
           subject:subjects(name, code)`,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LockerItem[];
    },
  });
}

export function useCreateFolder(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      subject_id: string | null;
      class_level: string | null;
    }) => {
      const { error } = await supabase
        .from("locker_folders")
        .insert({ ...input, owner_id: userId! });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["locker-folders"] }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locker_folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["locker-folders"] });
      void qc.invalidateQueries({ queryKey: ["locker-items"] });
    },
  });
}

export type NewLockerItem = {
  title: string;
  category: FileCategory;
  kind: string;
  folder_id: string | null;
  subject_id: string | null;
  class_level: string | null;
  url: string | null;
  notes: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
};

export function useCreateLockerItem(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewLockerItem) => {
      const { error } = await supabase.from("locker_items").insert({ ...input, owner_id: userId! });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["locker-items"] }),
  });
}

export function useUpdateLockerItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<NewLockerItem> }) => {
      const { error } = await supabase.from("locker_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["locker-items"] }),
  });
}

export function useDeleteLockerItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file_path }: { id: string; file_path: string | null }) => {
      if (file_path) await supabase.storage.from("locker-files").remove([file_path]);
      const { error } = await supabase.from("locker_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["locker-items"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Library                                                             */
/* ------------------------------------------------------------------ */

export function useLibraryBooks() {
  return useQuery({
    queryKey: ["library-books"],
    queryFn: async (): Promise<LibraryBook[]> => {
      const { data, error } = await supabase
        .from("library_books")
        .select(
          `id, title, author, description, category, class_level, file_path, file_name,
           file_size, mime_type, uploaded_by, created_at, subject:subjects(name, code)`,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LibraryBook[];
    },
  });
}

export type NewLibraryBook = {
  title: string;
  author: string | null;
  description: string | null;
  category: string;
  subject_id: string | null;
  class_level: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
};

export function useCreateLibraryBook(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewLibraryBook) => {
      const { error } = await supabase
        .from("library_books")
        .insert({ ...input, uploaded_by: userId! });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["library-books"] }),
  });
}

export function useDeleteLibraryBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file_path }: { id: string; file_path: string | null }) => {
      if (file_path) await supabase.storage.from("library-files").remove([file_path]);
      const { error } = await supabase.from("library_books").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["library-books"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Missed work                                                         */
/* ------------------------------------------------------------------ */

export function useMissedWork(studentId?: string) {
  return useQuery({
    queryKey: ["missed-work", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<MissedWorkItem[]> => {
      const { data, error } = await supabase
        .from("missed_work")
        .select(
          `id, title, category, lesson_date, url, file_path, file_name, reviewed,
           reviewed_at, released_to_locker, class_id, class:classes(name)`,
        )
        .eq("student_id", studentId!)
        .order("lesson_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MissedWorkItem[];
    },
  });
}

export function useMarkReviewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("missed_work")
        .update({ reviewed: true, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["missed-work"] }),
  });
}

/** Moves a reviewed missed-work item into the main locker. */
export function useReleaseToLocker(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: MissedWorkItem) => {
      if (!item.reviewed) {
        throw new Error("Mark this item as reviewed before moving it to your locker.");
      }
      const { error: insertError } = await supabase.from("locker_items").insert({
        owner_id: userId!,
        title: item.title,
        kind: item.file_path ? "file" : item.url ? "link" : "note",
        category: item.category,
        url: item.url,
        file_path: item.file_path,
        file_name: item.file_name,
        from_missed_work: true,
      });
      if (insertError) throw insertError;
      const { error } = await supabase
        .from("missed_work")
        .update({ released_to_locker: true })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["missed-work"] });
      void qc.invalidateQueries({ queryKey: ["locker-items"] });
    },
  });
}
