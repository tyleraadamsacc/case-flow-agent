import { useState } from "react";
import type { ReactNode } from "react";

import { api, ApiError } from "../../api/client";
import type { LegalRequest, ProductionPackage } from "../../api/types";
import { formatDate, formatDateTime, humanizeToken } from "../../lib/requestDisplay";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Chip from "../ui/Chip";
import StatusBadge from "../ui/StatusBadge";

function Section({
  name,
  provenance,
  variant = "document",
  children,
}: {
  name: string;
  provenance?: string;
  variant?: "document" | "review";
  children: ReactNode;
}) {
  return (
    <section className={`cf-package__section cf-package__section--${variant}`}>
      <header className="cf-package__section-header">
        <h4>{name}</h4>
        {provenance ? (
          <Chip tone="neutral" title="Section provenance" className="cf-package__provenance">
            Source: {humanizeToken(provenance)}
          </Chip>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** The drafted Template LERS Response, rendered as a document workspace
 * (plan §13): sections in template order, per-section agent provenance,
 * the synthetic record index, and a persistent draft watermark. The view
 * is read-only context for the human review panel — it offers no
 * finalize/release affordance, because none exists in the backend. */
export default function ResponsePackageView({
  pkg,
  onUpdated,
}: {
  pkg: ProductionPackage;
  onUpdated?: (request: LegalRequest) => void;
}) {
  const provenance = pkg.section_provenance ?? {};
  const validationFindings = pkg.validation_findings ?? [];
  const subjectIdentifiers = pkg.subject_identifiers ?? [];
  const records = pkg.records ?? [];
  const fieldDefinitions = pkg.field_definitions ?? [];
  const riskFlags = pkg.risk_flags ?? [];
  const [summaryText, setSummaryText] = useState(
    pkg.production_summary.ordinary_course_statement ?? "",
  );
  const [representative, setRepresentative] = useState(
    pkg.certification.authorized_representative ?? "",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const periodLabel = pkg.production_summary.start_date
    ? `${formatDate(pkg.production_summary.start_date)} to ${formatDate(
        pkg.production_summary.end_date,
      )}`
    : "Date range not stated";
  const validationStatus =
    validationFindings.length === 0
      ? "No validation findings"
      : `${validationFindings.length} validation finding${
          validationFindings.length === 1 ? "" : "s"
        }`;

  return (
    <Card className="cf-package cf-package--review-workspace">
      <div className="cf-package__sticky-status" role="note">
        <div>
          <p className="cf-package__eyebrow">Response package draft</p>
          <h3 className="cf-card__title">{pkg.production_id}</h3>
          <p className="cf-card__subtitle">
            {pkg.request_id} · drafted {formatDate(pkg.date_produced)}
          </p>
        </div>
        <div className="cf-package__status-stack" aria-label="Draft status">
          <StatusBadge status={pkg.status} />
          <Chip tone="amber" dot>
            Draft pending analyst review
          </Chip>
          <Chip tone="neutral">Synthetic / mock data</Chip>
        </div>
      </div>

      <div className="cf-package__workspace">
        <article className="cf-package__document" aria-label="Reviewable response package document">
          <div className="cf-package__document-cover">
            <p className="cf-package__eyebrow">Legal response package</p>
            <h2>{pkg.requesting_agency?.agency ?? "Requesting agency pending"}</h2>
            <div className="cf-package__cover-grid">
              <span>
                <strong>Request</strong>
                {pkg.request_id}
              </span>
              <span>
                <strong>Case</strong>
                {pkg.requesting_agency?.case_number ?? "Not recorded"}
              </span>
              <span>
                <strong>Responsive records</strong>
                {pkg.production_summary.total_responsive_records}
              </span>
              <span>
                <strong>Period</strong>
                {periodLabel}
              </span>
            </div>
          </div>

          <Section name="Requesting agency" provenance={provenance.requesting_agency}>
            <p className="cf-package__text">
              {pkg.requesting_agency?.agency ?? "Not recorded"}
              {pkg.requesting_agency?.case_number
                ? ` · case ${pkg.requesting_agency.case_number}`
                : ""}
            </p>
          </Section>

          <Section
            name="Subject identifiers"
            provenance={provenance.subject_identifiers}
          >
            <div className="cf-preview__row">
              {subjectIdentifiers.map((identifier) => (
                <Chip key={`${identifier.type}-${identifier.value}`} tone="neutral">
                  {humanizeToken(identifier.type)}: {identifier.value}
                </Chip>
              ))}
            </div>
          </Section>

          <Section
            name="Production summary"
            provenance={provenance.production_summary}
          >
            <p className="cf-package__text">
              {pkg.production_summary.total_responsive_records} synthetic responsive
              record{pkg.production_summary.total_responsive_records === 1 ? "" : "s"}
              {pkg.production_summary.start_date
                ? ` for ${formatDate(pkg.production_summary.start_date)} to ${formatDate(
                    pkg.production_summary.end_date,
                  )}`
                : ""}
              .
              {pkg.production_summary.ordinary_course_statement
                ? ` ${pkg.production_summary.ordinary_course_statement}`
                : ""}
            </p>
            {onUpdated ? (
              <div className="cf-inline-edit">
                <input
                  className="cf-input"
                  value={summaryText}
                  aria-label="Override production summary text"
                  onChange={(event) => setSummaryText(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="outlined"
                  disabled={busy !== null || !summaryText.trim()}
                  onClick={() =>
                    void applyOverride("summary", {
                      target: "production_summary_text",
                      text_value: summaryText.trim(),
                      reason: "Reviewer corrected the production summary wording.",
                    })
                  }
                >
                  Apply
                </Button>
              </div>
            ) : null}
          </Section>

          <Section
            name="Index of produced records"
            provenance={provenance.record_index}
          >
            {records.length === 0 ? (
              <p className="cf-package__text">
                No responsive records: no-records response draft.
              </p>
            ) : (
              <div className="cf-package__table-wrap">
                <table className="cf-table cf-package__record-table">
                  <thead>
                    <tr>
                      <th>Record</th>
                      <th>Timestamp (UTC)</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                      <th>Accuracy (m)</th>
                      <th>Source</th>
                      <th>Data confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.record_id}>
                        <td>
                          <span className="cf-package__record-id">
                            {record.record_id}
                          </span>
                        </td>
                        <td>{formatDateTime(record.timestamp_utc)}</td>
                        <td>{record.latitude ?? "n/a"}</td>
                        <td>{record.longitude ?? "n/a"}</td>
                        <td>{record.accuracy_meters ?? "n/a"}</td>
                        <td>{record.source ?? "n/a"}</td>
                        <td>
                          <Chip tone="violet">{humanizeToken(record.data_confidence)}</Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section
            name="Data field definitions"
            provenance={provenance.field_definitions}
          >
            <dl className="cf-package__definitions">
              {fieldDefinitions.map((definition) => (
                <div key={definition.name}>
                  <dt>{humanizeToken(definition.name)}</dt>
                  <dd>{definition.definition}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </article>

        <aside className="cf-package__review-panel" aria-label="Provenance and review panel">
          <div className="cf-package__panel-block">
            <p className="cf-package__eyebrow">Review state</p>
            <h4>{validationStatus}</h4>
            <p>
              Guardrail view only. Analyst review is required before any
              downstream QA or response workflow.
            </p>
          </div>

          {validationFindings.length > 0 ? (
            <Section name="Validation findings" variant="review">
              <ul
                className="cf-deficiency-list cf-package__finding-list"
                aria-label="Package validation findings"
              >
                {validationFindings.map((finding) => (
                  <li key={finding.code}>
                    <Chip
                      tone={finding.severity === "blocking" ? "red" : "amber"}
                      dot
                    >
                      {humanizeToken(finding.severity)}
                    </Chip>{" "}
                    <span className="cf-fields__muted">
                      {humanizeToken(finding.section)}
                    </span>
                    : {finding.message}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section
            name="Chain of custody review"
            provenance={provenance.chain_of_custody}
            variant="review"
          >
            <p className="cf-package__text">
              Collected {formatDate(pkg.chain_of_custody.collection_date)} via{" "}
              {pkg.chain_of_custody.collection_method ?? "method not recorded"} by{" "}
              {pkg.chain_of_custody.collected_by ?? "collector not recorded"}.
            </p>
            <div className="cf-preview__row">
              <Chip tone="amber" dot>
                {humanizeToken(pkg.chain_of_custody.review_status)}
              </Chip>
            </div>
          </Section>

          <Section
            name="Certification review"
            provenance={provenance.certification}
            variant="review"
          >
            <p className="cf-package__text">
              {pkg.certification.certification_text ?? "Not drafted yet."}
            </p>
            <div className="cf-preview__row">
              <Chip tone="neutral">
                {pkg.certification.authorized_representative ?? "Representative TBD"}
                {pkg.certification.title ? ` · ${pkg.certification.title}` : ""}
              </Chip>
              <StatusBadge status={pkg.certification.status} />
            </div>
            {onUpdated ? (
              <div className="cf-inline-edit">
                <input
                  className="cf-input"
                  value={representative}
                  aria-label="Override certification representative"
                  onChange={(event) => setRepresentative(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="outlined"
                  disabled={busy !== null || !representative.trim()}
                  onClick={() =>
                    void applyOverride("representative", {
                      target: "certification_representative",
                      text_value: representative.trim(),
                      reason: "Reviewer corrected the certification representative.",
                    })
                  }
                >
                  Apply
                </Button>
              </div>
            ) : null}
          </Section>

          {riskFlags.length > 0 ? (
            <div className="cf-package__panel-block">
              <p className="cf-package__eyebrow">Risk flags</p>
              <div className="cf-preview__row">
                {riskFlags.map((flag) => (
                  <Chip key={flag} tone="red" dot>
                    {humanizeToken(flag)}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
          {message ? <p className="cf-review__notice">{message}</p> : null}
        </aside>
      </div>
    </Card>
  );

  async function applyOverride(
    name: string,
    body: Parameters<typeof api.override>[1],
  ) {
    if (!onUpdated) {
      return;
    }
    setBusy(name);
    setMessage(null);
    try {
      const response = await api.override(pkg.request_id, body);
      onUpdated(response.legal_request);
      setMessage("Override recorded. Audit event logged.");
    } catch (cause) {
      const detail =
        cause instanceof ApiError
          ? typeof cause.detail === "string"
            ? cause.detail
            : JSON.stringify(cause.detail)
          : (cause as Error).message;
      setMessage(`Override refused: ${detail}`);
    } finally {
      setBusy(null);
    }
  }
}
