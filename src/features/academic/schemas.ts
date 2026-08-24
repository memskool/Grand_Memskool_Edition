import { z } from "zod";
import {
  PERIOD_LABELS,
  CLASS_STATUSES,
  SUBJECT_STATUSES,
  LESSON_STATUSES,
  ASSIGNMENT_STATUSES,
  ATTENDANCE_STATUSES,
  MISSED_WORK_STATUSES,
} from "@/types/academic";

export const YearSchema = z.object({
  name: z.string().trim().min(2).max(80),
  starts_on: z.string().min(8).max(32),
  ends_on: z.string().min(8).max(32),
});

export const PeriodSchema = z.object({
  academic_year_id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  label: z.enum(PERIOD_LABELS),
  starts_on: z.string().min(8).max(32),
  ends_on: z.string().min(8).max(32),
});

export const SubjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(24),
  description: z.string().trim().max(2000).nullable(),
  level: z.string().trim().max(80).nullable(),
  curriculum_id: z.string().min(1).nullable(),
  status: z.enum(SUBJECT_STATUSES).default("active"),
});

export const CurriculumSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable(),
});

export const TopicSchema = z.object({
  curriculum_id: z.string().min(1),
  level_id: z.string().min(1).nullable(),
  subject_id: z.string().min(1).nullable(),
  parent_id: z.string().min(1).nullable(),
  name: z.string().trim().min(1).max(200),
  sort_order: z.number().int().min(0).max(9999),
});

export const ClassSchema = z.object({
  name: z.string().trim().min(1).max(80),
  room: z.string().trim().max(40).nullable(),
  subject_id: z.string().min(1).nullable(),
  teacher_id: z.string().min(1).nullable(),
  academic_year_id: z.string().min(1).nullable(),
  academic_period_id: z.string().min(1).nullable(),
  status: z.enum(CLASS_STATUSES).default("active"),
});

export const EnrollSchema = z.object({
  class_id: z.string().min(1),
  student_id: z.string().min(1),
});

export const TeacherAssignSchema = z.object({
  class_id: z.string().min(1),
  subject_id: z.string().min(1),
  teacher_id: z.string().min(1),
});

export const SlotSchema = z.object({
  class_id: z.string().min(1),
  subject_id: z.string().min(1).nullable(),
  teacher_id: z.string().min(1).nullable(),
  academic_period_id: z.string().min(1).nullable(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().trim().max(40).nullable(),
});

export const LessonSchema = z.object({
  class_id: z.string().min(1),
  subject_id: z.string().min(1).nullable(),
  academic_period_id: z.string().min(1).nullable(),
  timetable_slot_id: z.string().min(1).nullable(),
  curriculum_topic_id: z.string().min(1).nullable(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(8000).nullable(),
  starts_at: z.string().min(8).max(40).nullable(),
  duration_minutes: z.number().int().min(5).max(480).nullable(),
  status: z.enum(LESSON_STATUSES),
});

export const AssignmentCreateSchema = z.object({
  class_id: z.string().min(1),
  subject_id: z.string().min(1).nullable(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(8000).nullable(),
  due_at: z.string().min(8).max(40).nullable(),
  points: z.number().int().min(0).max(10000),
  status: z.enum(ASSIGNMENT_STATUSES),
  allow_resubmit: z.boolean(),
});

export const SubmitSchema = z.object({
  assignment_id: z.string().min(1),
  text_body: z.string().max(20000).nullable(),
  storage_paths: z.array(z.string().max(1024)).max(8),
});

export const AttendanceSchema = z.object({
  lesson_id: z.string().min(1),
  marks: z
    .array(
      z.object({
        student_id: z.string().min(1),
        status: z.enum(ATTENDANCE_STATUSES),
      }),
    )
    .min(1)
    .max(80),
});

export const MissedWorkAssignSchema = z.object({
  student_id: z.string().min(1),
  lesson_id: z.string().min(1).nullable(),
  class_id: z.string().min(1).nullable(),
  subject_id: z.string().min(1).nullable(),
  assignment_id: z.string().min(1).nullable(),
  material_id: z.string().min(1).nullable(),
  title: z.string().trim().min(1).max(200),
});

export const MissedWorkProgressSchema = z.object({
  id: z.string().min(1),
  status: z.enum(MISSED_WORK_STATUSES),
});
