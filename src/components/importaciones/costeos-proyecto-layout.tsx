/**
 * costeos-proyecto-layout.tsx
 * Lista de Costeos de Proyecto con KPIs, filtro de estado y acciones.
 */
import { useState } from "react";
import {
  Plus, FolderKanban, Clock, CheckCircle2,
  Pencil, Eye, TrendingUp, ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { useCosteoProyectos } from "@/hooks/entities/use-costeos-proyecto";
import type { CosteoProyectoConItems } from "@/services/costeos-proyecto";
import { CosteoProyectoForm }   from "./costeo-proyecto-form";
import { CosteoProyectoDetalle } from "./costeo-proyecto-detalle";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

const ESTADO_CFG = {
  borrador:   { label: "Borrador",   className: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Clock },
  finalizado: { label: "Finalizado", className: "bg-green-50 text-green-700 border-green-200",    icon: CheckCircle2 },
} as const;

// ── Componente ────────────────────────────────────────────────────────────────
export function CosteosProyectoLayout() {
  const { data: costeos = [], isLoading } = useCosteoProyectos();

  const [filtro, setFiltro]     = useState<"todos" | "borrador" | "finalizado">("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<CosteoProyectoConItems | null>(null);
  const [detalle, setDetalle]   = useState<CosteoProyectoConItems | null>(null);

  const filtrados = costeos.filter(
    (c) => filtro === "todos" || c.estado === filtro,
  );

  // KPIs
  const finalizados   = costeos.filter((c) => c.estado === "finalizado").length;
  const totalAterrizaje = costeos
    .filter((c) => c.estado === "finalizado")
    .reduce((s, c) => s + c.total_costo_aterrizaje, 0);
  const totalVenta = costeos
    .filter((c) => c.estado === "finalizado")
    .reduce((s, c) => s + c.total_precio_venta, 0);

  return (
    <div className="space-y-6">
      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total costeos</p>
          <p className="text-2xl font-bold">{costeos.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{finalizados} finalizados</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Costo aterrizaje (finalizados)</p>
          <p className="text-2xl font-bold text-orange-700">{fmt(totalAterrizaje)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Precio venta sugerido (finalizados)</p>
          <p className="text-2xl font-bold text-green-700">{fmt(totalVenta)}</p>
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["todos", "borrador", "finalizado"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filtro === f ? "default" : "outline"}
              onClick={() => setFiltro(f)}
              className="capitalize"
            >
              {f === "todos" ? "Todos" : ESTADO_CFG[f].label}
            </Button>
          ))}
        </div>
        <Button onClick={() => { setEditando(null); setFormOpen(true); }} className="gap-1.5">
          <Plus className="size-4" />
          Nuevo costeo de proyecto
        </Button>
      </div>

      {/* ── Tabla ── */}
      {isLoading && <p className="text-sm text-muted-foreground animate-pulse">Cargando…</p>}

      {!isLoading && filtrados.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <FolderKanban className="size-10 opacity-30" />
          <p className="text-sm">No hay costeos de proyecto{filtro !== "todos" ? ` en estado "${filtro}"` : ""}.</p>
          <Button size="sm" variant="outline" onClick={() => { setEditando(null); setFormOpen(true); }} className="gap-1.5">
            <Plus className="size-3.5" />
            Crear primer costeo de proyecto
          </Button>
        </div>
      )}

      {filtrados.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead>Cotización</TableHead>
                <TableHead className="text-right">FOB total</TableHead>
                <TableHead className="text-right">Costo aterrizaje</TableHead>
                <TableHead className="text-right">Precio venta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((cp) => {
                const cfg = ESTADO_CFG[cp.estado];
                const Icon = cfg.icon;
                return (
                  <TableRow key={cp.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs font-medium">{cp.numero}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm">{cp.descripcion}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cp.proyecto?.nombre ?? <span className="italic text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {cp.cotizacion?.numero ?? <span className="italic text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm">{fmt(cp.total_fob_usd)}</TableCell>
                    <TableCell className="text-right text-sm font-medium text-orange-700">{fmt(cp.total_costo_aterrizaje)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-green-700">{fmt(cp.total_precio_venta)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${cfg.className} text-[10px] gap-1`}>
                        <Icon className="size-2.5" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(cp.created_at), "dd/MM/yy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => setDetalle(cp)}>
                          <Eye className="size-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => { setEditando(cp); setFormOpen(true); }}>
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Form ── */}
      <CosteoProyectoForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditando(null); }}
        costeo={editando}
      />

      {/* ── Detalle ── */}
      {detalle && (
        <CosteoProyectoDetalle
          costeo={detalle}
          open={!!detalle}
          onClose={() => setDetalle(null)}
          onEdit={() => { setEditando(detalle); setDetalle(null); setFormOpen(true); }}
        />
      )}
    </div>
  );
}
