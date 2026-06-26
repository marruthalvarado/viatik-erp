import { useState } from "react";
import { z } from "zod";
import { Pencil } from "lucide-react";

import { DataTable } from "@/components/common/data-table";
import { SearchBar } from "@/components/common/search-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { EntityForm } from "@/components/common/entity-form";
import { EmptyState } from "@/components/common/empty-state";
import { toast } from "@/components/common/toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/common/drawer";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useUsuarios, useActualizarUsuario } from "@/hooks/entities/use-usuarios";
import { emptyToNull } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Usuario, UsuarioUpdate } from "@/types/entities";

const usuarioEditSchema = z.object({
  nombres: z.string().min(1, "Los nombres son requeridos"),
  apellidos: z.string().nullable().optional(),
  cargo: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
});

type UsuarioEditFormValues = z.infer<typeof usuarioEditSchema>;

export function UsuariosSection() {
  const [search, setSearch] = useState("");
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);

  const { data, isLoading, error } = useUsuarios({ pageSize: 100, search });
  const actualizar = useActualizarUsuario();

  function toForm(u: Usuario): UsuarioEditFormValues {
    return {
      nombres: u.nombres,
      apellidos: u.apellidos ?? "",
      cargo: u.cargo ?? "",
      telefono: u.telefono ?? "",
      estado: u.estado ?? "activo",
    };
  }

  async function handleSubmit(values: UsuarioEditFormValues) {
    if (!editingUsuario) return;
    try {
      const payload: UsuarioUpdate = {
        nombres: values.nombres,
        apellidos: emptyToNull(values.apellidos),
        cargo: emptyToNull(values.cargo),
        telefono: emptyToNull(values.telefono),
        estado: values.estado ?? null,
      };
      await actualizar.mutateAsync({ id: editingUsuario.id, payload });
      toast.success("Usuario actualizado.");
      setEditingUsuario(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar el usuario.");
    }
  }

  const columns: DataTableColumn<Usuario>[] = [
    {
      key: "nombre",
      header: "Nombre",
      cell: (row) => (
        <div>
          <p className="text-sm font-medium">
            {row.nombres} {row.apellidos ?? ""}
          </p>
          {row.cargo && <p className="text-xs text-muted-foreground">{row.cargo}</p>}
        </div>
      ),
    },
    {
      key: "telefono",
      header: "Teléfono",
      cell: (row) => <span className="text-sm">{row.telefono ?? "—"}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      cell: (row) => {
        const tone =
          row.estado === "activo" ? "success" : row.estado === "inactivo" ? "danger" : "neutral";
        return <StatusBadge tone={tone}>{row.estado ?? "—"}</StatusBadge>;
      },
    },
    {
      key: "acciones",
      header: "",
      className: "w-[56px]",
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Editar usuario"
          onClick={(e) => {
            e.stopPropagation();
            setEditingUsuario(row);
          }}
        >
          <Pencil className="size-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Usuarios</h2>
        <p className="text-xs text-muted-foreground">Los usuarios se crean vía autenticación.</p>
      </div>
      <div className="mb-3">
        <SearchBar value={search} onChange={(v) => setSearch(v)} placeholder="Buscar usuario..." />
      </div>
      {error ? (
        <EmptyState
          title="Error"
          description={error instanceof Error ? error.message : "Error inesperado."}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          isLoading={isLoading}
          getRowId={(row) => row.id}
          emptyTitle="Sin usuarios"
          emptyDescription="No hay usuarios registrados."
        />
      )}

      <Drawer open={!!editingUsuario} onOpenChange={(open) => !open && setEditingUsuario(null)}>
        <DrawerContent className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Editar usuario</DrawerTitle>
            <DrawerDescription>Actualiza los datos del perfil del usuario.</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-6">
            {editingUsuario && (
              <EntityForm
                schema={usuarioEditSchema}
                defaultValues={toForm(editingUsuario)}
                onSubmit={handleSubmit}
                onCancel={() => setEditingUsuario(null)}
                loading={actualizar.isPending}
                submitLabel="Guardar cambios"
              >
                {(form) => (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nombres"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Nombres *</FormLabel>
                          <FormControl>
                            <Input placeholder="Juan" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="apellidos"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apellidos</FormLabel>
                          <FormControl>
                            <Input placeholder="Pérez" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cargo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cargo</FormLabel>
                          <FormControl>
                            <Input placeholder="Analista" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="telefono"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="+51 999 999 999"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <Select value={field.value ?? "activo"} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="activo">Activo</SelectItem>
                              <SelectItem value="inactivo">Inactivo</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </EntityForm>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
