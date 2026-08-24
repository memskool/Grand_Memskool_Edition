# Performance intelligence

Dashboards do not recalculate the school on every load.

## Incremental summaries

`performance_summaries/{studentId}` is updated when a **released** attempt is graded (`applyAttemptToSummary`). Buckets: `by_subject`, `by_topic`, `graded_count`.

Weakness rule: **at least two** attempts in that bucket **and** percent **< 60**. One question or one paper is not treated as a proven weakness.

## Charts

`usePerformanceTrend` reads the student’s released submissions (not a full school scan). Teacher analytics average submissions per paper the teacher created and count how many sit below 50% — a private support signal, not a public rank.

## Cost

Summaries are event-driven on mark/release. No scheduled Cloud Function (Spark). Teacher stats still read submissions per paper; that is acceptable at current class size and is documented as the trade-off versus a second rollup collection.
