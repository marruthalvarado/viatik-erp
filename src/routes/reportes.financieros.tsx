import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ReportesFinancierosLayout } from "@/components/reportes-financieros/reportes-financieros-layout";

export const Route = createFileRoute("/reportes/financieros")({
  head: () => ({ meta: [{ title: "Reportes Financieros · Viatik" }] }),
  component: ReportesFinancierosPage,
});

function ReportesFinancierosPage() {
  return (
    <AppShell>
      <ReportesFinancierosLayout />
    </AppShell>
  );
}
