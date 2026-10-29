import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { triggerNotificationDelivery } from "@/lib/notifications-data";
import {
  COLLECTIONS,
  createDoc,
  findMany,
  getById,
  patchById,
  setById,
  removeById,
  subscribeMany,
  where,
  orderBy,
  limit,
} from "@/lib/firebase/repo";
import {
  attachClassName,
  attachSubject,
  attachNamedUser,
  userSchoolId,
} from "@/lib/firebase/hydrate";
import {
  deleteDigitalSchool,
  listDirectorySchools,
  registerDigitalSchool,
} from "@/lib/school-register.functions";
import { listSchoolApplications, reviewSchoolApplication } from "@/lib/applications.functions";
import { refreshAuthClaims } from "@/features/auth/services/auth.service";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { seedSessionAfterSignup } from "@/features/auth/seed-session";
import { writeCachedSchool } from "@/features/auth/account-cache";
import type { AppRole } from "@/types/roles";

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

async function hydrateApplication(
  row: Omit<SchoolApplication, "school">,
): Promise<SchoolApplication> {
  const school = await getById<{ name: string; category: string; city: string | null }>(
    COLLECTIONS.schools,
    row.school_id,
  );
  return {
    ...row,
    school: school ? { name: school.name, category: school.category, city: school.city } : null,
  };
}

export function unwrapSchoolList(raw: unknown): School[] {
  if (Array.isArray(raw)) return raw as School[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["data", "result", "payload", "value", "schools"]) {
      const inner = obj[key];
      if (Array.isArray(inner)) return inner as School[];
    }
  }
  return [];
}

export async function listSchoolsFromPublicIndex(): Promise<School[]> {
  const index = await getById<{ school_ids?: string[]; codes?: string[] }>(
    COLLECTIONS.schoolDirectory,
    "__index",
  );
  const schoolIds = index?.school_ids?.filter(Boolean) ?? [];
  if (schoolIds.length > 0) {
    const rows = await Promise.all(
      schoolIds.slice(0, 80).map(async (id) => {
        try {
          return await getById<School>(COLLECTIONS.schools, id);
        } catch {
          return null;
        }
      }),
    );
    return rows
      .filter((row): row is School & { id: string } => Boolean(row?.id && row.name))
      .map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category || "secondary",
        country: row.country || "",
        city: row.city ?? null,
        description: row.description ?? null,
        website: row.website ?? null,
        logo_url: row.logo_url ?? null,
        fees_min: row.fees_min ?? null,
        fees_max: row.fees_max ?? null,
        fees_currency: row.fees_currency || "UGX",
        fees_notes: row.fees_notes ?? null,
        badges: row.badges ?? [],
        is_international: Boolean(row.is_international),
        admissions_open: row.admissions_open !== false,
        contact_email: row.contact_email ?? null,
        created_at: row.created_at || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const codes = index?.codes?.filter(Boolean) ?? [];
  if (codes.length === 0) return [];
  const fromCodes = await Promise.all(
    codes.slice(0, 80).map(async (code) => {
      try {
        const dir = await getById<{
          school_id?: string;
          name?: string;
          city?: string | null;
          country?: string | null;
          category?: string;
        }>(COLLECTIONS.schoolDirectory, code);
        if (!dir?.school_id) return null;
        const school = await getById<School>(COLLECTIONS.schools, dir.school_id);
        if (school) return school;
        return {
          id: dir.school_id,
          name: dir.name || "School",
          category: dir.category || "secondary",
          country: dir.country || "",
          city: dir.city ?? null,
          description: null,
          website: null,
          logo_url: null,
          fees_min: null,
          fees_max: null,
          fees_currency: "UGX",
          fees_notes: null,
          badges: [],
          is_international: false,
          admissions_open: true,
          contact_email: null,
          created_at: "",
        } satisfies School;
      } catch {
        return null;
      }
    }),
  );
  return fromCodes
    .filter((row): row is School => Boolean(row?.id && row.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function useSchools() {
  return useQuery({
    queryKey: ["schools"],
    queryFn: async (): Promise<School[]> => {
      try {
        const fromServer = unwrapSchoolList(await listDirectorySchools());
        if (fromServer.length > 0) return fromServer;
      } catch (error) {
        console.error("[schools] server directory list failed:", error);
      }
      return listSchoolsFromPublicIndex();
    },
  });
}

function unwrapRegisteredSchool(raw: unknown): {
  schoolId: string;
  code: string | null;
  created_at: string | null;
} | null {
  let current: unknown = raw;
  for (let i = 0; i < 6; i++) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    const obj = current as Record<string, unknown>;
    if (typeof obj["schoolId"] === "string" && obj["schoolId"]) {
      return {
        schoolId: obj["schoolId"],
        code: typeof obj["code"] === "string" ? obj["code"] : null,
        created_at: typeof obj["created_at"] === "string" ? obj["created_at"] : null,
      };
    }
    current = obj["data"] ?? obj["result"] ?? obj["payload"] ?? obj["value"];
  }
  return null;
}

async function registerSchoolOnClient(
  uid: string,
  email: string | null,
  displayName: string | null,
  values: Partial<School> & { name: string },
): Promise<{ schoolId: string; code: string; created_at: string }> {
  const schoolId = uid;
  let code = `MS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  for (let i = 0; i < 8; i++) {
    const taken = await getById(COLLECTIONS.schoolDirectory, code);
    if (!taken) break;
    code = `MS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
  const now = new Date().toISOString();
  const existing = await getById<{ code?: string; created_at?: string }>(
    COLLECTIONS.schools,
    schoolId,
  );
  if (existing?.code) code = String(existing.code);
  await setById(COLLECTIONS.schools, schoolId, {
    name: values.name,
    code,
    category: values.category ?? "secondary",
    city: values.city ?? null,
    country: values.country ?? "Uganda",
    website: values.website ?? null,
    description: values.description ?? null,
    fees_min: values.fees_min ?? null,
    fees_max: values.fees_max ?? null,
    fees_currency: "UGX",
    badges: values.badges ?? [],
    is_international: values.is_international ?? false,
    admissions_open: values.admissions_open !== false,
    contact_email: email,
    logo_url: null,
    owner_id: uid,
    created_by: uid,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  });
  try {
    await setById(COLLECTIONS.schoolDirectory, code, {
      school_id: schoolId,
      name: values.name,
      city: values.city ?? null,
      country: values.country ?? "Uganda",
      category: values.category ?? "secondary",
      admissions_open: values.admissions_open !== false,
    });
  } catch (error) {
    console.error("[schools] directory write failed:", error);
  }
  try {
    await setById(COLLECTIONS.schoolMembers, uid, {
      school_id: schoolId,
      user_id: uid,
      role: "institution",
      status: "approved",
      student_code: null,
      created_at: now,
    });
  } catch (error) {
    console.error("[schools] member write failed:", error);
  }
  try {
    await setById(COLLECTIONS.users, uid, {
      full_name: displayName?.trim() || values.name,
      email,
      avatar_url: null,
      phone: null,
      school_id: schoolId,
      student_code: null,
      role: "institution",
      membership_status: "owner",
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    console.error("[schools] profile write failed:", error);
  }
  const saved = await getById(COLLECTIONS.schools, schoolId);
  if (!saved) throw new Error("School was not saved. Try again.");
  return { schoolId, code, created_at: existing?.created_at ?? now };
}

export function useCreateSchool(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<School> & { name: string }) => {
      const payload = {
        name: values.name,
        category: values.category ?? "secondary",
        city: values.city ?? null,
        country: values.country ?? "Uganda",
        website: values.website ?? null,
        description: values.description ?? null,
        fees_min: values.fees_min ?? null,
        fees_max: values.fees_max ?? null,
        badges: values.badges ?? [],
        is_international: values.is_international ?? false,
        admissions_open: values.admissions_open,
      };
      let registered: ReturnType<typeof unwrapRegisteredSchool> = null;
      try {
        registered = unwrapRegisteredSchool(await registerDigitalSchool({ data: payload }));
      } catch (error) {
        console.error("[schools] server register failed:", error);
      }
      const user = getFirebaseAuth().currentUser;
      const uid = userId || user?.uid;
      if (!registered?.schoolId && uid) {
        registered = await registerSchoolOnClient(
          uid,
          user?.email ?? null,
          user?.displayName ?? null,
          values,
        );
      }
      const schoolId = registered?.schoolId ?? null;
      const code = registered?.code ?? null;
      if (!schoolId) {
        throw new Error("School was not saved. Try again.");
      }
      const school = {
        id: schoolId,
        name: values.name,
        code: code ?? "",
        category: values.category ?? "secondary",
        country: values.country ?? "Uganda",
        city: values.city ?? null,
        description: values.description ?? null,
        website: values.website ?? null,
        logo_url: null,
        fees_min: values.fees_min ?? null,
        fees_max: values.fees_max ?? null,
        fees_currency: "UGX",
        fees_notes: null,
        badges: values.badges ?? [],
        is_international: values.is_international ?? false,
        admissions_open: values.admissions_open !== false,
        contact_email: user?.email ?? null,
        owner_id: uid ?? "",
        created_at: registered?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        membership: "owner" as const,
        memberRole: "institution" as AppRole,
        studentCode: null as string | null,
      };
      if (uid && school) {
        await qc.cancelQueries({ queryKey: ["my-school", uid] });
        await qc.cancelQueries({ queryKey: ["profile", uid] });
        seedSessionAfterSignup(qc, {
          userId: uid,
          email: user?.email ?? null,
          fullName: user?.displayName?.trim() || values.name,
          role: "institution" as AppRole,
          schoolId,
          membership: "owner",
          studentCode: null,
        });
        qc.setQueryData(["my-school", uid], school);
        writeCachedSchool(uid, school);
      }
      await refreshAuthClaims();
      return { schoolId, code, school };
    },
    onSuccess: (result) => {
      const uid = userId || getFirebaseAuth().currentUser?.uid;
      if (uid && result.school) {
        qc.setQueryData(["my-school", uid], result.school);
        writeCachedSchool(uid, result.school);
      }
      void qc.invalidateQueries({ queryKey: ["schools"] });
    },
  });
}

export function useDeleteSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDigitalSchool({ data: { schoolId: id } });
      void refreshAuthClaims();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["schools"] });
      void qc.invalidateQueries({ queryKey: ["my-school"] });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["role"] });
    },
  });
}

export function useMyApplications(studentId?: string) {
  return useQuery({
    queryKey: ["applications", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<SchoolApplication[]> => {
      const rows = await findMany<Omit<SchoolApplication, "school">>(
        COLLECTIONS.schoolApplications,
        [where("student_id", "==", studentId!), orderBy("created_at", "desc")],
      );
      return Promise.all(rows.map(hydrateApplication));
    },
  });
}

export function useAllApplications(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["all-applications", schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<SchoolApplication[]> => {
      try {
        const raw = await listSchoolApplications();
        if (Array.isArray(raw)) return raw as SchoolApplication[];
        if (raw && typeof raw === "object") {
          const obj = raw as Record<string, unknown>;
          for (const key of ["data", "result", "payload", "value"]) {
            const inner = obj[key];
            if (Array.isArray(inner)) return inner as SchoolApplication[];
          }
        }
      } catch (error) {
        console.error("[applications] server list failed:", error);
      }
      const rows = await findMany<Omit<SchoolApplication, "school">>(
        COLLECTIONS.schoolApplications,
        [where("school_id", "==", schoolId!), orderBy("created_at", "desc")],
      );
      return Promise.all(rows.map(hydrateApplication));
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
      await createDoc(COLLECTIONS.schoolApplications, {
        ...values,
        student_id: studentId!,
        status: "pending",
        review_notes: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
      });
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
      await removeById(COLLECTIONS.schoolApplications, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applications"] }),
  });
}

export function useUpdateApplicationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: ApplicationStatus;
      notes?: string;
    }) => {
      await reviewSchoolApplication({
        data: {
          applicationId: id,
          status,
          notes: notes ?? null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-applications"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["school-members"] });
      qc.invalidateQueries({ queryKey: ["my-school"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

async function hydrateSlot(row: {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}): Promise<TimetableSlot> {
  const cls = await getById<{
    name: string;
    room: string | null;
    subject_id: string | null;
    teacher_id: string | null;
  }>(COLLECTIONS.classes, row.class_id);
  if (!cls) return { ...row, class: null };
  const withSubject = await attachSubject(cls);
  const withTeacher = await attachNamedUser(cls, cls.teacher_id, "teacher");
  return {
    ...row,
    class: {
      id: cls.id,
      name: cls.name,
      room: cls.room,
      subject: withSubject.subject,
      teacher: withTeacher.teacher ? { full_name: withTeacher.teacher.full_name } : null,
    },
  };
}

export function useWeeklyTimetable(userId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    let unsub: (() => void) | undefined;
    void userSchoolId(userId).then((schoolId) => {
      if (!schoolId) return;
      unsub = subscribeMany(COLLECTIONS.timetableSlots, [where("school_id", "==", schoolId)], () =>
        qc.invalidateQueries({ queryKey: ["weekly-timetable", userId] }),
      );
    });
    return () => unsub?.();
  }, [qc, userId]);

  return useQuery({
    queryKey: ["weekly-timetable", userId],
    enabled: !!userId,
    queryFn: async (): Promise<TimetableSlot[]> => {
      const schoolId = await userSchoolId(userId);
      const rows = await findMany<{
        class_id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
      }>(
        COLLECTIONS.timetableSlots,
        schoolId
          ? [where("school_id", "==", schoolId), orderBy("day_of_week"), orderBy("start_time")]
          : [orderBy("day_of_week"), orderBy("start_time")],
      );
      return Promise.all(rows.map(hydrateSlot));
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
      const cls = await getById<{ school_id?: string }>(COLLECTIONS.classes, values.class_id);
      await createDoc(COLLECTIONS.timetableSlots, { ...values, school_id: cls?.school_id ?? null });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-timetable"] }),
  });
}

export function useDeleteTimetableSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await removeById(COLLECTIONS.timetableSlots, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-timetable"] }),
  });
}

export function useStudyReminders(userId?: string) {
  return useQuery({
    queryKey: ["study-reminders", userId],
    enabled: !!userId,
    queryFn: async (): Promise<StudyReminder[]> => {
      const rows = await findMany<Omit<StudyReminder, "subject">>(COLLECTIONS.studyReminders, [
        where("user_id", "==", userId!),
        orderBy("day_of_week"),
        orderBy("start_time"),
      ]);
      return Promise.all(rows.map((row) => attachSubject(row))) as Promise<StudyReminder[]>;
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
      await createDoc(COLLECTIONS.studyReminders, {
        ...values,
        user_id: userId!,
        active: true,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-reminders"] }),
  });
}

export function useToggleStudyReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await patchById(COLLECTIONS.studyReminders, id, { active });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-reminders"] }),
  });
}

export function useDeleteStudyReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await removeById(COLLECTIONS.studyReminders, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-reminders"] }),
  });
}

export function useMeetings() {
  return useQuery({
    queryKey: ["school-meetings"],
    queryFn: async (): Promise<SchoolMeeting[]> => {
      const schoolId = await userSchoolId();
      if (!schoolId) return [];
      const rows = await findMany<Omit<SchoolMeeting, "class">>(COLLECTIONS.schoolMeetings, [
        where("school_id", "==", schoolId),
        orderBy("scheduled_at", "asc"),
      ]);
      return Promise.all(rows.map((row) => attachClassName(row))) as Promise<SchoolMeeting[]>;
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
      const schoolId = await userSchoolId(userId);
      await createDoc(COLLECTIONS.schoolMeetings, {
        ...values,
        created_by: userId!,
        school_id: schoolId,
      });
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
      await removeById(COLLECTIONS.schoolMeetings, id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["school-meetings"] }),
  });
}

export function useNotifications(userId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    return subscribeMany(COLLECTIONS.notifications, [where("user_id", "==", userId)], () =>
      qc.invalidateQueries({ queryKey: ["notifications", userId] }),
    );
  }, [qc, userId]);

  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AppNotification[]> => {
      return findMany<AppNotification>(COLLECTIONS.notifications, [
        where("user_id", "==", userId!),
        orderBy("created_at", "desc"),
        limit(30),
      ]);
    },
  });
}

export function useMarkNotificationRead(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await patchById(COLLECTIONS.notifications, id, { read: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
  });
}

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
      const schoolId = await userSchoolId();
      if (!schoolId) return [];
      const rows = await findMany<{
        role: string;
        full_name: string;
        email: string | null;
      }>(COLLECTIONS.users, [where("school_id", "==", schoolId)]);
      return rows
        .filter((r) => ["teacher", "admin", "institution", "superadmin"].includes(r.role))
        .map((r) => ({
          user_id: r.id,
          role: r.role,
          profile: { id: r.id, full_name: r.full_name, email: r.email },
        }));
    },
  });
}

export function useAllClasses(enabled: boolean) {
  return useQuery({
    queryKey: ["all-classes"],
    enabled,
    queryFn: async () => {
      const schoolId = await userSchoolId();
      if (!schoolId) return [];
      const rows = await findMany<{
        name: string;
        room: string | null;
        subject_id: string | null;
        teacher_id: string | null;
      }>(COLLECTIONS.classes, [where("school_id", "==", schoolId), orderBy("name")]);
      return Promise.all(
        rows.map(async (row) => {
          const withSubject = await attachSubject(row);
          const withTeacher = await attachNamedUser(row, row.teacher_id, "teacher");
          return {
            ...row,
            subject: withSubject.subject,
            teacher: withTeacher.teacher
              ? { id: withTeacher.teacher.id, full_name: withTeacher.teacher.full_name }
              : null,
          };
        }),
      );
    },
  });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      name: string;
      subject_id: string | null;
      teacher_id: string | null;
      room: string | null;
    }) => {
      const schoolId = await userSchoolId();
      await createDoc(COLLECTIONS.classes, {
        ...values,
        school_id: schoolId,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-classes"] });
      qc.invalidateQueries({ queryKey: ["weekly-timetable"] });
    },
  });
}
