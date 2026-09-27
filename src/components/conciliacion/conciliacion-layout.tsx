/**
 * conciliacion-layout.tsx
 * Orquestador principal del módulo Conciliación Bancaria.
 */
import { useState } from "react";
import { Plus, Upload, Landmark, RefreshCw, CheckCircle2, Clock, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/page-header";
import { formatCurrency } from "@/utils/formatters";
import { toast } from "@/components/common/toast";
import {
  useCuentasBancarias,
  useDeleteCuenta,
  useResumenConciliacion,
} from "@/hooks/entities/use-conciliacion";
import { useFacturasEmitidas } from "@/hooks/entities/use-facturas-emitidas";
import { useGastosEmpresa } from "@/hooks/entities/use-gastos-empresa";
import { CuentaForm } from "./cuenta-form";
import { ImportDialog } from "./import-dialog";
import { MovimientosTable } from "./movimientos-table";
import type { CuentaBancaria } from "@/services/conciliacion";

interface Props {
  empresaId: string;
}

export function ConciliacionLayout({ empresaId }: Props) {
  const [cuentaSelId, setCuentaSelId] = useState<string | null>(null);
  const [showCuentaForm, setShowCuentaForm] = useState(false);
  const [editCuenta, setEditCuenta] = useState<CuentaBancaria | undefined>();
  const [showImport, setShowImport] = useState(false);

  const { data: cuentas = [], isLoading: loadingCuentas } = useCuentasBancarias(empresaId);
  const { data: resumen } = useResumenConciliacion(empresaId, cuentaSelId ?? undefined);
  const { data: facturas = [] } = useFacturasEmitidas(empresaId);
  const { data: gastos = [] } = useGastosEmpresa(empresaId);
  const deleteCuenta = useDeleteCuenta();

  const cuentaActiva = cuentas.find((c) => c.id === cuentaSelId) ?? cuentas[0] ?? null;

  // Auto-seleccionar primera cuenta
  if (!cuentaSelId && cuentas.length > 0 && !loadingCuentas) {
    setCuentaSelId(cuentas[0].id);
  }

  async function handleDeleteCuenta(id: string) {
    if (!confirm("¿Desactivar esta cuenta? Los movimientos se conservan.")) return;
    try {
      await deleteCuenta.mutateAsync(id);
      if (cuentaSelId === id) setCuentaSelId(null);
      toast.success("Cuenta desactivada");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conciliación Bancaria"
        description="Importa extractos bancarios y concilia movimientos con facturas y gastos."
        breadcrumbs={[{ label: "Finanzas" }, { label: "Conciliación Bancaria" }]}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditCuenta(undefined);
              setShowCuentaForm(true);
            }}
          >
            <Plus className="size-4 mr-1.5" />
            Nueva cuenta
          </Button>
        }
      />

      {/* KPIs de resumen */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Sin conciliar"
            value={resumen.sin_conciliar}
            sub={formatCurrency(resumen.monto_pendiente)}
            icon={<Clock className="size-4 text-amber-500" />}
            color="amber"
          />
          <KpiCard
            label="Conciliados"
            value={resumen.conciliados}
            icon={<CheckCircle2 className="size-4 text-emerald-600" />}
            color="green"
          />
          <KpiCard
            label="Ignorados"
            value={resumen.ignorados}
            icon={<EyeOff className="size-4 text-muted-foreground" />}
            color="neutral"
          />
          <KpiCard
            label="Total movimientos"
            value={resumen.total}
            icon={<RefreshCw className="size-4 text-blue-500" />}
            color="blue"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
        {/* Panel izquierdo: cuentas */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            Cuentas bancarias
          </p>
          {loadingCuentas && <p className="text-xs text-muted-foreground px-1">Cargando…</p>}
          {cuentas
            .filter((c) => c.activa)
            .map((c) => (
              <div
                key={c.id}
                className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                  cuentaSelId === c.id ? "border-primary bg-primary/5" : "hover:bg-muted/20"
                }`}
                onClick={() => setCuentaSelId(c.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Landmark className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium truncate">{c.nombre}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {c.banco} · {c.moneda}
                </p>
                {c.numero_cuenta && (
                  <p className="text-[10px] text-muted-foreground font-mono">{c.numero_cuenta}</p>
                )}
                <div className="flex gap-1 mt-2">
                  <button
                    type="button"
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditCuenta(c);
                      setShowCuentaForm(true);
                    }}
                  >
                    Editar
                  </button>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-[10px] text-destructive/70 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteCuenta(c.id);
                    }}
                  >
                    Desactivar
                  </button>
                </div>
              </div>
            ))}
          {cuentas.filter((c) => c.activa).length === 0 && !loadingCuentas && (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-xs text-muted-foreground">
                No hay cuentas registradas.
                <br />
                Crea una para empezar.
              </p>
            </div>
          )}
        </div>

        {/* Panel derecho: movimientos */}
        <div className="space-y-3">
          {cuentaActiva ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{cuentaActiva.nombre}</p>
                <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
                  <Upload className="size-3.5 mr-1.5" />
                  Importar extracto
                </Button>
              </div>
              <MovimientosTable
                empresaId={empresaId}
                cuentaId={cuentaActiva.id}
                facturas={facturas}
                gastos={gastos}
              />
            </>
          ) : (
            <div className="rounded-lg border border-dashed flex items-center justify-center h-48">
              <p className="text-sm text-muted-foreground">
                Selecciona una cuenta bancaria para ver sus movimientos.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dialog: crear / editar cuenta */}
      <Dialog open={showCuentaForm} onOpenChange={setShowCuentaForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editCuenta ? "Editar cuenta" : "Nueva cuenta bancaria"}</DialogTitle>
          </DialogHeader>
          <CuentaForm
            empresaId={empresaId}
            cuenta={editCuenta}
            onDone={() => setShowCuentaForm(false)}
            onCancel={() => setShowCuentaForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: importar extracto */}
      {cuentaActiva && (
        <ImportDialog
          open={showImport}
          onOpenChange={setShowImport}
          cuenta={cuentaActiva}
          empresaId={empresaId}
        />
      )}
    </div>
  );
}

// ─── Mini KPI ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  color: "amber" | "green" | "blue" | "neutral";
}

function KpiCard({ label, value, sub, icon, color }: KpiCardProps) {
  const valueClass = {
    amber: "text-amber-700",
    green: "text-emerald-700",
    blue: "text-blue-700",
    neutral: "text-foreground",
  }[color];

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
