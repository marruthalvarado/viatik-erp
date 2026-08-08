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
  EvolucionFinancieraChart,
  ResumenProyectosChart,
  GastosCategoriaChart,
  GastosClienteChart,
} from "@/components/dashboard/dashboard-charts";
import {
  TopProveedores,
  TopViajeros,
  TopProyectos,
} from "@/components/dashboard/dashboard-rankings";
import { DashboardRendiciones } from "@/components/dashboard/dashboard-rendiciones";
import { DashboardCobros } from "@/components/dashboard/dashboard-cobros";

import {
  useDashboardEjecutivo,
  useDashboardProyectos,
  useDashboardClientes,
  useDashboardProveedores,
  useDashboardIA,
  useGastosPorCategoria,
  useRendicionesPendientes,
  useTopViajeros,
  useResumenFinancieroProyectos,
  useKpisNegocio,
  useEvolucionFinanciera,
  useProyectosSimples,
} from "@/hooks/entities/use-dashboard";
import { useResumenCobros } from "@/hooks/entities/use-cobros";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · VIATIQ" }] }),
  component: DashboardPage,
});

// --- Page --------------------------------------------------------------------

function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

// --- Content -----------------------------------------------------------------

function DashboardContent() {
  const { empresaActivaId, empresaActiva, loading: loadingCompany } = useCompany();
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [mes, setMes] = useState<number | null>(null);
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const navigate = useNavigate();

  if (loadingCompany) {
    return <LoadingState label="Cargando empresa..." />;
  }

  if (!empresaActivaId) {
    return (
      <>
        <PageHeader title="Dashboard" description="Selecciona una empresa para ver tus metricas." />
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
      onAnioChange={(a) => { setAnio(a); setMes(null); }}
      mes={mes}
      onMesChange={setMes}
      proyectoId={proyectoId}
      onProyectoChange={setProyectoId}
      onNavigate={(path) => navigate({ to: path as "/" })}
    />
  );
}

// --- Main (empresaId garantizado) --------------------------------------------

interface DashboardMainProps {
  empresaId: string;
  empresaNombre: string;
  anio: number;
  onAnioChange: (anio: number) => void;
  mes: number | null;
  onMesChange: (mes: number | null) => void;
  proyectoId: string | null;
  onProyectoChange: (id: string | null) => void;
  onNavigate: (path: string) => void;
}

function DashboardMain({
  empresaId,
  empresaNombre,
  anio,
  onAnioChange,
  mes,
  onMesChange,
  proyectoId,
  onProyectoChange,
  onNavigate,
}: DashboardMainProps) {
  const anioFiltro = anio > 0 ? anio : undefined;

  // Datos financieros del negocio (fuentes correctas)
  const kpisNegocio = useKpisNegocio(empresaId, anioFiltro, proyectoId, mes);
  const evolucionFinanciera = useEvolucionFinanciera(
    empresaId,
    anio > 0 ? anio : new Date().getFullYear(),
    proyectoId,
  );

  // KPI ejecutivo (operativos: rendiciones, viajeros, proyectos)
  const ejecutivo = useDashboardEjecutivo(empresaId, anioFiltro);
  const ia = useDashboardIA(empresaId);

  // Selector de proyectos para filtro
  const proyectosSimples = useProyectosSimples(empresaId);

  // Tablas de análisis
  const resumenProyectos = useResumenFinancieroProyectos(empresaId);
  const categorias = useGastosPorCategoria(empresaId, anioFiltro);
  const clientes = useDashboardClientes(empresaId, 10, anioFiltro);

  // Rankings
  const proveedores = useDashboardProveedores(empresaId, 8, anioFiltro);
  const viajeros = useTopViajeros(empresaId, anioFiltro, 8);
  const proyectos = useDashboardProyectos(empresaId, 10, anioFiltro);

  // Pendientes
  const rendiciones = useRendicionesPendientes(empresaId, 10);
  const cobros = useResumenCobros(empresaId);

  const kpiLoading = kpisNegocio.isLoading || ejecutivo.isLoading || ia.isLoading;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          empresaNombre ? `Resumen ejecutivo de ${empresaNombre}.` : "Resumen ejecutivo."
        }
        actions={
          <DashboardFilters
            anio={anio}
            onAnioChange={onAnioChange}
            mes={mes}
            onMesChange={onMesChange}
            proyectoId={proyectoId}
            onProyectoChange={onProyectoChange}
            proyectos={proyectosSimples.data ?? []}
          />
        }
      />

      {/* KPIs */}
      <DashboardKpis
        ejecutivo={ejecutivo.data}
        kpisNegocio={kpisNegocio.data}
        ia={ia.data}
        loading={kpiLoading}
      />

      {/* Evolución financiera + Rentabilidad por proyecto */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <EvolucionFinancieraChart
          data={evolucionFinanciera.data ?? []}
          loading={evolucionFinanciera.isLoading}
          anio={anio}
        />
        <ResumenProyectosChart
          data={resumenProyectos.data ?? []}
          loading={resumenProyectos.isLoading}
        />
      </div>

      {/* Categorias + Clientes */}
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

      {/* Cuentas por cobrar */}
      <div className="mt-6">
        <DashboardCobros
          data={cobros.data}
          loading={cobros.isLoading}
          onNavigate={() => onNavigate("/facturas")}
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
