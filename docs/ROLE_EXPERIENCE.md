# Role experience

| Role | Claim stored | Landing | Navigation |
| --- | --- | --- | --- |
| student | `student` | `StudentDashboard` | Student destinations in `nav.ts` |
| teacher | `teacher` | `TeacherDashboard` (pending empty state until approved) | Teaching tools after approval |
| parent | `parent` | `ParentDashboard` | Follow-only destinations; empty state if no children |
| institution | `admin` | `InstitutionDashboard` | School operator + school admin |
| admin | `admin` → UI `institution` | `AdminDashboard` only if stored UI role is `admin` | Same school-operator family |
| superadmin | `superadmin` | `SuperadminDashboard` | **Dashboard + Settings only** |

## Protection

- Client: `canAccessRoute` + `RouteGuard`. Pending teachers: `/dashboard`, `/messages`, `/settings`.
- Server: Firestore rules and `requireFirebaseAuth` on privileged functions.
- Approving a teacher now runs `setSchoolMemberStatus`, which updates membership, `users.membership_status`, custom claims `approved`, and notifies the teacher.

Superadmin is not treated as a school owner. The platform dashboard does not load another school’s private overview.
