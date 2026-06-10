# CaseFlow Agent — Story Capture Backend Reuse Analysis Instructions v2

## Purpose

Before scaffolding CaseFlow, Codex should inspect the existing AI Story Capture backend and determine what can be reused.

Target repo:

```text
/Users/tyler.a.adams/AxARepos/ai-story-capture-develop-worktree
```

Known details:

- linked git worktree
- branch: `develop`
- commit: `3ff4fbc`

## Updated CaseFlow target

CaseFlow is now:

> LERS request intake → extraction → triage → route/escalation → mock ETL → response package draft → human review → governance insights.

It is not story capture and not a conversational interview app.

## Useful reuse areas

Likely reusable:

- FastAPI app setup
- config handling
- logging / request IDs
- `google-genai` wrapper
- model router
- prompt loader
- structured output validation
- repair/retry logic
- Firestore repository pattern
- Cloud Storage repository pattern
- Agent Search / retrieval abstraction
- IAP/auth pattern
- eval/golden-test pattern
- Docker / Cloud Run setup

## Do not reuse

- story schemas
- interview flow logic
- coverage map logic
- story output contracts
- Jen Tanner tone prompts
- contributor session concepts unless generalized
- anything that makes CaseFlow feel like a story/interview app

## Required output

Codex should write:

```text
CASEFLOW_REUSE_ANALYSIS.md
```

at the Story Capture repo root.

## Required sections

1. Executive summary
2. Repo inventory
3. Architecture summary
4. Reusable backend patterns
5. Direct copy candidates
6. Adapt candidates
7. Pattern-only areas
8. Do-not-reuse list
9. CaseFlow backend target architecture recommendation
10. Story Capture → CaseFlow data model mapping
11. Agent and prompt reuse mapping
12. API reuse mapping
13. Test reuse strategy
14. Deployment and infra reuse strategy
15. Risks, gaps, and open questions
16. Recommended extraction/copy plan
17. Final recommendation

## Hard constraints

- Do not modify app code.
- Do not refactor.
- Do not create branches.
- Do not commit.
- Do not push.
- Do not change dependencies.
- Do not run migrations.
- Do not deploy.
- Write only the analysis doc.
