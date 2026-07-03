/**
 * workflow.tsx
 * Bandeja de aprobaciones directas (Opcion B).
 * Muestra las rendiciones donde el usuario actual es el aprobador asignado
 * y el estado es "enviada".
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Inbox } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";

import { useMisRendicionesPendientes } from "@/hooks/entities/use-rendicion-aprobacion";
import { RendicionesPendientesTable } from "@/components/workflow/rendiciones-pendientes-table";

export const Route = createFileRoute("/workflow")({
  head: () => ({ meta: [{ title: "Aprobaciones - VIATIQ" }] }),
  component: WorkflowPage,
});

function WorkflowPage() {
  return (
    <AppShell>
      <WorkflowContent />
    </AppShell>
  );
}

function WorkflowContent() {
  const navigate = useNavigate();

  function irARendicion(rendicionId: string) {
    void navigate({ to: "/rendiciones", search: { detalle: rendicionId } as never });
  }

  return (
    <>
      <PageHeader
        title="Aprobaciones pendientes"
        description="Rendiciones asignadas a ti para revision y aprobacion."
        breadcrumbs={[{ label: "Aprobaciones" }]}
      />

      <BandejaTab onVerDetalle={irARendicion} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Tabla de pendientes
// ---------------------------------------------------------------------------

interface BandejaTabProps {
  onVerDetalle: (rendicionId: string) => void;
}

function BandejaTab({ onVerDetalle }: BandejaTabProps) {
  const { data, isLoading, error } = useMisRendicionesPendientes();

  if (error) {
    return (
      <EmptyState
        title="Error al cargar aprobaciones"
        description={error instanceof Error ? error.message : "Error inesperado."}
      />
    );
  }

  if (!isLoading && (!data || data.length === 0)) {
    return (
      <EmptyState
        icon={Inbox}
        title="Sin pendientes"
        description="No tienes rendiciones asignadas para aprobar en este momento."
      />
    );
  }

  return (
    <RendicionesPendientesTable data={data ?? []} loading={isLoading} onVerDetalle={onVerDetalle} />
  );
}
