import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Receipt, ClipboardList, TrendingUp, Brain, Building2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { MetricCard } from "@/components/common/metric-card";
import { LoadingState } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { useCompany } from "@/contexts/company-context";
import { formatCurrency, formatDate, formatNumber } from "@/utils/formatters";
import type { Tables } from "@/types/database";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Viatik" }] }),
  component: DashboardPage,
});

type Ejecutivo = Tables<"vw_dashboard_ejecutivo">;
type DashboardProyecto = Tables<"vw_dashboard_proyectos">;
type DashboardIA = Tables<"vw_dashboard_ia">;
type Gasto = Tables<"gastos">;
type Rendicion = Tables<"rendiciones">;

function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const { empresaActivaId, empresaActiva, loading: loadingCompany } = useCompany();

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
    <>
      <PageHeader
        title="Dashboard"
        description={
          empresaActiva?.nombre
            ? `Resumen operativo y financiero de ${empresaActiva.nombre}.`
            : "Resumen operativo y financiero."
        }
      />
      <DashboardMetrics empresaId={empresaActivaId} />
      <DashboardSecondary empresaId={empresaActivaId} />
      <DashboardLatest empresaId={empresaActivaId} />
    </>
  );
}

function useEjecutivo(empresaId: string) {
  return useQuery({
    queryKey: ["vw_dashboard_ejecutivo", empresaId],
    queryFn: async (): Promise<Ejecutivo | null> => {
      const { data, error } = await supabase
        .from("vw_dashboard_ejecutivo")
        .select("*")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

function usePresupuestoTotal(empresaId: string) {
  return useQuery({
    queryKey: ["presupuestos", "total", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presupuestos")
        .select("valor_total")
        .eq("empresa_id", empresaId)
        .eq("activo", true);
      if (error) throw new Error(error.message);
      return (data ?? []).reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
    },
  });
}

function usePendientesCount(
  empresaId: string,
  table: "rendiciones" | "gastos",
  estadoCol: "estado_rendicion_id" | "estado_gasto_id",
  estadoTable: "estados_rendicion" | "estados_gasto",
) {
  return useQuery({
    queryKey: [table, "pendientes", empresaId],
    queryFn: async () => {
      // Busca códigos típicos de pendiente
      const { data: estados, error: estErr } = await supabase
        .from(estadoTable)
        .select("id, codigo")
        .in("codigo", ["pendiente", "borrador", "en_revision"]);
      if (estErr) throw new Error(estErr.message);
      const ids = (estados ?? []).map((e) => e.id);
      if (ids.length === 0) return 0;

      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .in(estadoCol, ids);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}

function DashboardMetrics({ empresaId }: { empresaId: string }) {
  const ejecutivo = useEjecutivo(empresaId);
  const presupuesto = usePresupuestoTotal(empresaId);
  const rendPend = usePendientesCount(
    empresaId,
    "rendiciones",
    "estado_rendicion_id",
    "estados_rendicion",
  );
  const gastosPend = usePendientesCount(empresaId, "gastos", "estado_gasto_id", "estados_gasto");

  const totalGastado = ejecutivo.data?.total_gastado ?? 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Total Gastos"
        value={ejecutivo.isLoading ? "—" : formatCurrency(totalGastado)}
        hint={ejecutivo.error ? "Error al cargar" : undefined}
        icon={Wallet}
      />
      <MetricCard
        label="Presupuesto activo"
        value={presupuesto.isLoading ? "—" : formatCurrency(presupuesto.data ?? 0)}
        icon={TrendingUp}
      />
      <MetricCard
        label="Rendiciones pendientes"
        value={rendPend.isLoading ? "—" : formatNumber(rendPend.data ?? 0)}
        icon={ClipboardList}
      />
      <MetricCard
        label="Gastos pendientes"
        value={gastosPend.isLoading ? "—" : formatNumber(gastosPend.data ?? 0)}
        icon={Receipt}
      />
    </div>
  );
}

function DashboardSecondary({ empresaId }: { empresaId: string }) {
  const ejecutivo = useEjecutivo(empresaId);
  const ia = useQuery({
    queryKey: ["vw_dashboard_ia", empresaId],
    queryFn: async (): Promise<DashboardIA | null> => {
      const { data, error } = await supabase
        .from("vw_dashboard_ia")
        .select("*")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Reembolsable"
        value={formatCurrency(ejecutivo.data?.total_reembolsable ?? 0)}
        icon={Wallet}
      />
      <MetricCard
        label="Anticipos"
        value={formatCurrency(ejecutivo.data?.total_anticipos ?? 0)}
        icon={Receipt}
      />
      <MetricCard
        label="Proyectos con movimiento"
        value={formatNumber(ejecutivo.data?.total_proyectos_con_movimiento ?? 0)}
        icon={TrendingUp}
      />
      <MetricCard
        label="Score IA promedio"
        value={
          ia.data?.score_promedio !== null && ia.data?.score_promedio !== undefined
            ? Number(ia.data.score_promedio).toFixed(1)
            : "—"
        }
        hint={
          ia.data?.total_auditorias
            ? `${formatNumber(ia.data.total_auditorias)} auditorías`
            : undefined
        }
        icon={Brain}
      />
    </div>
  );
}

function DashboardLatest({ empresaId }: { empresaId: string }) {
  const gastos = useQuery({
    queryKey: ["gastos", "latest", empresaId],
    queryFn: async (): Promise<Gasto[]> => {
      const { data, error } = await supabase
        .from("gastos")
        .select("*")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null)
        .order("fecha", { ascending: false })
        .limit(5);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const rendiciones = useQuery({
    queryKey: ["rendiciones", "latest", empresaId],
    queryFn: async (): Promise<Rendicion[]> => {
      const { data, error } = await supabase
        .from("rendiciones")
        .select("*")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null)
        .order("fecha_rendicion", { ascending: false })
        .limit(5);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const proyectos = useQuery({
    queryKey: ["vw_dashboard_proyectos", empresaId],
    queryFn: async (): Promise<DashboardProyecto[]> => {
      const { data, error } = await supabase
        .from("vw_dashboard_proyectos")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("gasto_real", { ascending: false })
        .limit(5);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <Panel title="Últimos gastos" loading={gastos.isLoading}>
        {gastos.data && gastos.data.length > 0 ? (
          <ul className="divide-y">
            {gastos.data.map((g) => (
              <li key={g.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {g.descripcion ?? g.numero_documento ?? "Gasto"}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(g.fecha)}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(g.valor_moneda_base ?? g.valor_factura ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Sin gastos recientes" />
        )}
      </Panel>

      <Panel title="Últimas rendiciones" loading={rendiciones.isLoading}>
        {rendiciones.data && rendiciones.data.length > 0 ? (
          <ul className="divide-y">
            {rendiciones.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {r.numero ?? r.descripcion ?? "Rendición"}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.fecha_rendicion)}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(r.total_facturado ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Sin rendiciones recientes" />
        )}
      </Panel>

      <Panel
        title="Top proyectos por gasto real"
        loading={proyectos.isLoading}
        className="lg:col-span-2"
      >
        {proyectos.data && proyectos.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Proyecto</th>
                  <th className="py-2 pr-4 text-right">Presupuesto</th>
                  <th className="py-2 pr-4 text-right">Gasto real</th>
                  <th className="py-2 pr-4 text-right">Saldo</th>
                  <th className="py-2 text-right">Margen est.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {proyectos.data.map((p) => (
                  <tr key={p.proyecto_id ?? p.nombre ?? Math.random()}>
                    <td className="py-2 pr-4 font-medium">{p.nombre ?? "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(p.presupuesto ?? 0)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(p.gasto_real ?? 0)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(p.saldo_presupuesto ?? 0)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCurrency(p.margen_estimado ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Sin proyectos con movimiento" />
        )}
      </Panel>
    </div>
  );
}

function Panel({
  title,
  loading,
  className,
  children,
}: {
  title: string;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border bg-card p-5 ${className ?? ""}`}>
      <h2 className="mb-3 text-sm font-semibold tracking-tight">{title}</h2>
      {loading ? <LoadingState label="Cargando..." /> : children}
    </section>
  );
}
