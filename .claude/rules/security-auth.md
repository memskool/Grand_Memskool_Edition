---
paths:
  - "src/lib/firebase/**/*"
  - "src/features/auth/**/*"
  - "src/lib/members.server.ts"
  - "src/lib/applications.server.ts"
  - "src/lib/school-register.server.ts"
  - "src/features/academic/academic.server.ts"
---

# Auth & privilege

- Custom claims (`role`, `schoolId`, `approved`) are the sole privilege source for deny/allow.
- Map claim `admin` → app role `institution` via `claimsRoleToAppRole`.
- School-operator gates use `requireSchoolManagerContext` (heal stale JWT when profile + ownership/staff prove manager).
- Sensitive Admin token verify uses `checkRevoked: true`.
- Never grant manage rights from bare `uid === schoolId` without a real `schools/{id}` ownership check.
- Do not put secrets in `VITE_*` env vars.
