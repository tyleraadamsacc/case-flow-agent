import ConsoleShell from "../components/layout/ConsoleShell";
import Card from "../components/ui/Card";

/** Honest placeholder for destinations that arrive in a later PR —
 * navigation stays truthful instead of dead. */
export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <ConsoleShell title={title}>
      <div className="cf-page-header">
        <h1>{title}</h1>
      </div>
      <Card variant="soft" style={{ maxWidth: 560 }}>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          This screen arrives in a later PR. The Request Queue and Request
          Detail workflow are available now.
        </p>
      </Card>
    </ConsoleShell>
  );
}
