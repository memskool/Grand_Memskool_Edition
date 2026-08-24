# AI data model

| Collection | Id | Notes |
| --- | --- | --- |
| `ai_conversations` | auto | owner_id, school_id, title, context_type, timestamps |
| `ai_messages` | auto | conversation_id, owner_id, role, content, intent, status |
| `ai_learning_memory` | auto | owner_id, kind, topic, body |
| `ai_usage` | `{uid}_{yyyy-mm-dd}` | counters (Admin write) |
| `ai_rate_limits` | uid | window_start, count (Admin only) |

Existing `learning_profiles` and `ai_insights` unchanged.
