/**
 * bg-sync-dialog.tsx
 * Dialog para sincronizar movimientos desde el API del Banco Guayaquil.
 */
import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/common/toast";
import { useSyncBancoGuayaquil } from "@/hooks/entities/use-conciliacion";
import type { CuentaBancaria } from "@/services/conciliacion";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(date: Date) {
  return date.toISOString().split("T")[0];
}

function defaultDesde() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return toISO(d);
}

function defaultHasta() {
  return toISO(new Date());
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cuenta: CuentaBancaria;
  empresaId: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function BgSyncDialog({ open, onOpenChange, cuenta, empresaId }: Props) {
  const [fechaDesde, setFechaDesde] = useState(defaultDesde);
  const [fechaHasta, setFechaHasta] = useState(defaultHasta);

  const sync = useSyncBancoGuayaquil();
  const isLoading = sync.isPending;

  async function handleSync() {
    if (!fechaDesde || !fechaHasta) {
      toast.error("Ingresa el rango de fechas.");
      return;
    }
    if (fechaDesde > fechaHasta) {
      toast.error("La fecha inicial no puede ser mayor a la final.");
      return;
    }

    try {
      const result = await sync.mutateAsync({
        cuenta_id: cuenta.id,
        empresa_id: empresaId,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      });

      if (result.message) {
        toast.info(result.message);
      } else {
        toast.success(
          `Sincronización completada: ${result.insertados} nuevos, ${result.duplicados} ya existían.`,
        );
      }

      onOpenChange(false);
    } catch (err) {
      const msg = (err as Error).message;

      // Mensaje amigable cuando los secrets no están configurados
      if (msg.includes("Secrets no configurados") || msg.includes("BG_CLIENT_ID")) {
        toast.error(
          "Las credenciales del Banco Guayaquil no están configuradas. Agrega los secrets en Supabase.",
        );
      } else {
        toast.error(`Error: ${msg}`);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-4 text-primary" />
            Sincronizar Banco Guayaquil
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info de la cuenta */}
          <div className="rounded-lg bg-muted/40 border px-3 py-2 text-sm">
            <p className="font-medium">{cuenta.nombre}</p>
            {cuenta.numero_cuenta && (
              <p className="text-muted-foreground font-mono text-xs">{cuenta.numero_cuenta}</p>
            )}
          </div>

          {/* Aviso de configuración */}
          <div className="flex gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
            <Info className="size-3.5 shrink-0 mt-0.5" />
            <span>
              Requiere los secrets <code className="font-mono">BG_CLIENT_ID</code>,{" "}
              <code className="font-mono">BG_CLIENT_SECRET</code> y{" "}
              <code className="font-mono">BG_ACCOUNT_ID</code> configurados en Supabase
              Edge Functions → Secrets.
            </span>
          </div>

          {/* Rango de fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bg-desde" className="text-xs">
                Desde
              </Label>
              <Input
                id="bg-desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                max={fechaHasta}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bg-hasta" className="text-xs">
                Hasta
              </Label>
              <Input
                id="bg-hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                min={fechaDesde}
                max={toISO(new Date())}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Rango máximo: 360 días. Los movimientos ya importados no se duplican.
          </p>

          {/* Resultado de la última sincronización */}
          {sync.isSuccess && sync.data && !sync.data.message && (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
              <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Sincronización exitosa</p>
                <p>
                  {sync.data.insertados} movimientos nuevos · {sync.data.duplicados} ya existían
                </p>
                <p>
                  {sync.data.total_api} registros del API · {sync.data.total_paginas} página(s)
                </p>
              </div>
            </div>
          )}

          {sync.isError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <span>{(sync.error as Error).message}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSync()} disabled={isLoading}>
            {isLoading ? (
              <>
                <RefreshCw className="size-3.5 mr-1.5 animate-spin" />
                Sincronizando…
              </>
            ) : (
              <>
                <RefreshCw className="size-3.5 mr-1.5" />
                Sincronizar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
