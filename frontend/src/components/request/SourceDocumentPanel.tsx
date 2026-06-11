import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { LegalRequest, SourceDocumentSection } from "../../api/types";
import Card from "../ui/Card";
import Chip from "../ui/Chip";

export interface SourceTraceTarget {
  section_id: string;
  source_span?: string | null;
  label?: string;
}

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

function lineLabel(section: SourceDocumentSection): string {
  if (section.start_line === section.end_line) {
    return `Line ${section.start_line}`;
  }
  return `Lines ${section.start_line}-${section.end_line}`;
}

export default function SourceDocumentPanel({
  request,
  activeTraceTarget,
}: {
  request: LegalRequest;
  activeTraceTarget?: SourceTraceTarget | null;
}) {
  const text = request.raw_source_text;
  const sourceSections = request.source_sections ?? [];
  const firstSectionId = sourceSections[0]?.section_id ?? null;
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    firstSectionId,
  );
  const docRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const spans = [
    ...(request.subject_identifiers ?? []).map((id) => id.source_span),
    ...(request.legal_authorities ?? []).map((authority) => authority.source_span),
    activeTraceTarget?.source_span,
  ].filter((span): span is string => Boolean(span));

  useEffect(() => {
    setActiveSectionId(firstSectionId);
  }, [firstSectionId, request.legal_request_id]);

  function jumpToSection(sectionId: string) {
    setActiveSectionId(sectionId);
    const container = docRef.current;
    const section = sectionRefs.current[sectionId];
    if (!container || !section) {
      return;
    }
    const containerTop = container.getBoundingClientRect().top;
    const sectionTop = section.getBoundingClientRect().top;
    const top = container.scrollTop + sectionTop - containerTop - 8;
    if (typeof container.scrollTo === "function") {
      container.scrollTo({ top, behavior: "smooth" });
    } else {
      container.scrollTop = top;
    }
  }

  useEffect(() => {
    if (!activeTraceTarget?.section_id) {
      return;
    }
    jumpToSection(activeTraceTarget.section_id);
  }, [activeTraceTarget?.section_id, activeTraceTarget?.source_span]);

  return (
    <Card
      title="Source request document"
      subtitle={
        request.raw_source_uri ?? "Synthetic LERS request (mock data only)"
      }
    >
      {sourceSections.length > 0 ? (
        <>
          <div
            className="cf-source-nav"
            aria-label="Source document section navigator"
          >
            {sourceSections.map((section) => {
              const active = section.section_id === activeSectionId;
              return (
                <Chip
                  key={section.section_id}
                  tone={active ? "blue" : "neutral"}
                  onClick={() => jumpToSection(section.section_id)}
                  title={lineLabel(section)}
                >
                  {section.title}
                </Chip>
              );
            })}
          </div>
          <div
            className="cf-doc"
            ref={docRef}
            role="document"
            aria-label="Source request document sections"
            tabIndex={0}
            style={{ position: "relative" }}
          >
            {sourceSections.map((section) => {
              const active = section.section_id === activeSectionId;
              return (
                <section
                  key={section.section_id}
                  ref={(node) => {
                    sectionRefs.current[section.section_id] = node;
                  }}
                  aria-current={active ? "true" : undefined}
                  style={{
                    border: active
                      ? "1px solid var(--blue)"
                      : "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    background: active ? "var(--blue-soft)" : "var(--surface-card)",
                    padding: "var(--space-3)",
                    marginBottom: "var(--space-3)",
                  }}
                >
                  <header
                    className="cf-doc__section-header"
                  >
                    <h4 className="cf-fields__label">{section.title}</h4>
                    <span className="cf-fields__muted">{lineLabel(section)}</span>
                  </header>
                  <p style={{ margin: 0 }}>
                    {section.text
                      ? highlight(section.text, spans)
                      : "No section text available."}
                  </p>
                </section>
              );
            })}
          </div>
        </>
      ) : text ? (
        <p className="cf-doc">{highlight(text, spans)}</p>
      ) : (
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          No source text available for this request.
        </p>
      )}
    </Card>
  );
}
