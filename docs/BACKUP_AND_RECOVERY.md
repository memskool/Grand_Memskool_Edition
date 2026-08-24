# Backup and recovery

**Not configured or tested in this repository.** Do not assume PITR or scheduled exports exist until a human enables them in Google Cloud / Firebase.

Recommended (Google-first):

1. Firebase Console → Firestore → **Disaster recovery**: enable **Point-in-time recovery** on `(default)` (Enterprise) if the organisation requires it.
2. Schedule a **Firestore managed export** to a GCS bucket in `africa-south1` (daily). Retain per school policy (often 30–90 days for academic records).
3. Storage: object versioning on the default bucket, or a separate backup bucket with lifecycle rules.
4. Auth: export users via `auth:export` before destructive migrations.

## Restore

Restore is a **console / gcloud** operation (`gcloud firestore import`). It overwrites collections. Practice on a copy project first. Memskool app code cannot restore production.

## What is critical

Users, schools, memberships, classes, enrollments, assessments, private results, attendance, orders/`payment_events`. AI memory is owner-scoped and lower priority.

A human must confirm PITR/export in the Firebase console. This phase only documents the requirement.
