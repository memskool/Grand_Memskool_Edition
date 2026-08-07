import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export type ClassRow = {
  id: string;
  name: string;
  room: string | null;
  subject: { name: string; code: string } | null;
};

const CLASS_SELECT = "id, name, room, subject:subjects(name, code)";

/* ------------------------------------------------------------------ */
/* Student                                                             */
/* ------------------------------------------------------------------ */

export function useMyEnrolledClasses(userId?: string) {
  return useQuery({
    queryKey: ["enrolled-classes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_enrollments")
        .select(`class:classes(${CLASS_SELECT})`)
        .eq("student_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.class).filter(Boolean) as unknown as ClassRow[];
    },
  });
}

export function useUpcomingSlots(userId?: string) {
  return useQuery({
    queryKey: ["upcoming-slots", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_slots")
        .select(`id, day_of_week, start_time, end_time, class:classes(${CLASS_SELECT})`)
        .order("day_of_week")
        .order("start_time")
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyAssignments(userId?: string) {
  return useQuery({
    queryKey: ["my-assignments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select(
          `id, title, due_at, points, class:classes(name),
           submissions(id, status, grade, student_id)`,
        )
        .order("due_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyLocker(userId?: string) {
  return useQuery({
    queryKey: ["locker", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locker_items")
        .select("id, title, kind, url, notes, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyAttendance(studentId?: string) {
  return useQuery({
    queryKey: ["attendance", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, date, status, student_id, class:classes(name)")
        .eq("student_id", studentId!)
        .order("date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Teacher                                                             */
/* ------------------------------------------------------------------ */

export function useTeachingClasses(userId?: string) {
  return useQuery({
    queryKey: ["teaching-classes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(CLASS_SELECT)
        .eq("teacher_id", userId!);
      if (error) throw error;
      return (data ?? []) as unknown as ClassRow[];
    },
  });
}

export function useTeacherTimetable(userId?: string) {
  return useQuery({
    queryKey: ["teacher-timetable", userId],
    enabled: !!userId,
    queryFn: async () => {
      const today = new Date().getDay();
      const { data, error } = await supabase
        .from("timetable_slots")
        .select(`id, day_of_week, start_time, end_time, class:classes(${CLASS_SELECT})`)
        .eq("day_of_week", today)
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePendingGrading(userId?: string) {
  return useQuery({
    queryKey: ["pending-grading", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, status, submitted_at, student:profiles(full_name), assignment:assignments(title, class:classes(name))",
        )
        .is("grade", null)
        .order("submitted_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Parent                                                              */
/* ------------------------------------------------------------------ */

export function useMyChildren(parentId?: string) {
  return useQuery({
    queryKey: ["children", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parent_students")
        .select("student_id, student:profiles!parent_students_student_profile_fkey(id, full_name, email)")
        .eq("parent_id", parentId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useChildPerformance(studentId?: string) {
  return useQuery({
    queryKey: ["child-performance", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, grade, status, graded_at, assignment:assignments(title, points, class:classes(name))")
        .eq("student_id", studentId!)
        .order("graded_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export function useSchoolOverview(enabled: boolean) {
  return useQuery({
    queryKey: ["school-overview"],
    enabled,
    queryFn: async () => {
      const [people, classes, subjects, roles] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("role"),
      ]);
      const roleCounts: Record<string, number> = {};
      for (const r of roles.data ?? []) {
        roleCounts[r.role] = (roleCounts[r.role] ?? 0) + 1;
      }
      return {
        people: people.count ?? 0,
        classes: classes.count ?? 0,
        subjects: subjects.count ?? 0,
        roleCounts,
      };
    },
  });
}
