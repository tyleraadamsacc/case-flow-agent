# CaseFlow UI Theme & Gemini UX Guide

The visual contract for every CaseFlow screen. Built before the business
screens so the direction is locked in, not retrofitted. Implementation
lives in `src/theme/` (tokens) and `src/components/` (primitives);
a living reference renders at `/design-system` in the dev server.

## 1. Design north star

A **Gemini-inspired legal operations console**: calm, polished, airy,
rounded, intelligent, explainable, action-oriented, enterprise-safe, and
clearly Google / Gemini / Material 3 influenced.

The UI supports one product story: LERS request intake → extraction →
indexing → triage/classification → mock ETL → note drafting → response
package drafting → automation action prepared → human review → audit
trail → governance insights. Every design decision serves that story and
the hard requirement behind it: **the six RFP agents are visible,
inspectable, and human-governed.**

## 2. What the UI should feel like

- Gemini-inspired and Google Cloud console-adjacent
- Material 3-based: cards, chips, tonal buttons, rounded nav, subtle elevation
- NotebookLM / Gemini-workspace-like: spacious, document-centric, evidence-backed
- A high-trust legal operations command center
- Intelligence without "magic": every agent output shows status, confidence,
  evidence, and its audit event
- Structure without a spreadsheet: legal data is dense, so the chrome breathes

## 3. What the UI must not feel like

- A generic enterprise dashboard or dense admin table UI
- A chatbot
- Accenture slideware, Salesforce, ServiceNow, or generic SaaS
- A rainbow: gradients are accents, never wallpaper
- An "agent zoo": six visible agents, but restrained accents — never six
  giant rainbow cards
- A dark enterprise cockpit: the canvas is light and soft, never pure
  white everywhere and never dark

## 4. Color tokens

Defined once in `src/theme/tokens.css`, mirrored for logic in
`src/theme/tokens.ts`. Components never hardcode palette values.

| Token | Value | Use |
|---|---|---|
| `--background-app` | `#F7F9FC` | App canvas |
| `--surface-card` | `#FFFFFF` | Cards, bars |
| `--surface-soft` | `#F1F4F9` | Soft wells, waiting states |
| `--surface-tint-blue` | `#EEF4FF` | Tinted emphasis surfaces |
| `--border-subtle` | `#E0E5EF` | All borders |
| `--text-primary` | `#202124` | Body text |
| `--text-secondary` | `#5F6368` | Supporting text |
| `--text-muted` | `#80868B` | Tertiary text |
| `--blue` / `--blue-soft` | `#1A73E8` / `#E8F0FE` | Primary actions, drafts |
| `--violet` / `--violet-soft` | `#7C4DFF` / `#F0EAFE` | Synthetic/mock labeling |
| `--cyan` / `--cyan-soft` | `#00ACC1` / `#E6F7FA` | Data accents |
| `--green` / `--green-soft` | `#188038` / `#E6F4EA` | Complete, audit complete |
| `--yellow` / `--yellow-soft` | `#F9AB00` / `#FEF7E0` | Needs review, pending approval |
| `--red` / `--red-soft` | `#D93025` / `#FCE8E6` | Blocked, failed, audit exception |

Color carries meaning, not decoration. If a color does not communicate
state, it should not be there.

## 5. Typography

Google-like fallback stack — no proprietary font files are imported:

```css
font-family: "Google Sans", "Inter", "Roboto", Arial, sans-serif;
```

| Token | Size | Use |
|---|---|---|
| `--font-display` | 32px | Page titles, hero metrics |
| `--font-title` | 24px | Section titles |
| `--font-section` | 18px | Card titles, brand |
| `--font-body` | 14px | Default text |
| `--font-small` | 12px | Chips, badges, meta |
| `--font-micro` | 11px | Timestamps, field labels |

Weights stay at 400/500 (700 only for ordinal markers). Labels are short
and plain — no corporate copy.

## 6. Shape, radius, elevation

```css
--radius-sm: 8px;  --radius-md: 12px;  --radius-lg: 16px;
--radius-xl: 24px; --radius-card: 20px; --radius-pill: 999px;
```

Cards: `1px solid var(--border-subtle)`, radius 20px, and the soft
two-layer shadow (`--shadow-card`). Buttons, chips, badges, and nav items
are pills. Avoid heavy borders, black outlines, dense grid lines, and
dark drop shadows. Hover lift (`--shadow-card-hover` + 1px translate) is
reserved for cards that navigate somewhere.

## 7. Gemini gradient usage

```css
--gemini-gradient: linear-gradient(135deg, #1A73E8 0%, #7C4DFF 48%, #00ACC1 100%);
--gemini-soft-gradient: linear-gradient(135deg, rgba(26,115,232,.14), rgba(124,77,255,.12), rgba(0,172,193,.10));
```

The gradient means **agent activity or intelligence** — nothing else.
Permitted uses, exhaustively:

1. A **running** agent card/badge (gradient border + soft shimmer)
2. The **primary action glow** (`Button glow` — at most one per screen)
3. **Insight cards** (3px top accent strip only)
4. The **brand mark** in the top bar
5. Subtle header accents

Never as a card background, never on text, never on more than one
attention-seeking element at a time.

## 8. Status color mapping

One source of truth: `src/theme/status.ts`. Every badge shows a text
label — color never stands alone.

| Status | Label | Treatment |
|---|---|---|
| `complete` | Complete | green |
| `running` | Running | Gemini gradient border, pulsing dot |
| `waiting` | Waiting | neutral gray |
| `needs_review` | Needs review | amber |
| `blocked` | Blocked | red |
| `failed` | Failed | red |
| `draft` | Draft | blue |
| `prepared` | Prepared | blue |
| `pending_approval` | Pending approval | amber |
| `audit_complete` | Audit complete | green |
| `audit_exception` | Audit exception | red |
| `synthetic_mock` | Synthetic / mock data | muted violet |

Unknown backend statuses degrade to a neutral badge with a humanized
label — never a crash, never an invented meaning.

## 9. Six-Agent Workflow Rail design rules

The most important component (`src/components/agents/SixAgentWorkflowRail.tsx`).

- Fixed order, always all six, by exact official RFP name:
  **Indexing Agent → Triaging Agent → ETL Agent → Note Taking and Data
  Entry Agent → Text Content Agent → Automation Agent.**
- An agent without a run renders as **waiting — never omitted**.
- **Blocked runs stay visible** with their reason rendered prominently;
  a blocked rail is a feature, not a failure to hide.
- Never collapse the rail behind a generic "AI workflow", "assistant",
  or "CaseFlow AI" label.
- Horizontal six-across on wide screens, 3×2 at medium widths, vertical
  stack on narrow screens, with connector lines between cards.
- Semantically an ordered list (`<ol aria-label="Six-Agent Workflow Rail">`).
- A leadership reviewer must be able to answer "where are the six
  agents?" within 10 seconds of seeing a request detail.

## 10. Agent card design rules

`src/components/agents/AgentRunCard.tsx`. Anatomy, top to bottom:

1. Ordinal marker (agent accent tint), official name, status badge
2. Role one-liner (muted)
3. Blocked/failed reason callout when applicable
4. Output summary
5. Confidence bar when the agent produces a confidence score
6. Meta row: "Human review required" chip, evidence link, audit link
7. Collapsed details: input summary, review reasons, risk flags, timestamp

Per-agent accents are restrained: six distinct calm hues
(`src/theme/agentTheme.ts`) applied to the ordinal marker **only** —
state, not identity, colors the card. State styling: complete = green
left border; running = gradient border + gentle shimmer; blocked/failed
= red left border on red-soft; needs review = amber on amber-soft;
waiting = flat soft surface.

## 11. Governance dashboard design direction

(Components only this sprint; screen arrives later.) The eventual
landing screen: page title + summary, filter bar, top metric strip,
insight cards, product/domain volume, work needing attention, **RFP
Agent Coverage** (all six agents: runs, blocked runs, audit events,
average confidence, overrides), and audit readiness.

Insight cards are Gemini-like: concise claim as the title, one short
evidence-backed paragraph, a suggested action **pending human decision**,
and evidence links — e.g. "Location requests are driving SLA risk" with
`metric:product-volume-location` evidence. Every metric renders its data
confidence label (`synthetic_mock`, `estimated`, `fully_tracked`, …).

## 12. Request detail design direction

The future hero screen. Header: request ID · agency · legal process ·
urgency · status. Left column: source request document with extracted
spans. Middle: extracted fields, the Six-Agent Workflow Rail, response
package preview. Right: human review panel, risk flags, audit summary,
next action. It should feel like "Gemini analyzing a legal request",
not a table-row detail view.

## 13. Response package design direction

A polished document workspace: clean document preview, Template LERS
Response sections in order as cards, a right-side provenance panel, an
approval banner, and a persistent "Draft — pending analyst review"
watermark. Every section shows agent provenance ("Generated by Text
Content Agent · Evidence: TMPL-PROD-001"; "Index of Produced Records —
supported by ETL Agent · 8 synthetic GPS records"). Record counts always
say **synthetic**.

## 14. Audit timeline design direction

A product feature, not a debug log. Vertical timeline with clean actor
chips, one row per event: timestamp, actor (agent by official name,
human, or service), action, status, evidence links, and before/after
state on expand. Filterable by agent — all six individually selectable.
`audit_completed` renders green; `finalization_blocked` renders as a red
audit exception that links into Work Needing Attention.

## 15. Motion and interaction rules

Use motion sparingly. Permitted: running-card gradient shimmer
(~2.6s ease), pulsing status dot, smooth expand/collapse on agent
details, hover lift on interactive cards, gentle entry transitions for
new audit events. Forbidden: flashy spinners, bouncing icons, multiple
simultaneous animated gradients, confetti, blinking warnings. All motion
collapses under `prefers-reduced-motion: reduce` (enforced globally in
`tokens.css`).

## 16. Copy rules

Short, plain, Gemini-like language. The system drafts and prepares;
humans decide.

**Use:** Draft · Prepared · Pending review · Pending analyst approval ·
Human review required · Escalated · Sent to QA · Blocked · Evidence
available · Audit event logged · Synthetic/mock data · "8 synthetic GPS
records found" · "Blocked by missing date range" · "Prepared escalation".

**Never use:** "Sent automatically" · "Production released" · "Final
certified output" · "Disclosure complete" · "Autonomous legal response" ·
"Approved by agent" · "Fully automated production".

The UI must never imply records were released by an agent, a package was
finalized by an agent, a response was sent automatically, disclosure
happened, legal sufficiency was determined by an agent, or that human
approval is optional. `src/tests/copyGuardrails.test.tsx` enforces this
against rendered output and component sources.

## 17. Accessibility expectations

- Every interactive element is keyboard-focusable with a visible focus
  ring (global `:focus-visible` style).
- State is never communicated by color alone — badges always carry text
  labels; blocked reasons are written out.
- Confidence bars are `role="meter"` with `aria-label`, value text
  visible ("94% confidence"), and "No confidence score" when absent.
- The rail is an ordered list; cards are labeled articles; disclosure
  toggles use `aria-expanded`/`aria-controls`; the active nav item uses
  `aria-current="page"`.
- Gradient accents never sit behind text; running cards keep dark text
  on a light fill.
- Text and chip colors meet WCAG AA contrast on their soft backgrounds.
- `prefers-reduced-motion` disables all animation.

## 18. Design acceptance criteria

A screen or component matches this guide when:

1. All colors, radii, shadows, and type sizes come from `tokens.css` —
   no hardcoded palette values.
2. The six official RFP agent names appear exactly, never paraphrased or
   hidden behind a generic AI label.
3. The Six-Agent Workflow Rail renders all six agents in fixed order;
   missing runs show as waiting; blocked runs show their reason.
4. Gradient usage is limited to the five permitted accents (§7).
5. Every status is shown as a labeled badge from `status.ts`.
6. All copy passes §16 — and the copy-guardrail tests stay green.
7. Synthetic/mock data labeling is visible (top-bar badge + banner, and
   data-confidence chips next to metrics).
8. Keyboard navigation and focus rings work on every interactive element.
9. The layout breathes: card grids over dense tables, generous spacing,
   soft canvas behind white cards.
10. Nothing in the UI offers an agent-initiated approve / finalize /
    release / send affordance.
