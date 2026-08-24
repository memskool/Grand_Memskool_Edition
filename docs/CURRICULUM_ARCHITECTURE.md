# Curriculum architecture

Collections:

- `curricula`
- `curriculum_levels` (grade / form / year group)
- `curriculum_topics` (`parent_id` for subtopics, optional `subject_id` / `level_id`)
- `curriculum_objectives` (schema ready; management UI is topic/level first)

Relationship:

Curriculum → Level → Topic → Subtopic → Learning objective  
Subject documents may point at `curriculum_id`.

No national curriculum dump is bundled. Schools create their own map. Lessons may store `curriculum_topic_id` for later AI, revision, and exams.
