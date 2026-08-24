# Assessment error handling

User-facing copy comes from `authErrorMessage` / `classifyFirebase`. Server functions throw generic permission or validation strings. Stack traces, rules, and keys are not returned.

| Failure | Behaviour |
| --- | --- |
| Start denied | Toast; paper does not open |
| Save failed | “Save failed — retrying”; integrity `save_failed`; last successful answers remain on the server |
| Submit fails | `submittedRef` resets; student can retry; duplicate submit is idempotent |
| Time up | Auto-submit; if submit fails, student can retry with the Submit button |
| Clock poll fails | Display uses last `ends_at` / `remaining_ms`; server still rejects late saves after grace |
| Marking fails | Toast; private scores unchanged |
| Revision / AI fails | Toast / existing AI error path; no silent mark overwrite |
| Empty paper | Shield message; cannot publish without questions |

Students always see a clear submitted confirmation screen when submit succeeds, including when scores are withheld.
