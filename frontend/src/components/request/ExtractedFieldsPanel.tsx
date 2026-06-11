import type { ReactNode } from "react";

import type { LegalRequest } from "../../api/types";
import {
  formatDate,
  humanizeToken,
  specialHandlingBadges,
} from "../../lib/requestDisplay";
import Card from "../ui/Card";
import Chip from "../ui/Chip";

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cf-fields__group">
      <h4 className="cf-fields__label">{label}</h4>
      <div className="cf-fields__value">{children}</div>
    </div>
  );
}

/** Structured extraction view (plan §13 Extracted Fields panel): legal
 * process, identifiers, data categories, period validity, special
 * handling, authorities, and deficiencies. Empty before extraction runs. */
export default function ExtractedFieldsPanel({
  request,
}: {
  request: LegalRequest;
}) {
  const extracted = request.workflow_state !== "request_received";
  const badges = specialHandlingBadges(request.special_handling);
  const period = request.requested_period;

  if (!extracted) {
    return (
      <Card title="Extracted fields" subtitle="Pending extraction">
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Run “Extract request” to parse the source document into structured
          fields.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Extracted fields" subtitle="Parsed from the source document">
      <div className="cf-fields">
        <Group label="Legal process">
          <Chip tone="blue">
            {request.legal_process
              ? humanizeToken(request.legal_process.type)
              : "Unknown"}
          </Chip>
          {request.legal_process?.court_order_included ? (
            <Chip tone="neutral">Court order included</Chip>
          ) : null}
        </Group>

        <Group label="Requesting agency">
          {request.requesting_agency?.agency ?? "Not extracted"}
          {request.requesting_agency?.case_number ? (
            <span className="cf-fields__muted">
              {" "}
              · case {request.requesting_agency.case_number}
            </span>
          ) : null}
          {request.requesting_agency?.officer ? (
            <span className="cf-fields__muted">
              {" "}
              · {request.requesting_agency.officer}
            </span>
          ) : null}
        </Group>

        <Group label="Subject identifiers">
          {request.subject_identifiers.length === 0 ? (
            <Chip tone="red" dot>
              No identifiers extracted
            </Chip>
          ) : (
            request.subject_identifiers.map((identifier) => (
              <Chip key={`${identifier.type}-${identifier.value}`} tone="neutral">
                {humanizeToken(identifier.type)}: {identifier.value}
              </Chip>
            ))
          )}
        </Group>

        <Group label="Requested data categories">
          {request.requested_data_categories.length === 0
            ? "None extracted"
            : request.requested_data_categories.map((category) => (
                <Chip
                  key={category.category}
                  tone={category.requires_sme_review ? "amber" : "cyan"}
                  title={`Domain: ${category.product_domain}`}
                >
                  {humanizeToken(category.category)}
                </Chip>
              ))}
        </Group>

        <Group label="Requested period">
          {period ? (
            <>
              {formatDate(period.start)} → {formatDate(period.end)}{" "}
              {period.valid ? (
                <Chip tone="green" dot>
                  Valid
                </Chip>
              ) : (
                <Chip tone="red" dot>
                  Invalid{period.issues.length ? `: ${period.issues[0]}` : ""}
                </Chip>
              )}
            </>
          ) : (
            <Chip tone="red" dot>
              Missing date range
            </Chip>
          )}
        </Group>

        <Group label="Special handling">
          {badges.length === 0
            ? "None"
            : badges.map((badge) => (
                <Chip key={badge} tone="violet" dot>
                  {badge}
                </Chip>
              ))}
          {request.special_handling.production_deadline_days ? (
            <Chip tone="neutral">
              {request.special_handling.production_deadline_days}-day production
              deadline
            </Chip>
          ) : null}
        </Group>

        <Group label="Legal authorities">
          {request.legal_authorities.length === 0
            ? "None cited"
            : request.legal_authorities.map((authority) => (
                <Chip
                  key={authority.citation}
                  tone="neutral"
                  title={authority.description ?? undefined}
                >
                  {authority.citation}
                </Chip>
              ))}
        </Group>

        {request.deficiency_findings.length > 0 ? (
          <Group label="Deficiencies">
            <ul className="cf-deficiency-list">
              {request.deficiency_findings.map((finding) => (
                <li key={finding.code}>
                  <Chip tone={finding.severity === "blocking" ? "red" : "amber"} dot>
                    {humanizeToken(finding.severity)}
                  </Chip>{" "}
                  {finding.message}
                  {finding.suggested_resolution ? (
                    <span className="cf-fields__muted">
                      {" "}
                      Suggested: {finding.suggested_resolution}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Group>
        ) : null}
      </div>
    </Card>
  );
}
