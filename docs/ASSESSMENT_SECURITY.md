# Assessment security

The frontend is not the security boundary.

| Threat | Control |
| --- | --- |
| Guess draft id | Students cannot read unpublished papers; start rejects draft/closed |
| Read answer keys | `assessment_answer_keys` client read/write false |
| Client-set score | Attempt writes denied; scores from Admin SDK only |
| Unreleased score leak | Scores in `assessment_result_private` until release |
| Other student’s attempt | Read requires `student_id == uid` or staff `tenantWrite` |
| Other school | Server compares `school_id` to claims; rules use tenant helpers |
| Extra attempts | Counted server-side |
| Teacher edits another school | `assertManagesAssessment` |
| Forged attempt id | Save/submit/clock require `student_id == uid` |
| Parent peeking unlinked child | `listLinkedChildResults` checks `parent_students` |

`ownerAssessmentQuestions` requires school match plus creator, school manager, or class assignment.
