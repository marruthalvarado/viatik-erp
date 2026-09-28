/**
 * Layout: Contratos de Mantenimiento
 */
import { useState } from "react";
import { Plus, FileCheck, CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  useContratosMantenimiento,
  useCrearContratoMantenimiento,
  useActualizarContratoMantenimiento,
  useEliminarContratoMantenimiento,
} from "@/hooks/entities/use-servicio-tecnico";
import type { ContratoConRelaciones, ContratoPayload } from "@/services/servicio-tecnico/contratos-mantenimiento";
import { ContratoForm } from "./contrato-form";

const ESTADO_CFG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  activo:    { label: "Activo",    className: "bg-green-50 text-green-700 border-green-200",  icon: CheckCircle2 },
  vencido:   { label: "Vencido",   className: "bg-yellow-50 text-yellow-700 border-yellow-200",icon: Clock },
  cancelado: { label: "Cancelado", className: "bg-red-50 text-red-600 border-red-200",        icon: XCircle },
};

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado] ?? ESTADO_CFG["activo"];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`text-xs ${cfg.className}`}>
      <Icon className="size-3 mr-1" />{cfg.label}
    </Badge>
  );
}

export function ContratosLayout() {
  const { data: contratos = [], isLoading } = useContratosMantenimiento();
  const crear = useCrearContratoMantenimiento();
  const actualizar = useActualizarContratoMantenimiento();
  const eliminar = useEliminarContratoMantenimiento();

  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<ContratoConRelaciones | null>(null);

  const filtrados = contratos.filter((c) => {
    const q = busqueda.toLowerCase();
    return (
      (c.numero ?? "").toLowerCase().includes(q) ||
      (c.cliente?.nombre ?? "").toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (payload: ContratoPayload, equipos: string[]) => {
    try {
      if (editando) {
        await actualizar.mutateAsync({ id: editando.id, payload, equipos });
        toast.success("Contrato actualizado");
      } else {
        const res = await crear.mutateAsync({ payload, equipos });
        toast.success(`Contrato ${res.numero} creado`);
      }
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  };

  const handleEliminar = async (c: ContratoConRelaciones) => {
    if (!confirm(`¿Eliminar el contrato ${c.numero}?`)) return;
    try {
      await eliminar.mutateAsync(c.id);
      toast.success("Contrato eliminado");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const fmtDate = (d: string | null | undefined) =>
    d ? format(new Date(d), "dd/MM/yyyy", { locale: es }) : "—";

  const fmtMoney = (n: number | null | undefined) =>
    n != null ? `$${n.toLocaleString("es-EC", { minimumFractionDigits: 2 })}` : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FileCheck className="size-5 text-primary" />
            Contratos de Mantenimiento
          </h1>
          <p className="text-sm text-muted-foreground">
            Acuerdos de servicio técnico con clientes: preventivos y correctivos.
          </p>
        </div>
        <Button onClick={() => { setEditando(null); setFormOpen(true); }}>
          <Plus className="size-4 mr-1" />Nuevo contrato
        </Button>
      </div>

      <Input
        placeholder="Buscar por número o cliente…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
      ) : filtrados.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <FileCheck className="size-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">Sin contratos registrados</p>
          <p className="text-sm">Crea el primer contrato de mantenimiento.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Equipos</TableHead>
                <TableHead>Servicios</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.numero}</TableCell>
                  <TableCell className="text-sm">{c.cliente?.nombre ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDate(c.fecha_inicio)} → {fmtDate(c.fecha_fin)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge variant="secondary">{c.equipos?.length ?? 0} equipo{(c.equipos?.length ?? 0) !== 1 ? "s" : ""}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[
                      c.incluye_preventivos ? "Prev." : null,
                      c.incluye_correctivos ? "Corr." : null,
                    ].filter(Boolean).join(" + ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{fmtMoney(c.valor_contrato)}</TableCell>
                  <TableCell><EstadoBadge estado={c.estado ?? "activo"} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditando(c); setFormOpen(true); }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleEliminar(c)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ContratoForm
        open={formOpen}
        contrato={editando}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
