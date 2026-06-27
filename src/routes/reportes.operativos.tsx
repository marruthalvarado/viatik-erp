import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ReportesOperativosLayout } from "@/components/reportes-operativos/reportes-operativos-layout";

export const Route = createFileRoute("/reportes/operativos")({
  head: () => ({ meta: [{ title: "Reportes Operativos · Viatik" }] }),
  component: ReportesOperativosPage,
});

function ReportesOperativosPage() {
  return (
    <AppShell>
      <ReportesOperativosLayout />
    </AppShell>
  );
}
