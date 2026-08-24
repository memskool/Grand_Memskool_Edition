import { createServerFn } from "@tanstack/react-start";
import { isSchoolManager } from "@/types/roles";
import { requireFirebaseAuth, type AuthedContext } from "@/lib/firebase/require-auth";
import {
  adminCreate,
  adminDelete,
  adminGetById,
  adminSet,
  adminUpdate,
  adminWhere,
} from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import {
  AssessmentIdSchema,
  AttemptIdSchema,
  ChildIdSchema,
  IntegrityEventSchema,
  MarkAttemptSchema,
  SaveAnswersSchema,
  SaveAssessmentSchema,
  SubmitAttemptSchema,
  shuffle,
  type AssessmentType,
  type EngineQuestionKind,
} from "./contracts";
import { autoMarkQuestion, isAutoKind, needsManualReview } from "./marking";
import {
  applyAttemptToSummary,
  loadSummary,
  subjectName,
  topicName,
  weakAreas,
} from "./performance";

type AssessmentDoc = {
  school_id: string;
  class_id: string;
  subject_id?: string | null;
  created_by: string;
  title: string;
  description?: string | null;
  type?: AssessmentType;
  status?: string;
  published?: boolean;
  time_limit_minutes?: number;
  passing_score?: number;
  max_attempts?: number;
  available_from?: string | null;
  available_until?: string | null;
  results_released?: boolean;
  reveal_answers?: boolean;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  total_points?: number;
  notified_published_at?: string | null;
};

type QuestionDoc = {
  assessment_id: string;
  position: number;
  kind: EngineQuestionKind;
  prompt: string;
  options: string[];
  points: number;
  topic_id?: string | null;
  explanation?: string | null;
};

type AttemptDoc = {
  assessment_id: string;
  student_id: string;
  school_id: string;
  status: string;
  answers: Record<string, string>;
  started_at: string;
  ends_at: string | null;
  submitted_at?: string | null;
  question_order?: string[];
  option_order?: Record<string, string[]>;
  attempt_number?: number;
  results_released?: boolean;
  auto_score?: number | null;
  manual_score?: number | null;
  total_points?: number;
  question_marks?: Record<string, number>;
};

type PrivateResult = {
  school_id: string;
  attempt_id: string;
  student_id: string;
  assessment_id: string;
  auto_score: number;
  manual_score: number | null;
  total_points: number;
  question_marks: Record<string, number>;
  passed: boolean;
  summary_applied?: boolean;
  topic_scores?: Array<{ topic_id: string; points: number; max: number }>;
};

function resultsArePublic(assessment: AssessmentDoc) {
  return assessment.results_released !== false || assessment.type === "practice";
}

function requireStaff(context: AuthedContext) {
  if (context.role !== "teacher" && !isSchoolManager(context.role)) {
    throw new Error("You do not have permission to perform this action.");
  }
  if (context.role === "teacher" && !context.approved) {
    throw new Error("Your school has not approved your teacher account yet.");
  }
  if (!context.schoolId) throw new Error("You are not attached to a school.");
  return context.schoolId;
}

async function assertTeachesClass(userId: string, role: string, schoolId: string, classId: string) {
  const cls = await adminGetById<{ school_id: string; teacher_id?: string | null }>(
    COLLECTIONS.classes,
    classId,
  );
  if (!cls || cls.school_id !== schoolId) throw new Error("That class is not in your school.");
  if (isSchoolManager(role as never)) return;
  if (cls.teacher_id === userId) return;
  const assigned = await adminWhere<{ status?: string }>(
    COLLECTIONS.classTeacherAssignments,
    "class_id",
    "==",
    classId,
    [["teacher_id", "==", userId]],
  );
  if (!assigned.some((row) => row.status !== "ended")) {
    throw new Error("You are not assigned to this class.");
  }
}

async function assertManagesAssessment(
  context: AuthedContext,
  assessment: AssessmentDoc & { id: string },
) {
  const schoolId = requireStaff(context);
  if (assessment.school_id !== schoolId)
    throw new Error("You do not have permission to perform this action.");
  if (assessment.created_by === context.userId || isSchoolManager(context.role)) return;
  await assertTeachesClass(context.userId, context.role, schoolId, assessment.class_id);
}

async function hasActiveEnrollment(classId: string, studentId: string) {
  const rows = await adminWhere<{ status?: string }>(
    COLLECTIONS.classEnrollments,
    "class_id",
    "==",
    classId,
    [["student_id", "==", studentId]],
  );
  return rows.some((row) => row.status !== "ended");
}

function withinWindow(assessment: AssessmentDoc, now: number) {
  if (assessment.available_from && Date.parse(assessment.available_from) > now) {
    throw new Error("This assessment is not available yet.");
  }
  if (assessment.available_until && Date.parse(assessment.available_until) < now) {
    throw new Error("This assessment is no longer available.");
  }
}

const GRACE_MS = 60_000;

export const saveAssessment = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SaveAssessmentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const schoolId = requireStaff(context);
    await assertTeachesClass(context.userId, context.role, schoolId, data.class_id);
    const total = data.questions.reduce((sum, q) => sum + q.points, 0);
    const now = new Date().toISOString();
    const payload = {
      school_id: schoolId,
      class_id: data.class_id,
      subject_id: data.subject_id,
      created_by: context.userId,
      title: data.title,
      description: data.description || null,
      type: data.type,
      status: "draft",
      published: false,
      time_limit_minutes: data.time_limit_minutes,
      passing_score: data.passing_score,
      max_attempts: data.max_attempts,
      available_from: data.available_from,
      available_until: data.available_until,
      results_released: data.results_released,
      reveal_answers: data.reveal_answers,
      shuffle_questions: data.shuffle_questions,
      shuffle_options: data.shuffle_options,
      total_points: total,
      updated_at: now,
    };

    let id = data.assessmentId;
    if (id) {
      const existing = await adminGetById<AssessmentDoc>(COLLECTIONS.assessments, id);
      if (!existing) throw new Error("Assessment not found.");
      await assertManagesAssessment(context, existing);
      if (existing.status && existing.status !== "draft") {
        throw new Error("Published assessments cannot be rebuilt. Close it and create a new one.");
      }
      await adminUpdate(COLLECTIONS.assessments, id, payload);
      const oldQs = await adminWhere<{ id: string }>(
        COLLECTIONS.assessmentQuestions,
        "assessment_id",
        "==",
        id,
      );
      await Promise.all(
        oldQs.flatMap((q) => [
          adminDelete(COLLECTIONS.assessmentQuestions, q.id),
          adminDelete(COLLECTIONS.assessmentAnswerKeys, q.id),
        ]),
      );
    } else {
      id = await adminCreate(COLLECTIONS.assessments, { ...payload, created_at: now });
    }

    for (const [i, q] of data.questions.entries()) {
      const options =
        q.kind === "multiple_choice" || q.kind === "multiple_select"
          ? q.options.filter((o) => o.trim())
          : q.kind === "true_false"
            ? ["True", "False"]
            : [];
      const questionId = await adminCreate(COLLECTIONS.assessmentQuestions, {
        assessment_id: id,
        school_id: schoolId,
        position: i,
        kind: q.kind,
        prompt: q.prompt,
        options,
        points: q.points,
        topic_id: q.topic_id ?? null,
        explanation: q.explanation ?? null,
      });
      await adminSet(COLLECTIONS.assessmentAnswerKeys, questionId, {
        question_id: questionId,
        assessment_id: id,
        school_id: schoolId,
        correct_answer: q.correct_answer || null,
        accepted: q.accepted ?? [],
      });
      if (q.save_to_bank) {
        await adminCreate(COLLECTIONS.questionBank, {
          school_id: schoolId,
          created_by: context.userId,
          subject_id: data.subject_id,
          topic_id: q.topic_id ?? null,
          kind: q.kind,
          prompt: q.prompt,
          options,
          correct_answer: q.correct_answer,
          accepted: q.accepted ?? [],
          points: q.points,
          status: "active",
          created_at: now,
        });
      }
    }
    return { id };
  });

export const publishAssessment = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => AssessmentIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const assessment = await adminGetById<AssessmentDoc>(
      COLLECTIONS.assessments,
      data.assessmentId,
    );
    if (!assessment) throw new Error("Assessment not found.");
    await assertManagesAssessment(context, assessment);
    const questions = await adminWhere(
      COLLECTIONS.assessmentQuestions,
      "assessment_id",
      "==",
      assessment.id,
    );
    if (!questions.length) throw new Error("Add at least one question before publishing.");
    const now = new Date().toISOString();
    await adminUpdate(COLLECTIONS.assessments, assessment.id, {
      status: "published",
      published: true,
      updated_at: now,
      notified_published_at: assessment.notified_published_at ?? now,
    });
    if (!assessment.notified_published_at) {
      const enrolled = await adminWhere<{ student_id: string; status?: string }>(
        COLLECTIONS.classEnrollments,
        "class_id",
        "==",
        assessment.class_id,
      );
      const { createAndQueueNotification, dispatchNotifications } = await import(
        "@/lib/notifications.server"
      );
      await Promise.all(
        enrolled
          .filter((row) => row.status !== "ended")
          .slice(0, 80)
          .map((row) =>
            createAndQueueNotification({
              userId: row.student_id,
              title: "New assessment available",
              body: `${assessment.title} is ready. Open Assessments to start.`,
              kind: "assessment",
              link: "/assessments",
              schoolId: assessment.school_id,
              createdAt: now,
            }),
          ),
      );
      void dispatchNotifications();
    }
    return { ok: true as const };
  });

export const closeAssessment = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => AssessmentIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const assessment = await adminGetById<AssessmentDoc>(
      COLLECTIONS.assessments,
      data.assessmentId,
    );
    if (!assessment) throw new Error("Assessment not found.");
    await assertManagesAssessment(context, assessment);
    await adminUpdate(COLLECTIONS.assessments, assessment.id, {
      status: "closed",
      published: false,
      updated_at: new Date().toISOString(),
    });
    return { ok: true as const };
  });

export const releaseAssessmentResults = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => AssessmentIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const assessment = await adminGetById<AssessmentDoc>(
      COLLECTIONS.assessments,
      data.assessmentId,
    );
    if (!assessment) throw new Error("Assessment not found.");
    await assertManagesAssessment(context, assessment);
    const now = new Date().toISOString();
    await adminUpdate(COLLECTIONS.assessments, assessment.id, {
      results_released: true,
      updated_at: now,
    });
    const attempts = await adminWhere<AttemptDoc>(
      COLLECTIONS.assessmentSubmissions,
      "assessment_id",
      "==",
      assessment.id,
    );
    const { createAndQueueNotification, dispatchNotifications } = await import(
      "@/lib/notifications.server"
    );
    for (const row of attempts.filter((item) => item.submitted_at).slice(0, 80)) {
      const priv = await adminGetById<PrivateResult>(COLLECTIONS.assessmentResultPrivate, row.id);
      if (priv) {
        await adminUpdate(COLLECTIONS.assessmentSubmissions, row.id, {
          auto_score: priv.auto_score,
          manual_score: priv.manual_score,
          total_points: priv.total_points,
          question_marks: priv.question_marks,
          passed: priv.passed,
          results_released: true,
          updated_at: now,
        });
        if (row.status === "graded" && !priv.summary_applied) {
          await applyAttemptToSummary({
            studentId: row.student_id,
            schoolId: assessment.school_id,
            subjectId: assessment.subject_id ?? null,
            score: priv.manual_score ?? priv.auto_score,
            total: priv.total_points,
            topicScores: priv.topic_scores ?? [],
          });
          await adminSet(COLLECTIONS.assessmentResultPrivate, row.id, { summary_applied: true });
        }
      } else {
        await adminUpdate(COLLECTIONS.assessmentSubmissions, row.id, {
          results_released: true,
          updated_at: now,
        });
      }
      await createAndQueueNotification({
        userId: row.student_id,
        title: "Results released",
        body: `Results for ${assessment.title} are now available.`,
        kind: "assessment",
        link: "/assessments",
        schoolId: assessment.school_id,
        createdAt: now,
      });
    }
    void dispatchNotifications();
    return { ok: true as const };
  });

export const startAssessmentAttempt = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => AssessmentIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (context.role !== "student") throw new Error("Only students can sit this assessment.");
    if (!context.schoolId) throw new Error("You are not attached to a school.");
    const assessment = await adminGetById<AssessmentDoc>(
      COLLECTIONS.assessments,
      data.assessmentId,
    );
    if (!assessment || assessment.school_id !== context.schoolId) {
      throw new Error("You are not allowed to start this assessment.");
    }
    if (!assessment.published || assessment.status === "draft" || assessment.status === "closed") {
      throw new Error("You are not allowed to start this assessment.");
    }
    const now = Date.now();
    withinWindow(assessment, now);
    if (!(await hasActiveEnrollment(assessment.class_id, context.userId))) {
      throw new Error("You are not enrolled in this class.");
    }

    const prior = await adminWhere<AttemptDoc>(
      COLLECTIONS.assessmentSubmissions,
      "assessment_id",
      "==",
      assessment.id,
      [["student_id", "==", context.userId]],
    );
    const open = prior.find((row) => row.status === "in_progress");
    if (open) {
      return {
        attemptId: open.id,
        started_at: open.started_at,
        ends_at: open.ends_at,
        server_now: new Date().toISOString(),
        question_order: open.question_order ?? [],
        option_order: open.option_order ?? {},
        answers: open.answers ?? {},
        resumed: true,
      };
    }
    const max = assessment.max_attempts ?? (assessment.type === "practice" ? 0 : 1);
    const finished = prior.filter((row) => row.status !== "in_progress");
    if (max > 0 && finished.length >= max) {
      throw new Error("You have used all allowed attempts.");
    }

    const questions = await adminWhere<QuestionDoc>(
      COLLECTIONS.assessmentQuestions,
      "assessment_id",
      "==",
      assessment.id,
    );
    questions.sort((a, b) => a.position - b.position);
    const seed = Date.now() + context.userId.length;
    const ordered = assessment.shuffle_questions ? shuffle(questions, seed) : questions;
    const question_order = ordered.map((q) => q.id);
    const option_order: Record<string, string[]> = {};
    for (const q of ordered) {
      const opts = Array.isArray(q.options) ? q.options : [];
      option_order[q.id] =
        assessment.shuffle_options && opts.length ? shuffle(opts, seed + q.position) : opts;
    }
    const startedAt = new Date().toISOString();
    const minutes = assessment.time_limit_minutes ?? 0;
    const timed = minutes > 0 && assessment.type !== "practice";
    const ends_at = timed ? new Date(Date.parse(startedAt) + minutes * 60_000).toISOString() : null;
    const id = await adminCreate(COLLECTIONS.assessmentSubmissions, {
      assessment_id: assessment.id,
      student_id: context.userId,
      school_id: assessment.school_id,
      answers: {},
      auto_score: 0,
      manual_score: null,
      total_points: assessment.total_points ?? 0,
      passed: null,
      status: "in_progress",
      started_at: startedAt,
      ends_at,
      created_at: startedAt,
      submitted_at: null,
      question_order,
      option_order,
      attempt_number: finished.length + 1,
      results_released: assessment.results_released ?? true,
    });
    await adminCreate(COLLECTIONS.assessmentIntegrityEvents, {
      attempt_id: id,
      assessment_id: assessment.id,
      student_id: context.userId,
      school_id: assessment.school_id,
      event: "started",
      created_at: startedAt,
    });
    return {
      attemptId: id,
      started_at: startedAt,
      ends_at,
      server_now: startedAt,
      question_order,
      option_order,
      answers: {} as Record<string, string>,
      resumed: false,
    };
  });

export const getAttemptClock = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => AttemptIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const attempt = await adminGetById<AttemptDoc>(
      COLLECTIONS.assessmentSubmissions,
      data.attemptId,
    );
    if (!attempt || attempt.student_id !== context.userId) throw new Error("Attempt not found.");
    const server_now = new Date().toISOString();
    const remaining_ms = attempt.ends_at
      ? Math.max(0, Date.parse(attempt.ends_at) - Date.parse(server_now))
      : null;
    return {
      server_now,
      started_at: attempt.started_at,
      ends_at: attempt.ends_at,
      remaining_ms,
      status: attempt.status,
    };
  });

export const saveAttemptAnswers = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SaveAnswersSchema.parse(data))
  .handler(async ({ data, context }) => {
    const attempt = await adminGetById<AttemptDoc>(
      COLLECTIONS.assessmentSubmissions,
      data.attemptId,
    );
    if (!attempt || attempt.student_id !== context.userId) throw new Error("Attempt not found.");
    if (attempt.status !== "in_progress") throw new Error("This attempt is already submitted.");
    if (attempt.ends_at && Date.now() > Date.parse(attempt.ends_at) + GRACE_MS) {
      throw new Error("Time is up. Submit the paper.");
    }
    const saved_at = new Date().toISOString();
    await adminUpdate(COLLECTIONS.assessmentSubmissions, attempt.id, {
      answers: data.answers,
      updated_at: saved_at,
    });
    return { saved_at };
  });

async function gradeAttempt(attempt: AttemptDoc & { id: string }, answers: Record<string, string>) {
  const questions = await adminWhere<QuestionDoc>(
    COLLECTIONS.assessmentQuestions,
    "assessment_id",
    "==",
    attempt.assessment_id,
  );
  const keys = await adminWhere<{
    question_id: string;
    correct_answer: string | null;
    accepted?: string[];
  }>(COLLECTIONS.assessmentAnswerKeys, "assessment_id", "==", attempt.assessment_id);
  const keyByQ = new Map(keys.map((k) => [k.question_id, k]));
  let autoScore = 0;
  let totalPoints = 0;
  let manualPending = false;
  const question_marks: Record<string, number> = {};
  const topicScores: Array<{ topic_id: string; points: number; max: number }> = [];
  for (const q of questions) {
    totalPoints += q.points;
    const given = answers[q.id] ?? "";
    if (q.kind === "long_answer") {
      manualPending = true;
      question_marks[q.id] = 0;
    } else if (needsManualReview(q.kind)) {
      const ok = autoMarkQuestion(q.kind, given, keyByQ.get(q.id));
      question_marks[q.id] = ok ? q.points : 0;
      autoScore += question_marks[q.id] ?? 0;
      if (!ok && given.trim()) manualPending = true;
    } else if (isAutoKind(q.kind)) {
      const ok = autoMarkQuestion(q.kind, given, keyByQ.get(q.id));
      question_marks[q.id] = ok ? q.points : 0;
      autoScore += question_marks[q.id] ?? 0;
    }
    if (q.topic_id) {
      topicScores.push({ topic_id: q.topic_id, points: question_marks[q.id] ?? 0, max: q.points });
    }
  }
  return { autoScore, totalPoints, manualPending, question_marks, topicScores };
}

export const submitAssessmentAttempt = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SubmitAttemptSchema.parse(data))
  .handler(async ({ data, context }) => {
    const attempt = await adminGetById<AttemptDoc>(
      COLLECTIONS.assessmentSubmissions,
      data.attemptId,
    );
    if (!attempt || attempt.student_id !== context.userId) throw new Error("Attempt not found.");
    if (attempt.status !== "in_progress") {
      const released = attempt.results_released !== false;
      return {
        autoScore: released ? (attempt.auto_score ?? 0) : 0,
        totalPoints: attempt.total_points ?? 0,
        manualPending: attempt.status === "awaiting_manual" || attempt.status === "submitted",
        alreadySubmitted: true,
        resultsReleased: released,
      };
    }
    const assessment = await adminGetById<AssessmentDoc>(
      COLLECTIONS.assessments,
      attempt.assessment_id,
    );
    if (!assessment) throw new Error("Assessment not found.");
    const graded = await gradeAttempt(attempt, data.answers);
    const now = new Date().toISOString();
    const status = graded.manualPending ? "awaiting_manual" : "graded";
    const released = resultsArePublic(assessment);
    const passed = graded.totalPoints
      ? graded.autoScore / graded.totalPoints >= (assessment.passing_score ?? 50) / 100
      : false;
    await adminSet(COLLECTIONS.assessmentResultPrivate, attempt.id, {
      school_id: assessment.school_id,
      attempt_id: attempt.id,
      student_id: context.userId,
      assessment_id: assessment.id,
      auto_score: graded.autoScore,
      manual_score: graded.manualPending ? null : graded.autoScore,
      total_points: graded.totalPoints,
      question_marks: graded.question_marks,
      passed,
      topic_scores: graded.topicScores,
      summary_applied: released && status === "graded",
      updated_at: now,
    });
    await adminUpdate(COLLECTIONS.assessmentSubmissions, attempt.id, {
      answers: data.answers,
      auto_score: released ? graded.autoScore : null,
      manual_score: released && !graded.manualPending ? graded.autoScore : null,
      total_points: graded.totalPoints,
      ...(released ? { question_marks: graded.question_marks, passed } : { passed: null }),
      status,
      submitted_at: now,
      results_released: released,
      updated_at: now,
    });
    if (released && status === "graded") {
      await applyAttemptToSummary({
        studentId: context.userId,
        schoolId: assessment.school_id,
        subjectId: assessment.subject_id ?? null,
        score: graded.autoScore,
        total: graded.totalPoints,
        topicScores: graded.topicScores,
      });
    }
    const { createAndQueueNotification, dispatchNotifications } = await import(
      "@/lib/notifications.server"
    );
    await createAndQueueNotification({
      userId: context.userId,
      title: "Assessment submitted",
      body: released
        ? `Your auto-score is ${graded.autoScore} of ${graded.totalPoints}.`
        : "Your paper was submitted. Results will be released by your teacher.",
      kind: "assessment",
      link: "/assessments",
      schoolId: assessment.school_id,
      createdAt: now,
    });
    void dispatchNotifications();
    return {
      autoScore: released ? graded.autoScore : 0,
      totalPoints: graded.totalPoints,
      manualPending: graded.manualPending,
      alreadySubmitted: false,
      resultsReleased: released,
    };
  });

export const markAssessmentAttempt = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => MarkAttemptSchema.parse(data))
  .handler(async ({ data, context }) => {
    const attempt = await adminGetById<AttemptDoc>(
      COLLECTIONS.assessmentSubmissions,
      data.attemptId,
    );
    if (!attempt) throw new Error("Attempt not found.");
    const assessment = await adminGetById<AssessmentDoc>(
      COLLECTIONS.assessments,
      attempt.assessment_id,
    );
    if (!assessment) throw new Error("Assessment not found.");
    await assertManagesAssessment(context, assessment);
    const questions = await adminWhere<QuestionDoc>(
      COLLECTIONS.assessmentQuestions,
      "assessment_id",
      "==",
      assessment.id,
    );
    const qById = new Map(questions.map((q) => [q.id, q]));
    const priv = await adminGetById<PrivateResult>(COLLECTIONS.assessmentResultPrivate, attempt.id);
    const marks = { ...(priv?.question_marks ?? attempt.question_marks ?? {}) };
    for (const row of data.marks) {
      const q = qById.get(row.question_id);
      if (!q) continue;
      marks[row.question_id] = Math.min(q.points, Math.max(0, row.points));
    }
    const total = questions.reduce((s, q) => s + q.points, 0);
    const scored = Object.values(marks).reduce((s, n) => s + n, 0);
    const now = new Date().toISOString();
    const passed = total ? scored / total >= (assessment.passing_score ?? 50) / 100 : false;
    const topicScores = questions
      .filter((q) => q.topic_id)
      .map((q) => ({ topic_id: q.topic_id as string, points: marks[q.id] ?? 0, max: q.points }));
    const released = resultsArePublic(assessment);
    const status = data.finalize ? "graded" : "awaiting_manual";
    await adminSet(COLLECTIONS.assessmentResultPrivate, attempt.id, {
      school_id: assessment.school_id,
      attempt_id: attempt.id,
      student_id: attempt.student_id,
      assessment_id: assessment.id,
      auto_score: priv?.auto_score ?? attempt.auto_score ?? 0,
      manual_score: scored,
      total_points: total,
      question_marks: marks,
      passed,
      topic_scores: topicScores,
      summary_applied: released && data.finalize ? true : (priv?.summary_applied ?? false),
      updated_at: now,
    });
    await adminUpdate(COLLECTIONS.assessmentSubmissions, attempt.id, {
      total_points: total,
      status,
      marked_by: context.userId,
      marked_at: now,
      updated_at: now,
      ...(released
        ? {
            question_marks: marks,
            manual_score: scored,
            auto_score: priv?.auto_score ?? scored,
            passed,
          }
        : {}),
    });
    if (data.finalize && released && !priv?.summary_applied) {
      await applyAttemptToSummary({
        studentId: attempt.student_id,
        schoolId: assessment.school_id,
        subjectId: assessment.subject_id ?? null,
        score: scored,
        total,
        topicScores,
      });
    }
    return { ok: true as const, score: scored, total };
  });

export const logAssessmentIntegrity = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => IntegrityEventSchema.parse(data))
  .handler(async ({ data, context }) => {
    const attempt = await adminGetById<AttemptDoc>(
      COLLECTIONS.assessmentSubmissions,
      data.attemptId,
    );
    if (!attempt || attempt.student_id !== context.userId) throw new Error("Attempt not found.");
    const existing = await adminWhere<{ attempt_id: string }>(
      COLLECTIONS.assessmentIntegrityEvents,
      "attempt_id",
      "==",
      attempt.id,
    );
    if (existing.length >= 40) return { ok: true as const, capped: true };
    await adminCreate(COLLECTIONS.assessmentIntegrityEvents, {
      attempt_id: attempt.id,
      assessment_id: attempt.assessment_id,
      student_id: context.userId,
      school_id: attempt.school_id,
      event: data.event,
      created_at: new Date().toISOString(),
    });
    return { ok: true as const, capped: false };
  });

export const generateRevisionPlan = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    if (context.role !== "student") throw new Error("Revision plans are for students.");
    const summary = await loadSummary(context.userId);
    const weak = weakAreas(summary);
    if (!summary || summary.graded_count < 2 || weak.length === 0) {
      return {
        insufficient: true,
        items: [] as Array<{ title: string; reason: string; subjectId: string | null }>,
        message:
          "Not enough marked work yet to recommend a revision path. Complete at least two graded assessments.",
      };
    }
    const items = await Promise.all(
      weak.map(async (w) => ({
        title: w.scope === "subject" ? await subjectName(w.key) : await topicName(w.key),
        reason: `${w.percent}% across ${w.attempts} attempts — treat as a likely focus, not a certainty.`,
        subjectId: w.scope === "subject" ? w.key : null,
        priority: w.percent < 40 ? "high" : "medium",
      })),
    );
    await adminCreate(COLLECTIONS.revisionPlans, {
      student_id: context.userId,
      school_id: context.schoolId,
      items,
      status: "active",
      created_at: new Date().toISOString(),
    });
    return { insufficient: false, items, message: null };
  });

export const ownerAssessmentQuestions = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => AssessmentIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const assessment = await adminGetById<AssessmentDoc>(
      COLLECTIONS.assessments,
      data.assessmentId,
    );
    if (!assessment) throw new Error("Assessment not found.");
    await assertManagesAssessment(context, assessment);
    const questions = await adminWhere<QuestionDoc>(
      COLLECTIONS.assessmentQuestions,
      "assessment_id",
      "==",
      assessment.id,
    );
    questions.sort((a, b) => a.position - b.position);
    const keys = await adminWhere<{ question_id: string; correct_answer: string | null }>(
      COLLECTIONS.assessmentAnswerKeys,
      "assessment_id",
      "==",
      assessment.id,
    );
    const keyByQ = new Map(keys.map((k) => [k.question_id, k.correct_answer ?? null]));
    return questions.map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
      correct_answer: keyByQ.get(q.id) ?? null,
    }));
  });

export const listLinkedChildResults = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => ChildIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (context.role !== "parent") throw new Error("Only a linked parent can open this report.");
    const links = await adminWhere<{ parent_id: string; student_id: string }>(
      COLLECTIONS.parentStudents,
      "parent_id",
      "==",
      context.userId,
      [["student_id", "==", data.studentId]],
    );
    if (!links.length) throw new Error("That student is not linked to your account.");
    const rows = await adminWhere<AttemptDoc>(
      COLLECTIONS.assessmentSubmissions,
      "student_id",
      "==",
      data.studentId,
    );
    const released = rows.filter((row) => row.submitted_at && row.results_released !== false);
    return Promise.all(
      released.map(async (row) => {
        const assessment = await adminGetById<{ title?: string; subject_id?: string | null }>(
          COLLECTIONS.assessments,
          row.assessment_id,
        );
        const subject = assessment?.subject_id
          ? await adminGetById<{ name?: string }>(COLLECTIONS.subjects, assessment.subject_id)
          : null;
        const score = Number(row.manual_score ?? row.auto_score ?? 0);
        const total = Number(row.total_points || 0);
        return {
          label: assessment?.title ?? "Assessment",
          subject: subject?.name ?? "General",
          percent: total ? Math.round((score / total) * 100) : 0,
        };
      }),
    );
  });

export const submitAssessment = submitAssessmentAttempt;
