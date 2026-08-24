# Results architecture

A result is the graded attempt plus policy flags.

Visible to the student when `results_released !== false` (always true for practice). Until then the UI shows “Pending release” and scores are omitted from the attempt document.

`releaseAssessmentResults` copies private scores onto attempts, notifies submitters, and applies performance summaries that were held back.

`reveal_answers` is stored for future key reveal. Students still cannot read `assessment_answer_keys`. Answer-key reveal after release is **not** implemented.

Parents see released child scores only through `listLinkedChildResults` (Admin SDK checks `parent_students`). They cannot query another child’s attempts.
