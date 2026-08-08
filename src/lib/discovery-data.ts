import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { triggerNotificationDelivery } from "@/lib/notifications-data";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const SCHOOL_CATEGORIES = [
  { value: "nursery", label: "Nursery" },
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "tvet", label: "TVET" },
  { value: "university", label: "University" },
] as const;

export type SchoolCategory = (typeof SCHOOL_CATEGORIES)[number]["value"];

export const APPLICATION_STATUSES = ["pending", "under_review", "approved", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const MEETING_KINDS = [
  { value: "pta", label: "PTA" },
  { value: "agm", label: "AGM" },
  { value: "parent_teacher", label: "Parent–teacher" },
  { value: "staff", label: "Staff briefing" },
] as const;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type School = {
  id: string;
  name: string;
  category: string;
  country: string;
  city: string | null;
  description: string | null;
  website: string | null;
  logo_url: string | null;
  fees_min: number | null;
  fees_max: number | null;
  fees_currency: string;
  fees_notes: string | null;
  badges: string[];
  is_international: boolean;
  admissions_open: boolean;
  contact_email: string | null;
  created_at: string;
};

export type ApplicationDocument = { name: string; path: string | null; url: string | null };

export type SchoolApplication = {
  id: string;
  school_id: string;
  student_id: string;
  applicant_name: string;
  email: string | null;
  phone: string | null;
  class_level: string | null;
  intended_program: string | null;
  personal_statement: string | null;
  documents: ApplicationDocument[];
  status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  school: { name: string; category: string; city: string | null } | null;
};

export type StudyReminder = {
  id: string;
  title: string;
  subject_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string | null;
  remind_minutes_before: number;
  active: boolean;
  subject: { name: string; code: string } | null;
};

export type SchoolMeeting = {
  id: string;
  title: string;
  kind: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_url: string | null;
  class_id: string | null;
  created_by: string | null;
  class: { name: string } | null;
};

export type TimetableSlot = {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  class: {
    id: string;
    name: string;
    room: string | null;
    subject: { name: string; code: string } | null;
    teacher: { full_name: string } | null;
  } | null;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/* Schools                                                             */
/* ------------------------------------------------------------------ */

export function useSchools() {
  return useQuery({
    queryKey: ["schools"],
    queryFn: async (): Promise<School[]> => {
      const { data, error } = await supabase
        .from("schools")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as School[];
    },
  });
}

export function useCreateSchool(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<School> & { name: string }) => {
      const { error } = await supabase.from("schools").insert({ ...values, created_by: userId! });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schools"] }),
  });
}

export function useDeleteSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schools").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schools"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Applications                                                        */
/* ------------------------------------------------------------------ */

const APPLICATION_SELECT =
  "id, school_id, student_id, applicant_name, email, phone, class_level, intended_program, personal_statement, documents, status, review_notes, reviewed_at, created_at, school:schools(name, category, city)";

export function useMyApplications(studentId?: string) {
  return useQuery({
    queryKey: ["applications", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<SchoolApplication[]> => {
      const { data, error } = await supabase
        .from("school_applications")
        .select(APPLICATION_SELECT)
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SchoolApplication[];
    },
  });
}

export function useAllApplications(enabled: boolean) {
  return useQuery({
    queryKey: ["all-applications"],
    enabled,
    queryFn: async (): Promise<SchoolApplication[]> => {
      const { data, error } = await supabase
        .from("school_applications")
        .select(APPLICATION_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SchoolApplication[];
    },
  });
}

export type NewApplication = {
  school_id: string;
  applicant_name: string;
  email?: string | null;
  phone?: string | null;
  class_level?: string | null;
  intended_program?: string | null;
  personal_statement?: string | null;
  documents: ApplicationDocument[];
};

export function useSubmitApplication(studentId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: NewApplication) => {
      const { error } = await supabase.from("school_applications").insert({
        ...values,
        documents: values.documents as unknown as never,
        student_id: studentId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["all-applications"] });
    },
  });
}

export function useWithdrawApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("school_applications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applications"] }),
  });
}

export function useUpdateApplicationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: ApplicationStatus; notes?: string }) => {
      const { error } = await supabase
        .from("school_applications")
        .update({ status, review_notes: notes ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-applications"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      triggerNotificationDelivery();
    },
  });
}

/* ------------------------------------------------------------------ */
/* Timetable                                                           */
/* ------------------------------------------------------------------ */

const SLOT_SELECT =
  "id, class_id, day_of_week, start_time, end_time, class:classes(id, name, room, subject:subjects(name, code), teacher:profiles(full_name))";

export function useWeeklyTimetable(userId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("timetable-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "timetable_slots" }, () => {
        qc.invalidateQueries({ queryKey: ["weekly-timetable"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useQuery({
    queryKey: ["weekly-timetable", userId],
    enabled: !!userId,
    queryFn: async (): Promise<TimetableSlot[]> => {
      const { data, error } = await supabase
        .from("timetable_slots")
        .select(SLOT_SELECT)
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as unknown as TimetableSlot[];
    },
  });
}

export function useCreateTimetableSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      class_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }) => {
      const { error } = await supabase.from("timetable_slots").insert(values);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-timetable"] }),
  });
}

export function useDeleteTimetableSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timetable_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-timetable"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Study reminders                                                     */
/* ------------------------------------------------------------------ */

export function useStudyReminders(userId?: string) {
  return useQuery({
    queryKey: ["study-reminders", userId],
    enabled: !!userId,
    queryFn: async (): Promise<StudyReminder[]> => {
      const { data, error } = await supabase
        .from("study_reminders")
        .select(
          "id, title, subject_id, day_of_week, start_time, end_time, remind_minutes_before, active, subject:subjects(name, code)",
        )
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as unknown as StudyReminder[];
    },
  });
}

export function useCreateStudyReminder(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      title: string;
      subject_id: string | null;
      day_of_week: number;
      start_time: string;
      end_time: string | null;
      remind_minutes_before: number;
    }) => {
      const { error } = await supabase.from("study_reminders").insert({ ...values, user_id: userId! });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-reminders"] }),
  });
}

export function useToggleStudyReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("study_reminders").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-reminders"] }),
  });
}

export function useDeleteStudyReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-reminders"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Meetings                                                            */
/* ------------------------------------------------------------------ */

export function useMeetings() {
  return useQuery({
    queryKey: ["school-meetings"],
    queryFn: async (): Promise<SchoolMeeting[]> => {
      const { data, error } = await supabase
        .from("school_meetings")
        .select(
          "id, title, kind, description, scheduled_at, duration_minutes, location, meeting_url, class_id, created_by, class:classes(name)",
        )
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SchoolMeeting[];
    },
  });
}

export function useCreateMeeting(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      title: string;
      kind: string;
      description: string | null;
      scheduled_at: string;
      duration_minutes: number;
      location: string | null;
      meeting_url: string | null;
      class_id: string | null;
    }) => {
      const { error } = await supabase.from("school_meetings").insert({ ...values, created_by: userId! });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-meetings"] });
      triggerNotificationDelivery();
    },
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("school_meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-meetings"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export function useNotifications(userId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, userId]);

  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, kind, link, read, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
  });
}

export function useMarkNotificationRead(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
  });
}

/* ------------------------------------------------------------------ */
/* Admin helpers                                                       */
/* ------------------------------------------------------------------ */

export type StaffMember = {
  user_id: string;
  role: string;
  profile: { id: string; full_name: string; email: string | null } | null;
};

export function useStaffDirectory(enabled: boolean) {
  return useQuery({
    queryKey: ["staff-directory"],
    enabled,
    queryFn: async (): Promise<StaffMember[]> => {
      const [roles, profiles] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      if (roles.error) throw roles.error;
      if (profiles.error) throw profiles.error;
      const byId = new Map((profiles.data ?? []).map((p) => [p.id, p]));
      return (roles.data ?? []).map((r) => ({
        user_id: r.user_id,
        role: r.role as string,
        profile: byId.get(r.user_id) ?? null,
      }));
    },
  });
}

export function useAllClasses(enabled: boolean) {
  return useQuery({
    queryKey: ["all-classes"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, room, subject:subjects(name, code), teacher:profiles(id, full_name)")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { name: string; subject_id: string | null; teacher_id: string | null; room: string | null }) => {
      const { error } = await supabase.from("classes").insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-classes"] });
      qc.invalidateQueries({ queryKey: ["weekly-timetable"] });
    },
  });
}
