# AI request contracts

Validated by `TutorTurnSchema` in `src/features/ai-tutor/contracts.ts`.

Fields: `intent`, `message` (1–8000 chars), `conversation_id`, `subject_id`, `lesson_id`, `assignment_id`, `missed_work_id`, `topic_id`, `image_path`.

All ids are optional nulls. The server loads documents and checks school + enrollment/ownership. Client-supplied school or student ids are not accepted.
