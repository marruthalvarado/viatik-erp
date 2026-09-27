/**
 * Módulo Contabilidad / NIIF.
 * Plan de cuentas, asientos contables y reportes financieros.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { useCompany } from "@/contexts/company-context";
import { ContabilidadLayout } from "@/components/contabilidad/contabilidad-layout";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/contabilidad")({
  head: () => ({ meta: [{ title: "Contabilidad NIIF · VIATIQ" }] }),
  component: ContabilidadPage,
});

function ContabilidadPage() {
  return (
    <AppShell>
      <ContabilidadContent />
    </AppShell>
  );
}

function ContabilidadContent() {
  const { empresaActivaId } = useCompany();

  if (!empresaActivaId) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
        <BookOpen className="size-8 opacity-40" />
        <p className="text-sm">Selecciona una empresa para acceder a la contabilidad.</p>
      </div>
    );
  }

  return <ContabilidadLayout empresaId={empresaActivaId} />;
}
