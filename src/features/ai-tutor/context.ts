import { adminGetById, adminWhere } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import type { AuthedContext } from "@/lib/firebase/require-auth";
import type { AssignmentAiPolicy } from "@/types/ai";
import { DEFAULT_ASSIGNMENT_POLICY } from "./capabilities";
import type { TutorTurnInput } from "./contracts";

export type PackedContext = {
  label: string;
  text: string;
  contextType: "general" | "lesson" | "assignment" | "missed_work" | "subject";
  subjectId: string | null;
  assignmentPolicy: AssignmentAiPolicy | null;
};

async function enrolled(studentId: string, classId: string): Promise<boolean> {
  const rows = await adminWhere<{ status?: string }>(
    COLLECTIONS.classEnrollments,
    "class_id",
    "==",
    classId,
    [["student_id", "==", studentId]],
  );
  return rows.some((r) => r.status !== "ended");
}

function sameSchool(context: AuthedContext, schoolId: string | null | undefined) {
  if (!schoolId || !context.schoolId || schoolId !== context.schoolId) {
    throw new Error("You do not have permission to use that learning context.");
  }
}

export async function assembleContext(
  context: AuthedContext,
  input: TutorTurnInput,
): Promise<PackedContext> {
  const bits: string[] = [];
  bits.push(`Role: ${context.role}.`);
  if (context.schoolId) bits.push(`School context is attached.`);

  let label = "General tutoring";
  let contextType: PackedContext["contextType"] = "general";
  let subjectId = input.subject_id;
  let assignmentPolicy: AssignmentAiPolicy | null = null;

  if (input.subject_id) {
    const subject = await adminGetById<{
      school_id: string;
      name: string;
      code?: string;
      description?: string | null;
    }>(COLLECTIONS.subjects, input.subject_id);
    if (!subject) throw new Error("That subject was not found.");
    sameSchool(context, subject.school_id);
    bits.push(`Subject: ${subject.name}${subject.code ? ` (${subject.code})` : ""}.`);
    if (subject.description) bits.push(`Subject notes: ${subject.description.slice(0, 400)}`);
    label = `Using your ${subject.name} context.`;
    contextType = "subject";
  }

  if (input.topic_id) {
    const topic = await adminGetById<{
      school_id: string;
      name: string;
      curriculum_id?: string | null;
    }>(COLLECTIONS.curriculumTopics, input.topic_id);
    if (!topic) throw new Error("That topic was not found.");
    sameSchool(context, topic.school_id);
    bits.push(`Topic: ${topic.name}.`);
    if (topic.curriculum_id) {
      const cur = await adminGetById<{ name: string }>(COLLECTIONS.curricula, topic.curriculum_id);
      if (cur) bits.push(`Curriculum: ${cur.name}.`);
    }
  }

  if (input.lesson_id) {
    const lesson = await adminGetById<{
      school_id: string;
      class_id: string;
      title: string;
      description?: string | null;
      subject_id?: string | null;
      status?: string;
    }>(COLLECTIONS.lessons, input.lesson_id);
    if (!lesson) throw new Error("That lesson was not found.");
    sameSchool(context, lesson.school_id);
    if (context.role === "student") {
      const ok = await enrolled(context.userId, lesson.class_id);
      if (!ok) throw new Error("You are not enrolled in that class.");
    }
    bits.push(`Lesson: ${lesson.title} (${lesson.status ?? "scheduled"}).`);
    if (lesson.description) bits.push(`Lesson summary: ${lesson.description.slice(0, 800)}`);
    subjectId = subjectId ?? lesson.subject_id ?? null;
    label = `Using your ${lesson.title} lesson context.`;
    contextType = "lesson";
  }

  if (input.assignment_id) {
    const assignment = await adminGetById<{
      school_id: string;
      class_id: string;
      title: string;
      description?: string | null;
      due_at?: string | null;
      status?: string;
      ai_policy?: AssignmentAiPolicy | null;
    }>(COLLECTIONS.assignments, input.assignment_id);
    if (!assignment) throw new Error("That assignment was not found.");
    sameSchool(context, assignment.school_id);
    if (context.role === "student") {
      const ok = await enrolled(context.userId, assignment.class_id);
      if (!ok) throw new Error("You are not enrolled in that class.");
    }
    assignmentPolicy = assignment.ai_policy ?? DEFAULT_ASSIGNMENT_POLICY;
    if (assignmentPolicy === "disabled") {
      throw new Error("AI assistance is turned off for this assignment.");
    }
    bits.push(`Assignment: ${assignment.title}. Status: ${assignment.status ?? "published"}.`);
    if (assignment.due_at) bits.push(`Due: ${assignment.due_at}.`);
    if (assignment.description) bits.push(`Instructions: ${assignment.description.slice(0, 1200)}`);
    bits.push(`Assignment AI policy: ${assignmentPolicy}.`);
    label = `Using your ${assignment.title} assignment context.`;
    contextType = "assignment";
  }

  if (input.missed_work_id) {
    const missed = await adminGetById<{
      school_id: string;
      student_id: string;
      title: string;
      status?: string | null;
      lesson_id?: string | null;
    }>(COLLECTIONS.missedWork, input.missed_work_id);
    if (!missed) throw new Error("That missed-work item was not found.");
    sameSchool(context, missed.school_id);
    if (context.role === "student" && missed.student_id !== context.userId) {
      throw new Error("You do not have permission to use that learning context.");
    }
    bits.push(`Missed work: ${missed.title}. Progress: ${missed.status ?? "pending"}.`);
    bits.push("Do not mark this missed work complete.");
    label = `Using your missed-work context.`;
    contextType = "missed_work";
  }

  const profile = await adminGetById<{
    summary?: string | null;
    weak_topics?: string[];
    strong_topics?: string[];
    learning_style?: string | null;
    focus_topic?: string | null;
  }>(COLLECTIONS.learningProfiles, context.userId);
  if (profile) {
    if (profile.learning_style)
      bits.push(`Preferred explanation style: ${profile.learning_style}.`);
    if (profile.focus_topic) bits.push(`Focus topic: ${profile.focus_topic}.`);
    if (profile.weak_topics?.length)
      bits.push(`Needs practice: ${profile.weak_topics.slice(0, 4).join(", ")}.`);
    if (profile.strong_topics?.length)
      bits.push(`Stronger on: ${profile.strong_topics.slice(0, 4).join(", ")}.`);
  }

  const memories = await adminWhere<{ body: string; topic?: string | null; kind: string }>(
    COLLECTIONS.aiLearningMemory,
    "owner_id",
    "==",
    context.userId,
  );
  const relevant = memories
    .filter((m) => !subjectId || !m.topic || m.topic === subjectId)
    .slice(0, 6);
  if (relevant.length) {
    bits.push("Saved learning memory:");
    for (const m of relevant) bits.push(`- (${m.kind}) ${m.body.slice(0, 200)}`);
  }

  return {
    label,
    text: bits.join("\n").slice(0, 6000),
    contextType,
    subjectId,
    assignmentPolicy,
  };
}
