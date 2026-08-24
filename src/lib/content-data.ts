import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FileCategory } from "@/lib/storage";
import { removeObject } from "@/lib/storage";
import {
  COLLECTIONS,
  createDoc,
  findMany,
  getById,
  patchById,
  removeById,
  where,
  orderBy,
} from "@/lib/firebase/repo";
import { attachClassName, attachSubject, userSchoolId } from "@/lib/firebase/hydrate";

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
  subject_id?: string | null;
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
  status?: string | null;
};

export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async (): Promise<SubjectRow[]> => {
      const schoolId = await userSchoolId();
      const rows = await findMany<SubjectRow>(COLLECTIONS.subjects, [
        ...(schoolId ? [where("school_id", "==", schoolId)] : []),
        orderBy("name"),
      ]);
      return rows.map((r) => ({ id: r.id, name: r.name, code: r.code }));
    },
  });
}

export function useLockerFolders(userId?: string) {
  return useQuery({
    queryKey: ["locker-folders", userId],
    enabled: !!userId,
    queryFn: async (): Promise<LockerFolder[]> => {
      const rows = await findMany<{
        name: string;
        class_level: string | null;
        subject_id: string | null;
        created_at: string;
      }>(COLLECTIONS.lockerFolders, [
        where("owner_id", "==", userId!),
        orderBy("created_at", "desc"),
      ]);
      return Promise.all(rows.map((row) => attachSubject(row))) as Promise<LockerFolder[]>;
    },
  });
}

export function useLockerItems(userId?: string) {
  return useQuery({
    queryKey: ["locker-items", userId],
    enabled: !!userId,
    queryFn: async (): Promise<LockerItem[]> => {
      const rows = await findMany<Omit<LockerItem, "subject">>(COLLECTIONS.lockerItems, [
        where("owner_id", "==", userId!),
        orderBy("created_at", "desc"),
      ]);
      return Promise.all(rows.map((row) => attachSubject(row))) as Promise<LockerItem[]>;
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
      await createDoc(COLLECTIONS.lockerFolders, {
        ...input,
        owner_id: userId!,
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["locker-folders"] }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await removeById(COLLECTIONS.lockerFolders, id);
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
      await createDoc(COLLECTIONS.lockerItems, {
        ...input,
        owner_id: userId!,
        from_missed_work: false,
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["locker-items"] }),
  });
}

export function useUpdateLockerItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<NewLockerItem> }) => {
      await patchById(COLLECTIONS.lockerItems, id, patch);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["locker-items"] }),
  });
}

export function useDeleteLockerItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file_path }: { id: string; file_path: string | null }) => {
      if (file_path) await removeObject("locker-files", file_path).catch(() => undefined);
      await removeById(COLLECTIONS.lockerItems, id);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["locker-items"] }),
  });
}

export function useLibraryBooks() {
  return useQuery({
    queryKey: ["library-books"],
    queryFn: async (): Promise<LibraryBook[]> => {
      const schoolId = await userSchoolId();
      const rows = await findMany<Omit<LibraryBook, "subject"> & { subject_id?: string | null }>(
        COLLECTIONS.libraryBooks,
        schoolId
          ? [where("school_id", "==", schoolId), orderBy("created_at", "desc")]
          : [orderBy("created_at", "desc")],
      );
      return Promise.all(rows.map((row) => attachSubject(row))) as Promise<LibraryBook[]>;
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
      const schoolId = await userSchoolId(userId);
      await createDoc(COLLECTIONS.libraryBooks, {
        ...input,
        uploaded_by: userId!,
        school_id: schoolId,
        created_at: new Date().toISOString(),
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["library-books"] }),
  });
}

export function useDeleteLibraryBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file_path }: { id: string; file_path: string | null }) => {
      if (file_path) await removeObject("library-files", file_path).catch(() => undefined);
      await removeById(COLLECTIONS.libraryBooks, id);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["library-books"] }),
  });
}

export function useMissedWork(studentId?: string) {
  return useQuery({
    queryKey: ["missed-work", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<MissedWorkItem[]> => {
      const rows = await findMany<Omit<MissedWorkItem, "class">>(COLLECTIONS.missedWork, [
        where("student_id", "==", studentId!),
        orderBy("lesson_date", "desc"),
      ]);
      return Promise.all(rows.map((row) => attachClassName(row))) as Promise<MissedWorkItem[]>;
    },
  });
}

export function useMarkReviewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await patchById(COLLECTIONS.missedWork, id, {
        reviewed: true,
        reviewed_at: new Date().toISOString(),
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["missed-work"] }),
  });
}

export function useReleaseToLocker(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: MissedWorkItem) => {
      if (!item.reviewed) {
        throw new Error("Mark this item as reviewed before moving it to your locker.");
      }
      await createDoc(COLLECTIONS.lockerItems, {
        owner_id: userId!,
        title: item.title,
        kind: item.file_path ? "file" : item.url ? "link" : "note",
        category: item.category,
        url: item.url,
        file_path: item.file_path,
        file_name: item.file_name,
        from_missed_work: true,
        created_at: new Date().toISOString(),
      });
      await patchById(COLLECTIONS.missedWork, item.id, { released_to_locker: true });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["missed-work"] });
      void qc.invalidateQueries({ queryKey: ["locker-items"] });
    },
  });
}
