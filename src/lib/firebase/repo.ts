import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  getCountFromServer,
  onSnapshot,
  Timestamp,
  documentId,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./client";
import { plainFirestoreData } from "./plain-data";

/** Collection IDs. Keep snake_case names that match the previous Postgres tables where practical. */
export const COLLECTIONS = {
  users: "users",
  /** email (lowercased) → current Auth uid — survives Auth UID recreation */
  userDirectory: "user_directory",
  schools: "schools",
  schoolDirectory: "school_directory",
  schoolMembers: "school_members",
  schoolRoster: "school_roster",
  classes: "classes",
  classEnrollments: "class_enrollments",
  subjects: "subjects",
  timetableSlots: "timetable_slots",
  attendance: "attendance",
  assignments: "assignments",
  submissions: "submissions",
  assessments: "assessments",
  assessmentQuestions: "assessment_questions",
  assessmentAnswerKeys: "assessment_answer_keys",
  assessmentSubmissions: "assessment_submissions",
  questionBank: "question_bank",
  performanceSummaries: "performance_summaries",
  revisionPlans: "revision_plans",
  assessmentIntegrityEvents: "assessment_integrity_events",
  assessmentResultPrivate: "assessment_result_private",
  lockerFolders: "locker_folders",
  lockerItems: "locker_items",
  libraryBooks: "library_books",
  missedWork: "missed_work",
  classroomSessions: "classroom_sessions",
  classroomParticipants: "classroom_participants",
  classroomMessages: "classroom_messages",
  liveSessionEvents: "live_session_events",
  conversations: "conversations",
  conversationMembers: "conversation_members",
  messages: "messages",
  notifications: "notifications",
  notificationPreferences: "notification_preferences",
  notificationDeliveries: "notification_deliveries",
  fcmTokens: "fcm_tokens",
  parentStudents: "parent_students",
  userRelations: "user_relations",
  disciplinaryActions: "disciplinary_actions",
  rewardEvents: "reward_events",
  marketplaceItems: "marketplace_items",
  orders: "orders",
  schoolApplications: "school_applications",
  schoolMeetings: "school_meetings",
  studyReminders: "study_reminders",
  aiInsights: "ai_insights",
  learningProfiles: "learning_profiles",
  signupRequests: "signup_requests",
  auditLogs: "audit_logs",
  paymentEvents: "payment_events",
  academicYears: "academic_years",
  academicPeriods: "academic_periods",
  curricula: "curricula",
  curriculumLevels: "curriculum_levels",
  curriculumTopics: "curriculum_topics",
  curriculumObjectives: "curriculum_objectives",
  classTeacherAssignments: "class_teacher_assignments",
  lessons: "lessons",
  lessonMaterials: "lesson_materials",
  aiConversations: "ai_conversations",
  aiMessages: "ai_messages",
  aiLearningMemory: "ai_learning_memory",
  aiUsage: "ai_usage",
  aiRateLimits: "ai_rate_limits",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export function col(name: CollectionName) {
  return collection(getDb(), name);
}

export function docRef(name: CollectionName, id: string) {
  return doc(getDb(), name, id);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function withId<T extends DocumentData>(id: string, data: T): T & { id: string } {
  return { ...data, id };
}

export async function getById<T extends DocumentData>(
  name: CollectionName,
  id: string,
): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(docRef(name, id));
  if (!snap.exists()) return null;
  return withId(snap.id, snap.data() as T);
}

export async function findMany<T extends DocumentData>(
  name: CollectionName,
  constraints: QueryConstraint[],
): Promise<Array<T & { id: string }>> {
  const snap = await getDocs(query(col(name), ...constraints));
  return snap.docs.map((d) => withId(d.id, d.data() as T));
}

export async function findOne<T extends DocumentData>(
  name: CollectionName,
  constraints: QueryConstraint[],
): Promise<(T & { id: string }) | null> {
  const rows = await findMany<T>(name, [...constraints, fsLimit(1)]);
  return rows[0] ?? null;
}

export async function createDoc<T extends DocumentData>(
  name: CollectionName,
  data: T,
): Promise<string> {
  const ref = await addDoc(col(name), plainFirestoreData(data as Record<string, unknown>));
  return ref.id;
}

export async function setById<T extends DocumentData>(
  name: CollectionName,
  id: string,
  data: T,
  merge = true,
): Promise<void> {
  await setDoc(docRef(name, id), plainFirestoreData(data as Record<string, unknown>), { merge });
}

export async function patchById(
  name: CollectionName,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  await updateDoc(docRef(name, id), plainFirestoreData(data));
}

export async function removeById(name: CollectionName, id: string): Promise<void> {
  await deleteDoc(docRef(name, id));
}

export async function countDocs(
  name: CollectionName,
  constraints: QueryConstraint[] = [],
): Promise<number> {
  const snap = await getCountFromServer(query(col(name), ...constraints));
  return snap.data().count;
}

export function subscribeMany<T extends DocumentData>(
  name: CollectionName,
  constraints: QueryConstraint[],
  onNext: (rows: Array<T & { id: string }>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(col(name), ...constraints),
    (snap) => onNext(snap.docs.map((d) => withId(d.id, d.data() as T))),
    (error) => onError?.(error),
  );
}

export { where, orderBy, fsLimit as limit, Timestamp, query, documentId };
