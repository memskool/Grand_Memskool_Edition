# AI capabilities

| Capability | Status |
| --- | --- |
| `ai_tutor` | Operational architecture; live Crane5 needs env |
| `document_context` | Short authorized excerpts |
| `learning_memory` | Owner create/list/delete |
| `voice_input` | Browser speech-to-text → text intent `VOICE_QUERY` |
| `speech_output` | Browser `speechSynthesis` on tap |
| `image_analysis` | Rejected unless `CRANE5_VISION=true` |
| `ocr` / `EXTRACT_TEXT` | Disabled until Crane5 publishes OCR |

Intents: CHAT, EXPLAIN, TEACH, SOLVE, REVISE, ANALYZE_IMAGE, EXTRACT_TEXT, VOICE_QUERY, ASSIGNMENT_HELP, MISSED_WORK_HELP.

Assignment policy foundation on assignment docs (`ai_policy`) defaults to `explanation_only`.
