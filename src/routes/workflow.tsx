import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClipboardCheck, Inbox } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "@/components/common/toast";

import { useMisAprobacionesPendientes } from "@/hooks/entities/use-workflow";
import { MisAprobacionesTable } from "@/components/workflow/mis-aprobaciones-table";

export const Route = createFileRoute("/workflow")({
  head: () => ({ meta: [{ title: "Workflow · VIATIQ" }] }),
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
  const [tab, setTab] = useState<"pendientes" | "todas">("pendientes");

  return (
    <>
      <PageHeader
        title="Workflow de aprobaciones"
        description="Bandeja de rendiciones pendientes de revisión."
        breadcrumbs={[{ label: "Workflow" }]}
      />

      {/* Tabs simples */}
      <div className="mb-5 flex gap-1 border-b border-border">
        <TabButton
          active={tab === "pendientes"}
          onClick={() => setTab("pendientes")}
          icon={<Inbox className="size-4" />}
          label="Mis pendientes"
        />
        <TabButton
          active={tab === "todas"}
          onClick={() => setTab("todas")}
          icon={<ClipboardCheck className="size-4" />}
          label="Todas en proceso"
        />
      </div>

      {tab === "pendientes" && (
        <MisPendientesTab
          onVerDetalle={(id) =>
            void navigate({ to: "/rendiciones", search: { detalle: id } as never })
          }
        />
      )}
      {tab === "todas" && <TodasEnProcesoTab />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab: Mis pendientes
// ---------------------------------------------------------------------------

interface MisPendientesTabProps {
  onVerDetalle: (rendicionId: string) => void;
}

function MisPendientesTab({ onVerDetalle }: MisPendientesTabProps) {
  const { data, isLoading, error } = useMisAprobacionesPendientes();

  if (error) {
    return (
      <EmptyState
        title="Error al cargar aprobaciones"
        description={error instanceof Error ? error.message : "Ocurrió un error inesperado."}
      />
    );
  }

  return <MisAprobacionesTable data={data ?? []} loading={isLoading} onVerDetalle={onVerDetalle} />;
}

// ---------------------------------------------------------------------------
// Tab: Todas en proceso (pendientes de cualquier aprobador en la empresa)
// ---------------------------------------------------------------------------

function TodasEnProcesoTab() {
  // Esta vista muestra TODAS las rendiciones en estado 'enviada' o 'en_revision'
  // para roles administrador. Por ahora reutiliza el mismo hook — en FASE 8
  // se puede agregar un query por empresa que no filtre por rol.
  const { data, isLoading, error } = useMisAprobacionesPendientes();

  if (error) {
    return (
      <EmptyState
        title="Error al cargar rendiciones en proceso"
        description={error instanceof Error ? error.message : "Ocurrió un error inesperado."}
      />
    );
  }

  if (!isLoading && (!data || data.length === 0)) {
    return (
      <EmptyState
        title="Sin rendiciones en proceso"
        description="No hay rendiciones en estado de revisión en este momento."
      />
    );
  }

  return <MisAprobacionesTable data={data ?? []} loading={isLoading} />;
}

// ---------------------------------------------------------------------------
// TabButton — interno, no exportado (react-refresh compliant)
// ---------------------------------------------------------------------------

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-b-2 border-primary text-primary"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

// Suprimir warning de import no utilizado (toast disponible para acciones futuras)
void toast;
