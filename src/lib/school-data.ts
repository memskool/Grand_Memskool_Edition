import { useQuery } from "@tanstack/react-query";
import {
  COLLECTIONS,
  countDocs,
  findMany,
  getById,
  where,
  orderBy,
  limit,
} from "@/lib/firebase/repo";
import { userSchoolId } from "@/lib/firebase/hydrate";

export type ClassRow = {
  id: string;
  name: string;
  room: string | null;
  subject: { name: string; code: string } | null;
};

type ClassDoc = {
  name: string;
  room: string | null;
  subject_id: string | null;
  teacher_id: string | null;
  school_id: string;
  status?: string;
};

type SubjectDoc = { name: string; code: string };

async function toClassRow(id: string, row: ClassDoc): Promise<ClassRow> {
  const subject = row.subject_id
    ? await getById<SubjectDoc>(COLLECTIONS.subjects, row.subject_id)
    : null;
  return {
    id,
    name: row.name,
    room: row.room,
    subject: subject ? { name: subject.name, code: subject.code } : null,
  };
}

export function useMyEnrolledClasses(userId?: string) {
  return useQuery({
    queryKey: ["enrolled-classes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const enrollments = await findMany<{ class_id: string; status?: string }>(
        COLLECTIONS.classEnrollments,
        [where("student_id", "==", userId!)],
      );
      const active = enrollments.filter((e) => e.status !== "ended");
      const classes = await Promise.all(
        active.map(async (e) => {
          const cls = await getById<ClassDoc>(COLLECTIONS.classes, e.class_id);
          return cls && cls.status !== "archived" ? toClassRow(cls.id, cls) : null;
        }),
      );
      return classes.filter((c): c is ClassRow => Boolean(c));
    },
  });
}

export function useUpcomingSlots(userId?: string) {
  return useQuery({
    queryKey: ["upcoming-slots", userId],
    enabled: !!userId,
    queryFn: async () => {
      const enrollments = await findMany<{ class_id: string; status?: string }>(
        COLLECTIONS.classEnrollments,
        [where("student_id", "==", userId!)],
      );
      const classIds = new Set(
        enrollments.filter((e) => e.status !== "ended").map((e) => e.class_id),
      );
      const slots = await findMany<{
        day_of_week: number;
        start_time: string;
        end_time: string;
        class_id: string;
      }>(COLLECTIONS.timetableSlots, [orderBy("day_of_week"), orderBy("start_time"), limit(40)]);
      const mine = slots.filter((s) => classIds.has(s.class_id)).slice(0, 6);
      return Promise.all(
        mine.map(async (s) => {
          const cls = await getById<ClassDoc>(COLLECTIONS.classes, s.class_id);
          return {
            ...s,
            class: cls ? await toClassRow(cls.id, cls) : null,
          };
        }),
      );
    },
  });
}

export function useMyAssignments(userId?: string) {
  return useQuery({
    queryKey: ["my-assignments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const enrollments = await findMany<{ class_id: string; status?: string }>(
        COLLECTIONS.classEnrollments,
        [where("student_id", "==", userId!)],
      );
      const classIds = enrollments.filter((e) => e.status !== "ended").map((e) => e.class_id);
      if (classIds.length === 0) return [];
      const rows = await findMany<{
        title: string;
        description: string | null;
        due_at: string | null;
        points: number;
        class_id: string | null;
        status?: string;
      }>(COLLECTIONS.assignments, [
        where("class_id", "in", classIds.slice(0, 30)),
        orderBy("due_at", "asc"),
      ]);
      const visible = rows.filter((a) => a.status !== "draft");
      const submissions = await findMany<{
        assignment_id: string;
        status: string;
        grade: number | null;
        student_id: string;
      }>(COLLECTIONS.submissions, [where("student_id", "==", userId)]);
      return Promise.all(
        visible.map(async (a) => {
          const cls = a.class_id ? await getById<ClassDoc>(COLLECTIONS.classes, a.class_id) : null;
          return {
            ...a,
            class: cls ? { name: cls.name } : null,
            submissions: submissions.filter((s) => s.assignment_id === a.id),
          };
        }),
      );
    },
  });
}

export function useMyLocker(userId?: string) {
  return useQuery({
    queryKey: ["locker", userId],
    enabled: !!userId,
    queryFn: async () => {
      return findMany<{
        title: string;
        kind: string;
        created_at: string;
      }>(COLLECTIONS.lockerItems, [
        where("owner_id", "==", userId!),
        orderBy("created_at", "desc"),
      ]);
    },
  });
}

export function useMyAttendance(studentId?: string) {
  return useQuery({
    queryKey: ["attendance", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const rows = await findMany<{
        date: string;
        status: string;
        student_id: string;
        class_id: string | null;
      }>(COLLECTIONS.attendance, [
        where("student_id", "==", studentId!),
        orderBy("date", "desc"),
        limit(60),
      ]);
      return Promise.all(
        rows.map(async (r) => {
          const cls = r.class_id ? await getById<ClassDoc>(COLLECTIONS.classes, r.class_id) : null;
          return { ...r, class: cls ? { name: cls.name } : null };
        }),
      );
    },
  });
}

export function useTeachingClasses(userId?: string) {
  return useQuery({
    queryKey: ["teaching-classes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const owned = await findMany<ClassDoc>(COLLECTIONS.classes, [
        where("teacher_id", "==", userId!),
      ]);
      const assigned = await findMany<{ class_id: string; status?: string }>(
        COLLECTIONS.classTeacherAssignments,
        [where("teacher_id", "==", userId!), where("status", "==", "active")],
      );
      const extra = await Promise.all(
        assigned.map((a) => getById<ClassDoc>(COLLECTIONS.classes, a.class_id)),
      );
      const byId = new Map<string, ClassDoc & { id: string }>();
      for (const row of owned) byId.set(row.id, row);
      for (const row of extra) if (row) byId.set(row.id, row);
      return Promise.all(
        [...byId.values()].filter((r) => r.status !== "archived").map((r) => toClassRow(r.id, r)),
      );
    },
  });
}

export function useTeacherTimetable(userId?: string) {
  return useQuery({
    queryKey: ["teacher-timetable", userId],
    enabled: !!userId,
    queryFn: async () => {
      const today = new Date().getDay();
      const teaching = await findMany<ClassDoc>(COLLECTIONS.classes, [
        where("teacher_id", "==", userId!),
      ]);
      const assigned = await findMany<{ class_id: string }>(COLLECTIONS.classTeacherAssignments, [
        where("teacher_id", "==", userId!),
        where("status", "==", "active"),
      ]);
      const classIds = new Set([...teaching.map((c) => c.id), ...assigned.map((a) => a.class_id)]);
      const slots = await findMany<{
        day_of_week: number;
        start_time: string;
        end_time: string;
        class_id: string;
      }>(COLLECTIONS.timetableSlots, [where("day_of_week", "==", today), orderBy("start_time")]);
      const mine = slots.filter((s) => classIds.has(s.class_id));
      return Promise.all(
        mine.map(async (s) => {
          const cls = await getById<ClassDoc>(COLLECTIONS.classes, s.class_id);
          return { ...s, class: cls ? await toClassRow(cls.id, cls) : null };
        }),
      );
    },
  });
}

export function usePendingGrading(userId?: string) {
  return useQuery({
    queryKey: ["pending-grading", userId],
    enabled: !!userId,
    queryFn: async () => {
      const teaching = await findMany<ClassDoc>(COLLECTIONS.classes, [
        where("teacher_id", "==", userId!),
      ]);
      const assigned = await findMany<{ class_id: string }>(COLLECTIONS.classTeacherAssignments, [
        where("teacher_id", "==", userId!),
        where("status", "==", "active"),
      ]);
      const classIds = [
        ...new Set([...teaching.map((c) => c.id), ...assigned.map((a) => a.class_id)]),
      ];
      if (classIds.length === 0) return [];
      const rows = await findMany<{
        status: string;
        submitted_at: string | null;
        student_id: string;
        assignment_id: string;
        grade: number | null;
        class_id?: string | null;
      }>(COLLECTIONS.submissions, [
        where("grade", "==", null),
        orderBy("submitted_at", "asc"),
        limit(40),
      ]);
      const mine = rows.filter((s) => !s.class_id || classIds.includes(s.class_id));
      return Promise.all(
        mine.slice(0, 20).map(async (s) => {
          const student = await getById<{ full_name: string }>(COLLECTIONS.users, s.student_id);
          const assignment = await getById<{ title: string; class_id: string | null }>(
            COLLECTIONS.assignments,
            s.assignment_id,
          );
          const cls = assignment?.class_id
            ? await getById<ClassDoc>(COLLECTIONS.classes, assignment.class_id)
            : null;
          return {
            ...s,
            student: student ? { full_name: student.full_name } : null,
            assignment: assignment
              ? { title: assignment.title, class: cls ? { name: cls.name } : null }
              : null,
          };
        }),
      );
    },
  });
}

export function useMyChildren(parentId?: string) {
  return useQuery({
    queryKey: ["children", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const rows = await findMany<{ student_id: string }>(COLLECTIONS.parentStudents, [
        where("parent_id", "==", parentId!),
      ]);
      return Promise.all(
        rows.map(async (r) => {
          const student = await getById<{ full_name: string; email: string | null }>(
            COLLECTIONS.users,
            r.student_id,
          );
          return {
            student_id: r.student_id,
            student: student
              ? { id: student.id, full_name: student.full_name, email: student.email }
              : null,
          };
        }),
      );
    },
  });
}

export function useChildPerformance(studentId?: string) {
  return useQuery({
    queryKey: ["child-performance", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const rows = await findMany<{
        grade: number | null;
        status: string;
        graded_at: string | null;
        assignment_id: string;
      }>(COLLECTIONS.submissions, [
        where("student_id", "==", studentId!),
        orderBy("graded_at", "desc"),
        limit(20),
      ]);
      return Promise.all(
        rows.map(async (s) => {
          const assignment = await getById<{
            title: string;
            points: number;
            class_id: string | null;
          }>(COLLECTIONS.assignments, s.assignment_id);
          const cls = assignment?.class_id
            ? await getById<ClassDoc>(COLLECTIONS.classes, assignment.class_id)
            : null;
          return {
            ...s,
            assignment: assignment
              ? {
                  title: assignment.title,
                  points: assignment.points,
                  class: cls ? { name: cls.name } : null,
                }
              : null,
          };
        }),
      );
    },
  });
}

export function useSchoolOverview(userId?: string) {
  return useQuery({
    queryKey: ["school-overview", userId],
    enabled: !!userId,
    queryFn: async () => {
      const schoolId = await userSchoolId(userId);
      if (!schoolId)
        return { people: 0, classes: 0, subjects: 0, roleCounts: {} as Record<string, number> };
      const schoolFilter = [where("school_id", "==", schoolId)];
      const [people, classes, subjects, users] = await Promise.all([
        countDocs(COLLECTIONS.users, schoolFilter),
        countDocs(COLLECTIONS.classes, schoolFilter),
        countDocs(COLLECTIONS.subjects, schoolFilter),
        findMany<{ role: string }>(COLLECTIONS.users, [...schoolFilter, limit(400)]),
      ]);
      const roleCounts: Record<string, number> = {};
      for (const r of users) {
        roleCounts[r.role] = (roleCounts[r.role] ?? 0) + 1;
      }
      return { people, classes, subjects, roleCounts };
    },
  });
}
