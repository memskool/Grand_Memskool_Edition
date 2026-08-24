# AI context architecture

`assembleContext` builds a short pack (capped ~6000 chars):

Role → school presence → subject → curriculum topic → lesson (enrollment required for students) → assignment (+ `ai_policy`) → missed work (owner) → learning profile strengths/weaknesses → up to 6 memory notes.

Missing curriculum falls back to a general explanation instruction. Full PDFs are not inlined.
