import type { ReactNode } from "react";

import type { LegalRequest } from "../../api/types";
import Card from "../ui/Card";

interface Range {
  start: number;
  end: number;
}

/** Mark every extracted source span inside the raw document text so the
 * analyst can see exactly what extraction grounded each field on. */
function highlight(text: string, spans: string[]): ReactNode[] {
  const ranges: Range[] = [];
  for (const span of spans) {
    if (!span) {
      continue;
    }
    const start = text.indexOf(span);
    if (start >= 0) {
      ranges.push({ start, end: start + span.length });
    }
  }
  ranges.sort((a, b) => a.start - b.start);

  const merged: Range[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  merged.forEach((range, index) => {
    if (range.start > cursor) {
      parts.push(text.slice(cursor, range.start));
    }
    parts.push(
      <mark key={index} className="cf-doc__mark">
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return parts;
}

export default function SourceDocumentPanel({
  request,
}: {
  request: LegalRequest;
}) {
  const text = request.raw_source_text;
  const spans = [
    ...request.subject_identifiers.map((id) => id.source_span),
    ...request.legal_authorities.map((authority) => authority.source_span),
  ].filter((span): span is string => Boolean(span));

  return (
    <Card
      title="Source request document"
      subtitle={
        request.raw_source_uri ?? "Synthetic LERS request (mock data only)"
      }
    >
      {text ? (
        <p className="cf-doc">{highlight(text, spans)}</p>
      ) : (
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          No source text available for this request.
        </p>
      )}
    </Card>
  );
}
