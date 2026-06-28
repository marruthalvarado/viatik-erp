import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { useCompany } from "@/contexts/company-context";

import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import {
  EvolucionMensualChart,
  PresupuestoEjecutadoChart,
  GastosCategoriaChart,
  GastosClienteChart,
} from "@/components/dashboard/dashboard-charts";
import {
  TopProveedores,
  TopViajeros,
  TopProyectos,
} from "@/components/dashboard/dashboard-rankings";
import { DashboardRendiciones } from "@/components/dashboard/dashboard-rendiciones";

import {
  useDashboardEjecutivo,
  useDashboardProyectos,
  useDashboardClientes,
  useDashboardProveedores,
  useDashboardIA,
  useGastosPorCategoria,
  useEvolucionMensual,
  useRendicionesPendientes,
  useTopViajeros,
  usePresupuestoTotal,
} from "@/hooks/entities/use-dashboard";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · VIATIQ" }] }),
  component: DashboardPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

function DashboardContent() {
  const { empresaActivaId, empresaActiva, loading: loadingCompany } = useCompany();
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const navigate = useNavigate();

  if (loadingCompany) {
    return <LoadingState label="Cargando empresa..." />;
  }

  if (!empresaActivaId) {
    return (
      <>
        <PageHeader title="Dashboard" description="Selecciona una empresa para ver tus métricas." />
        <EmptyState
          icon={Building2}
          title="Sin empresa activa"
          description="No tienes empresas asignadas o no has seleccionado una. Usa el selector en la barra superior."
        />
      </>
    );
  }

  return (
    <DashboardMain
      empresaId={empresaActivaId}
      empresaNombre={empresaActiva?.nombre ?? ""}
      anio={anio}
      onAnioChange={setAnio}
      onNavigate={(path) => navigate({ to: path as "/" })}
    />
  );
}

// ─── Main (empresaId garantizado) ─────────────────────────────────────────────

interface DashboardMainProps {
  empresaId: string;
  empresaNombre: string;
  anio: number;
  onAnioChange: (anio: number) => void;
  onNavigate: (path: string) => void;
}

function DashboardMain({
  empresaId,
  empresaNombre,
  anio,
  onAnioChange,
  onNavigate,
}: DashboardMainProps) {
  // KPI data
  const ejecutivo = useDashboardEjecutivo(empresaId);
  const ia = useDashboardIA(empresaId);
  const presupuesto = usePresupuestoTotal(empresaId);

  // Charts
  const evolucion = useEvolucionMensual(empresaId, anio > 0 ? anio : new Date().getFullYear());
  const proyectos = useDashboardProyectos(empresaId, 10);
  const categorias = useGastosPorCategoria(empresaId, anio > 0 ? anio : undefined);
  const clientes = useDashboardClientes(empresaId, 10);

  // Rankings
  const proveedores = useDashboardProveedores(empresaId, 8);
  const viajeros = useTopViajeros(empresaId, anio > 0 ? anio : undefined, 8);

  // Rendiciones pendientes
  const rendiciones = useRendicionesPendientes(empresaId, 10);

  const kpiLoading = ejecutivo.isLoading || ia.isLoading || presupuesto.isLoading;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          empresaNombre ? `Resumen ejecutivo de ${empresaNombre}.` : "Resumen ejecutivo."
        }
        actions={<DashboardFilters anio={anio} onAnioChange={onAnioChange} />}
      />

      {/* KPIs */}
      <DashboardKpis
        ejecutivo={ejecutivo.data}
        presupuestoTotal={presupuesto.data ?? 0}
        ia={ia.data}
        loading={kpiLoading}
      />

      {/* Evolución + Presupuesto vs ejecutado */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <EvolucionMensualChart
          data={evolucion.data ?? []}
          loading={evolucion.isLoading}
          anio={anio}
        />
        <PresupuestoEjecutadoChart data={proyectos.data ?? []} loading={proyectos.isLoading} />
      </div>

      {/* Categorías + Clientes */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <GastosCategoriaChart data={categorias.data ?? []} loading={categorias.isLoading} />
        <GastosClienteChart data={clientes.data ?? []} loading={clientes.isLoading} />
      </div>

      {/* Rankings */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <TopProveedores
          data={proveedores.data ?? []}
          loading={proveedores.isLoading}
          onNavigate={() => onNavigate("/proveedores")}
        />
        <TopViajeros data={viajeros.data ?? []} loading={viajeros.isLoading} />
        <TopProyectos
          data={proyectos.data ?? []}
          loading={proyectos.isLoading}
          onNavigate={() => onNavigate("/proyectos")}
        />
      </div>

      {/* Rendiciones pendientes */}
      <div className="mt-6">
        <DashboardRendiciones
          data={rendiciones.data ?? []}
          loading={rendiciones.isLoading}
          onNavigate={() => onNavigate("/rendiciones")}
        />
      </div>
    </>
  );
}
