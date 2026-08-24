# Class membership

`class_enrollments` is the membership ledger.

| Field                                     | Role                                |
| ----------------------------------------- | ----------------------------------- |
| `student_id`, `class_id`, `school_id`     | Identity                            |
| `status`                                  | `active` or `ended`                 |
| `started_at` / `ended_at`                 | History                             |
| `academic_year_id` / `academic_period_id` | Copied from the class at enrol time |

`enrollStudent` (Admin SDK) rejects cross-school students, archived classes, and duplicate **active** rows. Ending membership updates status; it does not delete the row.

Current class: `status != ended`. Previous classes: `status == ended`.

Teacher access uses `class_teacher_assignments` plus legacy `classes.teacher_id`.
