import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { WorkflowReportLayout } from "@/components/workflow-analytics/workflow-report-layout";

export const Route = createFileRoute("/reportes/workflow")({
  head: () => ({ meta: [{ title: "Workflow Analytics · Viatik" }] }),
  component: WorkflowReportPage,
});

function WorkflowReportPage() {
  return (
    <AppShell>
      <WorkflowReportLayout />
    </AppShell>
  );
}
