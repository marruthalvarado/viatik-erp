import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { EvaluacionesLayout } from "@/components/evaluaciones/evaluaciones-layout";

export const Route = createFileRoute("/servicio-tecnico/evaluaciones")({
  head: () => ({ meta: [{ title: "Evaluaciones · VIATIQ" }] }),
  component: EvaluacionesPage,
});

function EvaluacionesPage() {
  return (
    <AppShell>
      <EvaluacionesLayout />
    </AppShell>
  );
}
