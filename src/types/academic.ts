export const PERIOD_LABELS = ["Term", "Semester", "Quarter", "Period"] as const;
export type PeriodLabel = (typeof PERIOD_LABELS)[number];

export const CLASS_STATUSES = ["active", "archived"] as const;
export type ClassStatus = (typeof CLASS_STATUSES)[number];

export const MEMBERSHIP_STATUSES = ["active", "ended"] as const;
export type ClassMembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const SUBJECT_STATUSES = ["active", "archived"] as const;
export type SubjectStatus = (typeof SUBJECT_STATUSES)[number];

export const LESSON_STATUSES = [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const ASSIGNMENT_STATUSES = ["draft", "published", "closed"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const SUBMISSION_STATUSES = ["submitted", "late", "returned", "graded"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const MISSED_WORK_STATUSES = ["pending", "in_progress", "completed"] as const;
export type MissedWorkStatus = (typeof MISSED_WORK_STATUSES)[number];

export type AcademicYear = {
  id: string;
  school_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  created_at: string;
  updated_at: string;
};

export type AcademicPeriod = {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  label: PeriodLabel;
  starts_on: string;
  ends_on: string;
  created_at: string;
  updated_at: string;
};

export type Curriculum = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type CurriculumLevel = {
  id: string;
  school_id: string;
  curriculum_id: string;
  name: string;
  sort_order: number;
};

export type CurriculumTopic = {
  id: string;
  school_id: string;
  curriculum_id: string;
  level_id: string | null;
  subject_id: string | null;
  parent_id: string | null;
  name: string;
  sort_order: number;
};

export type CurriculumObjective = {
  id: string;
  school_id: string;
  topic_id: string;
  statement: string;
  sort_order: number;
};

export type AcademicSubject = {
  id: string;
  school_id: string;
  name: string;
  code: string;
  description: string | null;
  level: string | null;
  curriculum_id: string | null;
  status: SubjectStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AcademicClass = {
  id: string;
  school_id: string;
  name: string;
  room: string | null;
  subject_id: string | null;
  teacher_id: string | null;
  academic_year_id: string | null;
  academic_period_id: string | null;
  status: ClassStatus;
  created_at: string;
  updated_at: string;
};

export type ClassEnrollment = {
  id: string;
  school_id: string;
  class_id: string;
  student_id: string;
  academic_year_id: string | null;
  academic_period_id: string | null;
  status: ClassMembershipStatus;
  started_at: string;
  ended_at: string | null;
};

export type ClassTeacherAssignment = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  status: ClassMembershipStatus;
  started_at: string;
  ended_at: string | null;
};

export type TimetableSlot = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string | null;
  academic_period_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  created_at: string;
};

export type Lesson = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string;
  academic_period_id: string | null;
  timetable_slot_id: string | null;
  curriculum_topic_id: string | null;
  title: string;
  description: string | null;
  starts_at: string | null;
  duration_minutes: number | null;
  status: LessonStatus;
  classroom_session_id: string | null;
  recording_ref: string | null;
  created_at: string;
  updated_at: string;
};

export type LessonMaterial = {
  id: string;
  school_id: string;
  lesson_id: string;
  title: string;
  kind: "file" | "link" | "note";
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  created_by: string;
  created_at: string;
  locker_ref: string | null;
};

export type AcademicAssignment = {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  points: number;
  status: AssignmentStatus;
  allow_resubmit: boolean;
  created_at: string;
  updated_at: string;
};

export type AcademicSubmission = {
  id: string;
  school_id: string;
  assignment_id: string;
  student_id: string;
  class_id: string | null;
  status: SubmissionStatus;
  text_body: string | null;
  storage_paths: string[];
  submitted_at: string;
  late: boolean;
  feedback: string | null;
  grade: number | null;
  updated_at: string;
};

export type AcademicAttendance = {
  id: string;
  school_id: string;
  lesson_id: string | null;
  class_id: string | null;
  student_id: string;
  status: AttendanceStatus;
  recorded_by: string;
  recorded_at: string;
  date: string;
};

export type AcademicMissedWork = {
  id: string;
  school_id: string;
  student_id: string;
  lesson_id: string | null;
  class_id: string | null;
  subject_id: string | null;
  assignment_id: string | null;
  material_id: string | null;
  title: string;
  status: MissedWorkStatus;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  lesson_date: string;
  reviewed: boolean;
  reviewed_at: string | null;
  released_to_locker: boolean;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  category: string | null;
};
