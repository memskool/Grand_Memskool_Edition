# Firestore indexes (Phase 3)

File: `firestore.indexes.json`. Deploy with `firebase deploy --only firestore:indexes` after review.

Phase 3 additions (collection group, COLLECTION scope):

| Collection                  | Fields                                      |
| --------------------------- | ------------------------------------------- |
| `academic_years`            | `school_id` ASC, `starts_on` DESC           |
| `academic_periods`          | `school_id` ASC, `starts_on` ASC            |
| `academic_periods`          | `academic_year_id` ASC, `starts_on` ASC     |
| `subjects`                  | `school_id` ASC, `name` ASC                 |
| `classes`                   | `school_id` ASC, `status` ASC, `name` ASC   |
| `class_enrollments`         | `student_id` ASC, `status` ASC              |
| `class_enrollments`         | `class_id` ASC, `status` ASC                |
| `class_teacher_assignments` | `teacher_id` ASC, `status` ASC              |
| `class_teacher_assignments` | `class_id` ASC, `status` ASC                |
| `lessons`                   | `class_id` ASC, `starts_at` ASC             |
| `lessons`                   | `teacher_id` ASC, `starts_at` ASC           |
| `lesson_materials`          | `lesson_id` ASC, `created_at` ASC           |
| `assignments`               | `school_id` ASC, `status` ASC, `due_at` ASC |
| `submissions`               | `assignment_id` ASC, `submitted_at` DESC    |
| `attendance`                | `lesson_id` ASC, `student_id` ASC           |
| `missed_work`               | `student_id` ASC, `status` ASC              |
| `curricula`                 | `school_id` ASC, `name` ASC                 |
| `curriculum_topics`         | `curriculum_id` ASC, `sort_order` ASC       |

Phase 4:

| Collection             | Fields                                           |
| ---------------------- | ------------------------------------------------ |
| `ai_conversations`     | `owner_id` ASC, `last_activity_at` DESC          |
| `ai_messages`          | `conversation_id` ASC, `created_at` ASC          |
| `ai_learning_memory`   | `owner_id` ASC, `created_at` DESC                |

Phase 5:

| Collection             | Fields                                |
| ---------------------- | ------------------------------------- |
| `classroom_sessions`   | `class_id` ASC, `started_at` DESC     |
| `attendance`           | `session_id` ASC, `student_id` ASC    |

Existing indexes from Phase 1 remain (including `classroom_sessions` `class_id` + `is_active`). They are not listed again here.

Phase 6:

| Collection | Fields |
| --- | --- |
| `assessment_submissions` | `assessment_id` ASC, `student_id` ASC |
| `question_bank` | `school_id` ASC, `created_at` DESC |
| `revision_plans` | `student_id` ASC, `created_at` DESC |
| `assessment_integrity_events` | `attempt_id` ASC, `created_at` ASC |
| `parent_students` | `parent_id` ASC, `student_id` ASC |

Phase 7:

| Collection | Fields |
| --- | --- |
| `messages` | `conversation_id` ASC, `created_at` DESC |
| `marketplace_items` | `school_id` ASC, `active` ASC, `created_at` DESC |
