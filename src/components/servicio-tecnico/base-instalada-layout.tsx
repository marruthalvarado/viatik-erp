/**
 * Layout: Base Instalada (Equipos Instalados)
 */
import { useState } from "react";
import { Plus, Wrench, Shield, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
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
  useEquiposInstalados,
  useCrearEquipoInstalado,
  useActualizarEquipoInstalado,
  useEliminarEquipoInstalado,
} from "@/hooks/entities/use-servicio-tecnico";
import type {
  EquipoInstaladoConRelaciones,
  EquipoInstaladoPayload,
} from "@/services/servicio-tecnico/equipos-instalados";
import { EquipoForm } from "./equipo-form";

const ESTADO_CFG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  activo:           { label: "Activo",           className: "bg-green-50 text-green-700 border-green-200",  icon: CheckCircle2 },
  en_mantenimiento: { label: "En mantenimiento", className: "bg-blue-50 text-blue-700 border-blue-200",     icon: Wrench },
  fuera_servicio:   { label: "Fuera de servicio",className: "bg-yellow-50 text-yellow-700 border-yellow-200",icon: AlertCircle },
  baja:             { label: "Baja",             className: "bg-red-50 text-red-600 border-red-200",        icon: XCircle },
};

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado] ?? { label: estado, className: "bg-gray-50 text-gray-600 border-gray-200", icon: CheckCircle2 };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`text-xs ${cfg.className}`}>
      <Icon className="size-3 mr-1" />{cfg.label}
    </Badge>
  );
}

export function BaseInstaladaLayout() {
  const { data: equipos = [], isLoading } = useEquiposInstalados();
  const crear = useCrearEquipoInstalado();
  const actualizar = useActualizarEquipoInstalado();
  const eliminar = useEliminarEquipoInstalado();

  const [busqueda, setBusqueda] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<EquipoInstaladoConRelaciones | null>(null);

  const filtrados = equipos.filter((e) => {
    const q = busqueda.toLowerCase();
    return (
      e.nombre.toLowerCase().includes(q) ||
      (e.numero_serie ?? "").toLowerCase().includes(q) ||
      (e.fabricante ?? "").toLowerCase().includes(q) ||
      (e.cliente?.nombre ?? "").toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (payload: EquipoInstaladoPayload) => {
    try {
      if (editando) {
        await actualizar.mutateAsync({ id: editando.id, payload });
        toast.success("Equipo actualizado");
      } else {
        await crear.mutateAsync(payload);
        toast.success("Equipo registrado en la base instalada");
      }
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  };

  const handleEliminar = async (e: EquipoInstaladoConRelaciones) => {
    if (!confirm(`¿Dar de baja el equipo "${e.nombre}"?`)) return;
    try {
      await eliminar.mutateAsync(e.id);
      toast.success("Equipo eliminado");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const fmtDate = (d: string | null) =>
    d ? format(new Date(d), "dd/MM/yyyy", { locale: es }) : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            Base Instalada
          </h1>
          <p className="text-sm text-muted-foreground">
            Equipos instalados en clientes — historial, garantías y mantenimiento.
          </p>
        </div>
        <Button onClick={() => { setEditando(null); setFormOpen(true); }}>
          <Plus className="size-4 mr-1" />Nuevo equipo
        </Button>
      </div>

      <Input
        placeholder="Buscar por nombre, serie, fabricante o cliente…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
      ) : filtrados.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Shield className="size-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium">Sin equipos registrados</p>
          <p className="text-sm">Registra el primer equipo o espera que se auto-cree desde una cotización aprobada.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Instalación</TableHead>
                <TableHead>Garantía hasta</TableHead>
                <TableHead>Próximo mant.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((eq) => (
                <TableRow key={eq.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{eq.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {[eq.fabricante, eq.modelo].filter(Boolean).join(" · ")}
                        {eq.numero_serie && <span className="ml-1">· S/N: {eq.numero_serie}</span>}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{eq.cliente?.nombre ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                    {eq.ubicacion_instalacion ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{fmtDate(eq.fecha_instalacion)}</TableCell>
                  <TableCell className="text-sm">
                    {eq.garantia_hasta ? (
                      <span className={new Date(eq.garantia_hasta) < new Date() ? "text-red-600" : ""}>
                        {fmtDate(eq.garantia_hasta)}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {eq.proximo_mantenimiento ? (
                      <span className={new Date(eq.proximo_mantenimiento) <= new Date() ? "text-orange-600 font-medium" : ""}>
                        {fmtDate(eq.proximo_mantenimiento)}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell><EstadoBadge estado={eq.estado ?? "activo"} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditando(eq); setFormOpen(true); }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleEliminar(eq)}
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

      <EquipoForm
        open={formOpen}
        equipo={editando}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
