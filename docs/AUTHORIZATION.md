# Authorization

## Claims

| Claim | Meaning |
| --- | --- |
| `role` | `student`, `teacher`, `parent`, `admin` (institution UI), `superadmin` |
| `schoolId` | Tenant id; empty until a school is joined/created |
| `approved` | Teachers must be true; other roles treated as approved in rules |

`claimsRoleToAppRole` maps claim `admin` → UI `institution`.

## Who can do what (product)

| Action | Allowed |
| --- | --- |
| Join a school by code | Authenticated; membership pending for teachers |
| Approve members | Institution / admin of that school |
| Create class / timetable | Teacher (approved) or school admin, same school |
| Grade / publish assessments | Assigned teacher or school admin of that school; Admin SDK |
| Submit assessment | Enrolled student; start/save/submit/clock are server-side |
| Release results | Same staff as publish |
| Parent assessment report | Linked `parent_students` row; released scores only |
| Broadcast announcement | Teacher (own class) or school admin (school-wide) |
| Payments | Signed-in, not suspended; amount from server |
| Live class token | Host, assigned teacher, school admin, or actively enrolled student; session must be live; not suspended |

## Isolation

Rules use `sameSchool(schoolId)` plus ownership fields (`owner_id`, `student_id`, `user_id`). Missing `school_id` on a document fails tenant checks.

## UI gating

`src/lib/nav.ts` and `RouteGuard` hide routes. They are convenience, not authorization.
