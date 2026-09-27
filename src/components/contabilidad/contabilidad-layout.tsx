/**
 * Layout principal del módulo Contabilidad / NIIF.
 * Tabs: Plan de Cuentas · Asientos · Reportes · Configuración
 */
import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

import { PlanCuentasTree } from "./plan-cuentas-tree";
import { PlanCuentasForm } from "./plan-cuentas-form";
import { AsientosList } from "./asientos-list";
import { AsientoForm } from "./asiento-form";
import { BalanceGeneral } from "./balance-general";
import { EstadoResultados } from "./estado-resultados";
import { LibroMayor } from "./libro-mayor";
import { ConfigCuentas } from "./config-cuentas";

import { usePlanCuentas, useAsientos, useSaldosCuentas } from "@/hooks/entities/use-contabilidad";
import type { PlanCuenta, LineaAsiento } from "@/hooks/entities/use-contabilidad";
import type { EstadoAsiento } from "@/services/contabilidad";

interface ContabilidadLayoutProps {
  empresaId: string;
}

export function ContabilidadLayout({ empresaId }: ContabilidadLayoutProps) {
  const thisYear = new Date().getFullYear();
  const [tab, setTab] = useState("plan");
  const [reporteTab, setReporteTab] = useState("balance");

  // Filtro de período para reportes
  const [desde, setDesde] = useState(`${thisYear}-01-01`);
  const [hasta, setHasta] = useState(`${thisYear}-12-31`);

  // Plan de cuentas
  const {
    cuentas,
    loading: loadingCuentas,
    error: errorCuentas,
    crear,
    actualizar,
    eliminar,
  } = usePlanCuentas(empresaId);
  const [formCuenta, setFormCuenta] = useState<{
    open: boolean;
    cuenta?: PlanCuenta;
    parentId?: string;
  }>({ open: false });

  // Asientos
  const [filtroEstado, setFiltroEstado] = useState<EstadoAsiento | "todos">("todos");
  const asientoFiltros = useMemo(
    () => (filtroEstado !== "todos" ? { estado: filtroEstado } : undefined),
    [filtroEstado],
  );
  const {
    asientos,
    loading: loadingAsientos,
    error: errorAsientos,
    crear: crearAsiento,
    confirmar,
    reversar,
    reload: reloadAsientos,
  } = useAsientos(empresaId, asientoFiltros);
  const [asientoFormOpen, setAsientoFormOpen] = useState(false);
  const [reversarId, setReversarId] = useState<string | null>(null);

  // Saldos para reportes
  const {
    saldos,
    loading: loadingSaldos,
    error: errorSaldos,
  } = useSaldosCuentas(empresaId, desde, hasta);

  const handleGuardarCuenta = async (payload: Omit<PlanCuenta, "id" | "created_at">) => {
    if (formCuenta.cuenta) {
      await actualizar(formCuenta.cuenta.id, payload);
      toast.success("Cuenta actualizada");
    } else {
      await crear(payload);
      toast.success("Cuenta creada");
    }
  };

  const handleEliminarCuenta = async (cuenta: PlanCuenta) => {
    if (!confirm(`¿Desactivar la cuenta "${cuenta.nombre}"?`)) return;
    await eliminar(cuenta.id);
    toast.success("Cuenta desactivada");
  };

  const handleCrearAsiento = async (
    fecha: string,
    descripcion: string,
    lineas: LineaAsiento[],
    confirm_: boolean,
  ) => {
    await crearAsiento(fecha, descripcion, lineas, null, null, confirm_);
    toast.success("Asiento creado");
  };

  const handleConfirmarAsiento = async (id: string) => {
    await confirmar(id);
    toast.success("Asiento confirmado");
  };

  const handleReversarAsiento = (id: string) => {
    setReversarId(id);
    // Simple: reversar en el mismo día con descripción estándar
    const today = new Date().toISOString().split("T")[0];
    reversar(id, today, "Reverso automático")
      .then(() => toast.success("Asiento reversado"))
      .catch((e: Error) => toast.error(e.message));
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Contabilidad NIIF</h1>
        <p className="text-sm text-muted-foreground">
          Plan de cuentas, asientos contables y reportes financieros.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="plan">Plan de Cuentas</TabsTrigger>
          <TabsTrigger value="asientos">Asientos</TabsTrigger>
          <TabsTrigger value="reportes">Reportes NIIF</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        {/* ── Plan de Cuentas ── */}
        <TabsContent value="plan" className="mt-4">
          {errorCuentas && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{errorCuentas}</AlertDescription>
            </Alert>
          )}
          {loadingCuentas ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Cargando plan de cuentas…
            </p>
          ) : (
            <PlanCuentasTree
              cuentas={cuentas}
              onCrear={(parentId) => setFormCuenta({ open: true, parentId })}
              onEditar={(cuenta) => setFormCuenta({ open: true, cuenta })}
              onEliminar={handleEliminarCuenta}
            />
          )}
        </TabsContent>

        {/* ── Asientos ── */}
        <TabsContent value="asientos" className="mt-4">
          {errorAsientos && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{errorAsientos}</AlertDescription>
            </Alert>
          )}
          <AsientosList
            asientos={asientos}
            loading={loadingAsientos}
            onConfirmar={handleConfirmarAsiento}
            onReversar={handleReversarAsiento}
            onNuevo={() => setAsientoFormOpen(true)}
            filtroEstado={filtroEstado}
            onFiltroEstado={setFiltroEstado}
          />
        </TabsContent>

        {/* ── Reportes NIIF ── */}
        <TabsContent value="reportes" className="mt-4 space-y-4">
          {/* Filtro de período */}
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                className="h-8 w-40 text-sm"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                className="h-8 w-40 text-sm"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
          </div>

          {errorSaldos && (
            <Alert variant="destructive">
              <AlertDescription>{errorSaldos}</AlertDescription>
            </Alert>
          )}
          {loadingSaldos && (
            <p className="py-8 text-center text-sm text-muted-foreground">Calculando saldos…</p>
          )}

          {!loadingSaldos && !errorSaldos && (
            <Tabs value={reporteTab} onValueChange={setReporteTab}>
              <TabsList>
                <TabsTrigger value="balance">Balance General</TabsTrigger>
                <TabsTrigger value="resultados">Estado de Resultados</TabsTrigger>
                <TabsTrigger value="mayor">Libro Mayor</TabsTrigger>
              </TabsList>

              <TabsContent value="balance" className="mt-4">
                <BalanceGeneral saldos={saldos} hasta={hasta} />
              </TabsContent>
              <TabsContent value="resultados" className="mt-4">
                <EstadoResultados saldos={saldos} desde={desde} hasta={hasta} />
              </TabsContent>
              <TabsContent value="mayor" className="mt-4">
                <LibroMayor empresaId={empresaId} cuentas={cuentas} />
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        {/* ── Configuración ── */}
        <TabsContent value="config" className="mt-4">
          <ConfigCuentas empresaId={empresaId} cuentas={cuentas} />
        </TabsContent>
      </Tabs>

      {/* Modales */}
      <PlanCuentasForm
        open={formCuenta.open}
        cuenta={formCuenta.cuenta}
        parentId={formCuenta.parentId}
        empresaId={empresaId}
        cuentas={cuentas}
        onGuardar={handleGuardarCuenta}
        onClose={() => setFormCuenta({ open: false })}
      />

      <AsientoForm
        open={asientoFormOpen}
        cuentas={cuentas}
        empresaId={empresaId}
        onGuardar={handleCrearAsiento}
        onClose={() => setAsientoFormOpen(false)}
      />
    </div>
  );
}
