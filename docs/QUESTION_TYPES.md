# Question types

Implemented and marked:

| Kind | Input | Auto-mark | Manual review |
| --- | --- | --- | --- |
| `multiple_choice` | Single option | Exact option text | No |
| `multiple_select` | JSON array of option texts | Set equality (order ignored) | No |
| `true_false` | `True` / `False` | Exact | No |
| `short_answer` | Text | Normalized match + `accepted` variants | Yes if the student answered and auto-mark failed |
| `long_answer` | Long text | Never | Always |

**Not implemented:** fill in the blank, matching, structured multi-part, KaTeX, question images/attachments.

Renderer: `src/features/assessment/QuestionRenderer.tsx`. Editor lives in `AssessmentBuilder` (not one giant student component).

Short-answer normalization: trim, lowercase, strip punctuation, collapse spaces (`normalizeShort`).
