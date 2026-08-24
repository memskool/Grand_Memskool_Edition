# Revision engine

`generateRevisionPlan` builds a focus list from the student’s performance summary. It does not call Crane5.

If `graded_count < 2` or there are no weak buckets, it returns `insufficient` and a clear message.

Items include title, reason (percent + attempt count, worded as a likely focus), optional `subjectId`, and priority. A `revision_plans` row is stored.

Personalized tutor help uses the existing Phase 4 path: `AskAiButton` with `intent=REVISE` and optional `subject`. The gateway still assembles authorized context only. Assessment answers are not sent to Crane5.
