# AI security

- JWT required. Roles: student, teacher (approved), admin.
- Context ids verified against the caller’s `schoolId` claim and enrollment/ownership.
- Conversations and memory: owner-only rules; Admin SDK writes.
- Crane5 key never in `VITE_*`.
- Exam UI still client-only (session). Not a server exam lock.
- Teachers do not get student tutor transcripts.
