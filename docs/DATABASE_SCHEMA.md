# Database schema (Firestore)

Collection IDs keep the old Postgres snake_case names. Document IDs are Firestore auto-ids unless noted.

| Collection | Doc id | Purpose |
| --- | --- | --- |
| `users` | Firebase uid | Profile + `role` + `school_id` |
| `schools` | auto | School record |
| `school_directory` | school **code** | Public, non-sensitive lookup |
| `school_members` | auto | Membership / approval |
| `school_roster` | auto | Institution roster |
| `classes` | auto | Class |
| `class_enrollments` | auto | `class_id`, `student_id`, `school_id` |
| `subjects` | auto | Catalogue |
| `timetable_slots` | auto | Weekly grid |
| `attendance` | auto | Presence |
| `assignments` / `submissions` | auto | Homework |
| `assessments` | auto | Paper + type/status/policy |
| `assessment_questions` | auto | Prompts **without** answer keys |
| `assessment_answer_keys` | question id | Keys (Admin only) |
| `assessment_submissions` | auto | Attempts; public scores only after release |
| `assessment_result_private` | attempt id | Unreleased scores (staff read) |
| `question_bank` | auto | School-scoped reusable questions |
| `performance_summaries` | student uid | Incremental subject/topic rollup |
| `revision_plans` | auto | Deterministic revision lists |
| `assessment_integrity_events` | auto | Exam session events |
| `locker_folders` / `locker_items` | auto | Personal locker |
| `library_books` | auto | School library |
| `missed_work` | auto | Catch-up items |
| `classroom_sessions` | auto | Live class (Memskool session; `provider_room` is LiveKit) |
| `classroom_participants` | `{sessionId}_{userId}` | Join / presence / duration |
| `classroom_messages` | auto | Session-scoped chat (Admin SDK writes) |
| `live_session_events` | provider event id | LiveKit webhook idempotency |
| `conversations` / `conversation_members` / `messages` | auto | Chat |
| `notifications` | auto | In-app alerts (client cannot create) |
| `notification_preferences` | uid | Email / SMS toggles |
| `notification_deliveries` | auto | Outbound queue (Admin only) |
| `fcm_tokens` | `{uid}_{suffix}` | Device tokens |
| `parent_students` | `{parentUid}_{studentUid}` | Parent–student link (`school_id` required). Older auto-ids do not unlock parent reads until re-linked. |
| `user_relations` | auto | Mute / block (`target_id`) |
| `disciplinary_actions` | auto | Warnings / suspensions |
| `reward_events` | auto | Points |
| `marketplace_items` / `orders` | auto | Shop |
| `payment_events` | `{txRef}:{id}:{status}` | Webhook idempotency |
| `school_applications` | auto | Admissions (`student_id`) |
| `school_meetings` | auto | PTA / AGM |
| `study_reminders` | auto | Personal reminders |
| `ai_insights` | auto | Dashboard cards (Admin create) |
| `learning_profiles` | uid | Student learning memory |
| `signup_requests` | uid | Pending teacher approval |
| `audit_logs` | auto | Privileged trail (Admin write) |
| `academic_years` | auto | School academic year |
| `academic_periods` | auto | Term / semester / quarter / period |
| `curricula` | auto | Curriculum container |
| `curriculum_levels` | auto | Grade or level |
| `curriculum_topics` | auto | Topic / subtopic (`parent_id`) |
| `curriculum_objectives` | auto | Learning objective |
| `class_teacher_assignments` | auto | Teacher + class + subject |
| `lessons` | auto | Lesson lifecycle |
| `lesson_materials` | auto | Lesson attachments |
| `ai_conversations` | auto | Owner-scoped tutor threads |
| `ai_messages` | auto | User/assistant turns |
| `ai_learning_memory` | auto | Short educational memory |
| `ai_usage` | `{uid}_{date}` | Daily request counters |
| `ai_rate_limits` | uid | Sliding window (Admin only) |

Field names stay snake_case (`class_id`, `created_at`, …) so UI types barely change.

Compound indexes are in `firestore.indexes.json`.
