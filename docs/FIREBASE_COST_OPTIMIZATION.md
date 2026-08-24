# Firebase cost optimisation

Main cost drivers found and addressed:

1. **Collection-wide timetable snapshot** — now school-scoped.
2. **Unbounded `users` scan** on the admin overview — now `school_id` count + `limit(400)`.
3. **Unbounded chat** — last 80 messages.
4. **Student reward self-writes** — removed (also a security issue).
5. **Notification flush storms** — 15s lock per uid.
6. Assessment autosave remains 2.5s debounce (Phase 6), not per keystroke.

Still expensive if abused: teachers querying all class submissions; AI tokens (rate-limited in gateway). Spark Functions are unused, so there is no Functions bill until Blaze.

Do not enable verbose Firestore debug listeners in production.
