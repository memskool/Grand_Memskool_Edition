# Authorization

## Claims

| Claim | Meaning |
| --- | --- |
| `role` | `student`, `teacher`, `parent`, `admin` (institution UI), `superadmin` |
| `schoolId` | Tenant id; empty until a school is joined/created |
| `approved` | Teachers need `true` for school teaching tools; other roles treated as approved in rules |

`claimsRoleToAppRole` maps claim `admin` → UI `institution`.

`PRIVILEGED_ROLES` / `isSchoolManager`: `admin` \| `institution` \| `superadmin`.

## Who can do what (product)

| Action | Allowed |
| --- | --- |
| Join school by code | Authenticated; teachers stay `pending` until approved |
| Approve applications / members | School manager of that school (server path stamps `reviewed_by`) |
| Admit to roll | Approve application → `school_members` + claims (does **not** enrol into a class) |
| Enrol / assign | School manager; on-roll checks; deterministic ids (`classId_studentId`, `classId_teacherId_subjectId`) |
| Start live class | Assigned teacher (approved) or school manager; one live room per class |
| LiveKit token | Same join authz as Firestore (enrollment / Gold / assignment + not suspended) |
| Screen share | Host or school manager |
| End / cancel live | Host or school manager; always finalizes attendance when school session |
| Parent link | School manager; both must be **approved** members |
| Broadcast announcement | Teacher (own class) or school admin (school-wide) |
| Directory people-picker | Same `school_id` only |

## Isolation

Rules use `sameSchool(schoolId)` plus ownership fields. Missing or mismatched `school_id` fails tenant checks. Gold live uses a synthetic `school_id` of `gold_{tutorId}` plus enrolment checks.

## UI gating

`src/lib/nav.ts` + `RouteGuard` hide routes. **Not** a security boundary — server + rules enforce truth.

Pending teachers: `PENDING_SCHOOL_LOCK` removes school teaching destinations from nav and `canAccessRoute`. Gold and Home studio remain available.
