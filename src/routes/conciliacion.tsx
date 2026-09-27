/**
 * Módulo Conciliación Bancaria.
 * Importa extractos bancarios y concilia movimientos con facturas y gastos.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { useCompany } from "@/contexts/company-context";
import { ConciliacionLayout } from "@/components/conciliacion/conciliacion-layout";
import { Landmark } from "lucide-react";

export const Route = createFileRoute("/conciliacion")({
  head: () => ({ meta: [{ title: "Conciliación Bancaria · VIATIQ" }] }),
  component: ConciliacionPage,
});

function ConciliacionPage() {
  return (
    <AppShell>
      <ConciliacionContent />
    </AppShell>
  );
}

function ConciliacionContent() {
  const { empresaActivaId } = useCompany();

  if (!empresaActivaId) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
        <Landmark className="size-8 opacity-40" />
        <p className="text-sm">Selecciona una empresa para ver la conciliación bancaria.</p>
      </div>
    );
  }

  return <ConciliacionLayout empresaId={empresaActivaId} />;
}
