---
paths:
  - "firestore.rules"
  - "storage.rules"
  - "firestore.indexes.json"
---

# Rules

- Default deny. Prefer `managesSchool` / `tenantWrite` / `tenantRead` over ad-hoc role checks.
- `tenantWrite` allows school owners even with stale admin claims (`managesSchool`).
- Do not weaken rules to paper over missing claims — heal claims server-side instead.
- Storage: `home/{uid}` and `gold/{tutorId}` are not world-readable; published media uses signed URLs.
- Deploy Storage rules only after Firebase Console → Storage → Get Started on the project.
