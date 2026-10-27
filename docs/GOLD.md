# Gold — independent tutoring

Gold is a Memskool marketplace for **independent tutors**, not a second school product.

School teachers keep `school_id` and school classrooms. Gold tutors are stored in `gold_tutors` and never require creating a school. A person can hold both: a school affiliation and an approved Gold profile.

## Flow

1. Any signed-in user applies on `/gold` → Teach.
2. Superadmin reviews on `/gold-admin`.
3. Approved tutors publish classes. Learners discover them on `/gold`.
4. Free classes enrol immediately. Paid classes create a Flutterwave order (`item_kind: gold_class`). Access is granted only after `applyPaymentResult` verifies the webhook.
5. Tutors schedule/start lessons. Join uses the existing LiveKit token path with `classroom_sessions.kind = gold`.
6. Enrolled learners can copy materials into Locker and review only after they attended a live lesson.

## What is not claimed

- Flutterwave does not split settlements to tutors in this integration.
- Ratings are only from eligible attendance-backed reviews.
- Daily.co is not used (the live product is LiveKit).
