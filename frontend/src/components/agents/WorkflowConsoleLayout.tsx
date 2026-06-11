import type { ReactNode } from "react";

import "./WorkflowConsole.css";

export interface WorkflowConsoleLayoutProps {
  storyHeader: ReactNode;
  readinessStrip: ReactNode;
  workflowRail: ReactNode;
  timeline: ReactNode;
  contextPanel?: ReactNode;
  packagePanel?: ReactNode;
  reviewPanel?: ReactNode;
}

export default function WorkflowConsoleLayout({
  storyHeader,
  readinessStrip,
  workflowRail,
  timeline,
  contextPanel,
  packagePanel,
  reviewPanel,
}: WorkflowConsoleLayoutProps) {
  return (
    <main className="workflow-console" aria-label="Six-agent workflow console">
      <section className="workflow-console__story" aria-label="Request story">
        {storyHeader}
      </section>

      <section
        className="workflow-console__readiness"
        aria-label="Review readiness"
      >
        {readinessStrip}
      </section>

      <div className="workflow-console__body">
        <section
          className="workflow-console__primary"
          aria-label="Agent workflow"
        >
          {workflowRail}
        </section>

        {contextPanel ? (
          <aside
            className="workflow-console__context"
            aria-label="Request context"
          >
            {contextPanel}
          </aside>
        ) : null}
      </div>

      <div className="workflow-console__supporting">
        {packagePanel ? (
          <section
            className="workflow-console__panel"
            aria-label="Response package draft"
          >
            {packagePanel}
          </section>
        ) : null}

        {reviewPanel ? (
          <section
            className="workflow-console__panel"
            aria-label="Analyst review"
          >
            {reviewPanel}
          </section>
        ) : null}

        <section className="workflow-console__panel" aria-label="Audit timeline">
          {timeline}
        </section>
      </div>
    </main>
  );
}
