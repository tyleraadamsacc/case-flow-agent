---
version: 0.1.0
task: qa_guardrail
output_schema: QaValidationResult (PR 8)
status: placeholder — no live model integration exists in this codebase
---

# qa_guardrail (placeholder)

Prompt content arrives with the Gemini-backed implementation (plan §15,
PR 8). Deterministic behavior remains the default and the fallback; model
output must validate against the schema above (one repair attempt, then
block for human review). Synthetic data only. The model never finalizes,
approves, sends, or releases anything.
