import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/contexts/company-context";
import { toast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, ChevronDown, Loader2 } from "lucide-react";

import {
  useBitacoraProyecto,
  useCrearActualizacion,
  useEditarActualizacion,
  useEliminarActualizacion,
} from "@/hooks/entities/use-bitacora";
import { BitacoraCard } from "./bitacora-card";
import { BitacoraForm, type BitacoraFormValues } from "./bitacora-form";
import type { BitacoraEntrada } from "@/services/bitacora";

interface Props {
  proyectoId: string;
}

export function BitacoraTab({ proyectoId }: Props) {
  const { user } = useAuth();
  const { empresaActivaId } = useCompany();

  const { data: entradas, isLoading } = useBitacoraProyecto(proyectoId);
  const crear = useCrearActualizacion(proyectoId);
  const editar = useEditarActualizacion(proyectoId);
  const eliminar = useEliminarActualizacion(proyectoId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntrada, setEditingEntrada] = useState<BitacoraEntrada | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(values: BitacoraFormValues) {
    if (!empresaActivaId || !user?.id) return;
    try {
      await crear.mutateAsync({
        empresa_id: empresaActivaId,
        proyecto_id: proyectoId,
        usuario_id: user.id,
        fecha: values.fecha,
        ayer: values.ayer || null,
        hoy: values.hoy || null,
        bloqueos: values.bloqueos || null,
        nivel_bloqueo: values.nivel_bloqueo,
        novedades: values.novedades || null,
        porcentaje_avance: values.porcentaje_avance ?? null,
      });
      toast.success("Actualización registrada.");
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar.");
    }
  }

  async function handleEdit(values: BitacoraFormValues) {
    if (!editingEntrada) return;
    try {
      await editar.mutateAsync({
        id: editingEntrada.id,
        payload: {
          fecha: values.fecha,
          ayer: values.ayer || null,
          hoy: values.hoy || null,
          bloqueos: values.bloqueos || null,
          nivel_bloqueo: values.nivel_bloqueo,
          novedades: values.novedades || null,
          porcentaje_avance: values.porcentaje_avance ?? null,
        },
      });
      toast.success("Actualización editada.");
      setEditingEntrada(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al editar.");
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    try {
      await eliminar.mutateAsync(deletingId);
      toast.success("Entrada eliminada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar.");
    } finally {
      setDeletingId(null);
    }
  }

  const rows = entradas ?? [];

  return (
    <div className="space-y-4">
      {/* Add entry / form */}
      {!editingEntrada && (
        <Collapsible open={formOpen} onOpenChange={setFormOpen}>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Bitácora de avance
            </h4>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant={formOpen ? "outline" : "default"} className="gap-1.5">
                {formOpen ? (
                  <>
                    <ChevronDown className="size-3.5" />
                    Cancelar
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" />
                    Registrar avance
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="mt-3 rounded-lg border bg-muted/30 p-4">
            <BitacoraForm
              onSubmit={handleCreate}
              onCancel={() => setFormOpen(false)}
              loading={crear.isPending}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Edit form inline */}
      {editingEntrada && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <p className="text-sm font-medium">Editando entrada</p>
          <BitacoraForm
            defaultValues={{
              fecha: editingEntrada.fecha,
              ayer: editingEntrada.ayer ?? "",
              hoy: editingEntrada.hoy ?? "",
              bloqueos: editingEntrada.bloqueos ?? "",
              nivel_bloqueo: editingEntrada.nivel_bloqueo,
              novedades: editingEntrada.novedades ?? "",
              porcentaje_avance: editingEntrada.porcentaje_avance ?? undefined,
            }}
            onSubmit={handleEdit}
            onCancel={() => setEditingEntrada(null)}
            loading={editar.isPending}
            submitLabel="Guardar cambios"
          />
        </div>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Cargando bitácora...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Aún no hay actualizaciones registradas.</p>
          <p className="text-xs mt-1">Registra el primer avance del proyecto.</p>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {rows.map((entrada) => (
            <BitacoraCard
              key={entrada.id}
              entrada={entrada}
              isOwn={entrada.usuario_id === user?.id}
              onEdit={() => {
                setFormOpen(false);
                setEditingEntrada(entrada);
              }}
              onDelete={() => setDeletingId(entrada.id)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar entrada</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que deseas eliminar esta actualización? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {eliminar.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
