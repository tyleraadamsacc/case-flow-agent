# CaseFlow Demo Walkthrough

Use these annotated screenshots as slide images in order. The demo path is intentionally linear: click the highlighted control, explain the visible result, then move to the next slide.

Demo request: `LER-2026-004812`

## Slide Script

| Step | Image | Demoer action | What to say / expected result |
| --- | --- | --- | --- |
| 1 | `demo-flow-step-01-open-request.png` | Click the `LER-2026-004812` request row from `/requests`. | This opens the guided request workspace. The reviewer does not need to choose a tab first; the page tells them the next required action. |
| 2 | `demo-flow-step-02-extract-request.png` | Click `Extract request`. | CaseFlow parses the source document into structured fields and logs an extraction audit event. |
| 3 | `demo-flow-step-03-validate-request.png` | Click `Validate request`. | The app validates extracted fields, source-backed identifiers, special handling, deficiencies, and review policy. |
| 4 | `demo-flow-step-04-run-gemini-agents.png` | Click `Run six-agent workflow`. | This starts the synthetic Gemini-style six-agent workflow. The outputs are still draft-only until a human records a decision. |
| 5 | `demo-flow-step-05-watch-live-gemini-run.png` | Wait. Do not click away. | The live panel shows observable agent activity, tool steps, timing, and receipts. When the run finishes, the page refreshes the persisted outputs. |
| 6 | `demo-flow-step-06-open-agent-output.png` | Click `Open ETL Agent output`. | The seeded demo includes an ETL blocker, so the next step is to inspect that agent output rather than approving blindly. |
| 7 | `demo-flow-step-07-review-agent-workspace.png` | Review the agent workspace. | Show that agent outputs, risk flags, evidence links, and audit context are visible in one workspace. Human review remains in control. |
| 8 | `demo-flow-step-08-click-inspect-evidence.png` | Click `Inspect evidence`. | Before deciding, the reviewer should inspect the source material behind the agent findings. |
| 9 | `demo-flow-step-09-evidence-workspace.png` | Confirm the source-backed evidence. | Point out the source document on the left and extracted fields on the right. This is where the reviewer verifies what the agents relied on. |
| 10 | `demo-flow-step-10-open-decision-panel.png` | Click `Open decision panel`. | This moves the reviewer to the human-only decision controls. |
| 11 | `demo-flow-step-11-escalate-to-sme.png` | Click `Escalate to SME`. | For this seeded blocker, escalation is the clean demo decision because the ETL Agent blocker cannot be cleared by approval alone. |
| 12 | `demo-flow-step-12-recorded-handoff.png` | Stop the demo at `Await SME review`. | The request is escalated, the audit event is recorded, and the next owner is clear. |

## Demo Reset

If the live demo state has already been advanced, restart the backend with demo seed-on-start before presenting:

```bash
cd /Users/tyler.a.adams/CaseFlow-next-lane/backend
CASEFLOW_SEED_DATASET=demo CASEFLOW_SEED_ON_STARTUP=true uv run uvicorn app.main:app --host 127.0.0.1 --port 8002
```

Then open:

```text
http://127.0.0.1:5178/requests
```

The clean starting state should show `LER-2026-004812` with next required action `Extract request`.

