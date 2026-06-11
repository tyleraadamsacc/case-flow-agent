import type { ReactNode } from "react";

import type { ProductionPackage } from "../../api/types";
import { formatDate, formatDateTime, humanizeToken } from "../../lib/requestDisplay";
import Card from "../ui/Card";
import Chip from "../ui/Chip";
import StatusBadge from "../ui/StatusBadge";

function Section({
  name,
  provenance,
  children,
}: {
  name: string;
  provenance?: string;
  children: ReactNode;
}) {
  return (
    <section className="cf-package__section">
      <header className="cf-package__section-header">
        <h4>{name}</h4>
        {provenance ? (
          <Chip tone="neutral" title="Section provenance">
            {provenance}
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
}: {
  pkg: ProductionPackage;
}) {
  const provenance = pkg.section_provenance;

  return (
    <Card className="cf-package">
      <div className="cf-package__watermark" role="note">
        Draft, pending analyst review · synthetic / mock data
      </div>

      <div className="cf-package__header">
        <div>
          <h3 className="cf-card__title">{pkg.production_id}</h3>
          <p className="cf-card__subtitle">
            Response package draft for {pkg.request_id} · drafted{" "}
            {formatDate(pkg.date_produced)}
          </p>
        </div>
        <StatusBadge status={pkg.status} />
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
          {pkg.subject_identifiers.map((identifier) => (
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
            ? ` for ${formatDate(pkg.production_summary.start_date)} → ${formatDate(
                pkg.production_summary.end_date,
              )}`
            : ""}
          .
          {pkg.production_summary.ordinary_course_statement
            ? ` ${pkg.production_summary.ordinary_course_statement}`
            : ""}
        </p>
      </Section>

      <Section
        name="Index of produced records"
        provenance={provenance.record_index}
      >
        {pkg.records.length === 0 ? (
          <p className="cf-package__text">
            No responsive records: no-records response draft.
          </p>
        ) : (
          <div className="cf-package__table-wrap">
            <table className="cf-table">
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
                {pkg.records.map((record) => (
                  <tr key={record.record_id}>
                    <td>{record.record_id}</td>
                    <td>{formatDateTime(record.timestamp_utc)}</td>
                    <td>{record.latitude ?? "n/a"}</td>
                    <td>{record.longitude ?? "n/a"}</td>
                    <td>{record.accuracy_meters ?? "n/a"}</td>
                    <td>{record.source ?? "n/a"}</td>
                    <td>
                      <Chip tone="violet">{record.data_confidence}</Chip>
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
          {pkg.field_definitions.map((definition) => (
            <div key={definition.name}>
              <dt>{definition.name}</dt>
              <dd>{definition.definition}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section name="Chain of custody" provenance={provenance.chain_of_custody}>
        <p className="cf-package__text">
          Collected {formatDate(pkg.chain_of_custody.collection_date)} via{" "}
          {pkg.chain_of_custody.collection_method ?? "method not recorded"} by{" "}
          {pkg.chain_of_custody.collected_by ?? "collector not recorded"}.{" "}
          <Chip tone="amber" dot>
            {humanizeToken(pkg.chain_of_custody.review_status)}
          </Chip>
        </p>
      </Section>

      <Section name="Certification" provenance={provenance.certification}>
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
      </Section>

      {pkg.risk_flags.length > 0 ? (
        <div className="cf-preview__row">
          {pkg.risk_flags.map((flag) => (
            <Chip key={flag} tone="red" dot>
              {humanizeToken(flag)}
            </Chip>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
