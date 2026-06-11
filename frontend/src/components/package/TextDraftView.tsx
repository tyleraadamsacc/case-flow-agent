import type { TextDraft } from "../../api/types";
import { humanizeToken } from "../../lib/requestDisplay";
import Card from "../ui/Card";
import EvidenceLink from "../ui/EvidenceLink";
import StatusBadge from "../ui/StatusBadge";

const DRAFT_TITLES: Record<string, string> = {
  production_package: "Production package draft",
  deficiency_response: "Deficiency response draft",
  sme_notification: "SME notification draft",
  production_summary: "Production summary draft",
  no_responsive_records: "No-responsive-records draft",
};

/** A Text Content Agent draft (deficiency response, SME notification,
 * production summary) rendered section by section. Always a draft —
 * the status literal cannot be anything else. */
export default function TextDraftView({ draft }: { draft: TextDraft }) {
  return (
    <Card
      className="cf-text-draft"
      title={DRAFT_TITLES[draft.draft_type] ?? humanizeToken(draft.draft_type)}
      subtitle="Drafted by Text Content Agent. Analyst review is required before downstream workflow."
    >
      <div className="cf-package__header cf-text-draft__header">
        <div className="cf-preview__row">
          <StatusBadge status={draft.status} />
          <span className="cf-package__watermark">Draft pending analyst review</span>
          <span className="cf-package__watermark cf-package__watermark--neutral">
            Guardrail draft
          </span>
        </div>
        <EvidenceLink evidenceIds={draft.evidence_ids} />
      </div>
      <dl className="cf-package__definitions cf-text-draft__sections">
        {Object.entries(draft.sections).map(([name, body]) => (
          <div key={name} className="cf-text-draft__section">
            <dt>{humanizeToken(name)}</dt>
            <dd className="cf-package__text--pre">{body}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
