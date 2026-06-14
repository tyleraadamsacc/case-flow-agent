# Design

## Source of truth
- Status: Draft
- Last refreshed: 2026-06-12
- Primary product surfaces: Governance, Work Needing Attention, Request Queue, Request Detail, Six-Agent Workflow Rail, Draft Package, Human Review, Audit.
- Evidence reviewed: `frontend/UI_THEME_AND_GEMINI_UX_GUIDE.md`, `caseflow_codex_handoff_docs_v3_six_agent_visibility/11_UI_Workflow_and_Screen_Requirements_v3.md`, `docs/DEMO_WALKTHROUGH.md`, `frontend/src/pages/RequestQueuePage.tsx`, `frontend/src/pages/RequestDetailPage.tsx`, `frontend/src/lib/requestGuidance.ts`, `frontend/src/components/request/ReviewPanel.tsx`, `frontend/src/components/agents/SixAgentWorkflowRail.tsx`, `frontend/src/components/agents/WorkflowConsole.css`, `backend/app/api/routes/legal_requests.py`, `backend/app/api/routes/review.py`, frontend tests under `frontend/src/tests/`.

## Brand
- Personality: calm, explainable, Google/Gemini-inspired legal operations console.
- Trust signals: visible audit events, evidence grounding, official six-agent names, clear synthetic/mock labels, human-only decision language.
- Avoid: chatbot framing, autonomous legal-response claims, hidden agents, dark cockpit UI, generic dashboard clutter, competing primary actions.

## Product goals
- Goals: make the next click obvious from queue selection through extraction, validation, Gemini agent review, human decision, package review, QA, and audit completion.
- Non-goals: adding send/release/disclose workflows, hiding the six RFP agents, replacing human approvals with agent approvals, adding a new design system.
- Success signals: one dominant primary action per request state, action-result feedback after every state-changing click, no dead-end tab switches, tests prove the full guided path.

## Personas and jobs
- Primary personas: legal response analyst, senior analyst/co-signer, QA reviewer, leadership demo viewer.
- User jobs: pick the right request, understand the current workflow state, press the next correct button, inspect Gemini agent output, resolve blockers, record human decisions, prove audit readiness.
- Key contexts of use: leadership demo, analyst review of synthetic LERS requests, exception triage, audit replay.

## Information architecture
- Primary navigation: Governance, Work Needing Attention, Request Queue, Audit, Settings.
- Core routes/screens: `/requests` for work selection, `/requests/:id` for the guided workbench, `/audit` for timeline review, `/governance` for aggregate status.
- Content hierarchy: Request Queue shows priority and next action; Request Detail starts with a command area, then the current task workspace, then supporting tabs/panels.

## Design principles
- Principle 1: One next step owns the screen. Secondary controls can exist, but the dominant action must be singular and state-derived.
- Principle 2: Every click reports its result. Success, refusal, new state, audit event, and next action should be visible without hunting.
- Principle 3: Agents draft, humans decide. Six-agent visibility stays strong, but agent controls should not compete with human review controls.
- Principle 4: Blockers are tasks, not mysteries. A blocker must name what blocks the user, where to inspect it, and what action can resolve it.
- Tradeoffs: dense legal evidence must remain inspectable, but the default path should progressively disclose detail instead of presenting every panel as equally urgent.

## Visual language
- Color: reuse existing tokens in `frontend/src/theme/tokens.css`; blue for the primary guided action, amber for review/attention, red for blockers, green for recorded/complete, violet only for synthetic/mock or restrained agent identity.
- Typography: follow existing Google-like stack and short plain labels from `frontend/UI_THEME_AND_GEMINI_UX_GUIDE.md`.
- Spacing/layout rhythm: keep the current airy console style, but reduce simultaneous control regions on Request Detail.
- Shape/radius/elevation: reuse existing cards, chips, and button primitives; do not add a parallel UI kit.
- Motion: only subtle progress, busy, and newly recorded result feedback; respect reduced motion.
- Imagery/iconography: no decorative imagery required for this console workflow; icons may support button semantics if the existing primitive supports them.

## Components
- Existing components to reuse: `Button`, `Card`, `Chip`, `StatusBadge`, `WorkflowProgress`, `MiniRail`, `SixAgentWorkflowRail`, `ReviewPanel`, `SourceDocumentPanel`, `ExtractedFieldsPanel`, `ResponsePackageView`, `TextDraftView`.
- New/changed components: a guided action controller/shell, result banner or event receipt, step-specific task panel, blocker resolution list, and a clearer queue row CTA.
- Variants and states: idle, busy, succeeded, refused, blocked, disabled-with-reason, stale-after-redraft, awaiting-co-signer, audit-complete.
- Token/component ownership: keep style ownership in `frontend/src/components/agents/WorkflowConsole.css` and shared tokens in `frontend/src/theme/`.

## Accessibility
- Target standard: keyboard-accessible guided workflow with visible focus and screen-reader state descriptions.
- Keyboard/focus behavior: after a state-changing action succeeds, focus moves to the result banner or the next recommended task heading.
- Contrast/readability: preserve badge text labels; do not rely on color-only status.
- Screen-reader semantics: use ordered step lists, `aria-current="step"`, live regions for action results, and disabled-reason text associated with blocked buttons.
- Reduced motion and sensory considerations: no required animation for understanding progress.

## Responsive behavior
- Supported breakpoints/devices: current desktop, medium, and narrow layouts from `WorkflowConsole.css`.
- Layout adaptations: on wide screens, keep supporting panels visible but subordinate; on narrow screens, put the active next-step panel before review/supporting panes.
- Touch/hover differences: touch users must see button labels and disabled reasons without hover-only affordances.

## Interaction states
- Loading: show request-level loading, keep route shell stable, and avoid displaying enabled actions until state is known.
- Empty: queue empty state keeps filters and explains backend seeding.
- Error: refused state-changing actions show the refusing endpoint reason and the next recovery action.
- Success: every state-changing action shows what changed, what audit event was recorded, and what button is next.
- Disabled: disabled buttons must carry a visible reason near the button, not only a disabled style.
- Offline/slow network, if applicable: use existing busy state and add persistent request-level action status.

## Content voice
- Tone: short, concrete, legal-operations safe.
- Terminology: use "Extract request", "Validate request", "Run six-agent workflow", "Review agent output", "Request redraft", "Approve route", "Record approval", "Send to QA", "Audit complete".
- Microcopy rules: each CTA label starts with a verb; every result starts with the action outcome; never imply external sending or agent finalization.

## Implementation constraints
- Framework/styling system: React 18, React Router, Vite, CSS modules-by-convention/global classes, existing primitives.
- Design-token constraints: no new dependency and no new token layer unless implementation proves the existing tokens cannot express the state.
- Performance constraints: avoid extra per-row network calls beyond the existing queue run hydration unless batched server support is added.
- Compatibility constraints: preserve backend human-only finalization and state-machine contracts.
- Test/screenshot expectations: update component tests for step-by-step behavior and run the frontend test/build suite; use screenshots only if implementation changes layout significantly.

## Open questions
- [ ] Should the first post-click result banner expose raw audit event IDs or only human-readable audit summaries? Owner: product/engineering. Impact: audit confidence vs visual density.
- [ ] Should agent acceptance be required before route approval, or remain optional context unless an agent flags human review? Owner: product/legal. Impact: ReviewPanel gating and guidance rules.
- [ ] Should the demo route start at Request Queue or deep-link to the first request? Owner: demo owner. Impact: demo walkthrough and queue CTA prominence.
