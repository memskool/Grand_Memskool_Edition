# Assessment architecture

Memskool uses one Assessment Engine for practice, quizzes, class tests, and formal exams. Quizzes and exams are not separate products.

```
ASSESSMENT → CONFIG → QUESTIONS → ATTEMPT → ANSWERS → SUBMIT → MARK → RESULT → SUMMARY → REVISION
```

## Types

| Type | Default timer | Default attempts | Results |
| --- | --- | --- | --- |
| `practice` | Untimed (`time_limit_minutes` 0) | Unlimited (`max_attempts` 0) | Always released |
| `quiz` | Timed if minutes > 0 | Usually 1 | Teacher release flag |
| `test` | Timed | Usually 1 | Teacher release flag; exam-mode nav hide |
| `exam` | Timed | Usually 1 | Teacher release flag; exam-mode nav hide |

Behaviour is configuration on one document, not duplicated collections.

## Privileged path

All create / publish / close / start / save / submit / mark / release / clock / integrity / revision writes go through TanStack server functions + Admin SDK (`src/features/assessment/engine.functions.ts`). Client Firestore writes on these collections are denied.

## Academic links

An assessment stores `school_id`, `class_id`, `subject_id`. Questions may store `topic_id`. Start requires an active class enrollment. Performance summaries roll up subject and topic scores after **released** graded attempts.

## AI

The Phase 4 AI Gateway is used for revision (`AskAiButton` intent `REVISE`). Crane5 is not a marker. AI-assisted marking is **deferred**.
