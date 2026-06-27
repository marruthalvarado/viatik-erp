import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { BiLayout } from "@/components/bi/bi-layout";

export const Route = createFileRoute("/reportes")({
  head: () => ({ meta: [{ title: "Dashboard BI · Viatik" }] }),
  component: ReportesPage,
});

function ReportesPage() {
  return (
    <AppShell>
      <BiLayout />
    </AppShell>
  );
}
