import { useState } from "react";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { DataTable } from "@/components/common/data-table";
import { SearchBar } from "@/components/common/search-bar";
import { DeleteDialog } from "@/components/common/delete-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";

import {
  useRoles,
  useCrearRol,
  useActualizarRol,
  useEliminarRol,
} from "@/hooks/entities/use-roles";
import { emptyToNull } from "@/utils/formatters";

import type { DataTableColumn } from "@/components/common/data-table";
import type { Rol, RolInsert, RolUpdate } from "@/types/entities";

// ── Módulos disponibles ────────────────────────────────────────────────────────

interface Modulo {
  codigo: string;
  label: string;
  grupo: string;
}

const MODULOS: Modulo[] = [
  { codigo: "dashboard",      label: "Dashboard",           grupo: "Workspace" },
  { codigo: "rendiciones",    label: "Rendiciones",          grupo: "Workspace" },
  { codigo: "workflow",       label: "Workflow",             grupo: "Workspace" },
  { codigo: "documentos",     label: "Documentos",           grupo: "Workspace" },
  { codigo: "clientes",       label: "Clientes",             grupo: "Relaciones" },
  { codigo: "proyectos",      label: "Proyectos",            grupo: "Relaciones" },
  { codigo: "proveedores",    label: "Proveedores",          grupo: "Relaciones" },
  { codigo: "presupuestos",   label: "Presupuestos",         grupo: "Finanzas" },
  { codigo: "gastos",         label: "Gastos",               grupo: "Finanzas" },
  { codigo: "reportes",       label: "Reportes (todos)",     grupo: "Finanzas" },
  { codigo: "configuracion",  label: "Configuración",        grupo: "Sistema" },
  { codigo: "administracion", label: "Administración",       grupo: "Sistema" },
];

const GRUPOS = [...new Set(MODULOS.map((m) => m.grupo))];

// ── Schema ─────────────────────────────────────────────────────────────────────

const rolSchema = z.object({
  codigo: z.string().min(1, "El código es requerido"),
  nombre: z.string().min(1, "El nombre es requerido"),
  descripcion: z.string().nullable().optional(),
  /** null = acceso total; array vacío = sin acceso a ningún módulo */
  modulos_permitidos: z.array(z.string()).nullable(),
});

type RolFormValues = z.infer<typeof rolSchema>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function toForm(r: Rol): RolFormValues {
  return {
    codigo: r.codigo,
    nombre: r.nombre,
    descripcion: r.descripcion ?? "",
    modulos_permitidos: r.modulos_permitidos ?? null,
  };
}

function emptyForm(): RolFormValues {
  return { codigo: "", nombre: "", descripcion: "", modulos_permitidos: null };
}

// ── Componente checklist ───────────────────────────────────────────────────────

interface ModulosChecklistProps {
  value: string[] | null;
  onChange: (v: string[] | null) => void;
}

function ModulosChecklist({ value, onChange }: ModulosChecklistProps) {
  const sinRestriccion = value === null;

  function toggleSinRestriccion(checked: boolean) {
    onChange(checked ? null : []);
  }

  function toggleModulo(codigo: string, checked: boolean) {
    const current = value ?? [];
    if (checked) {
      onChange([...current, codigo]);
    } else {
      onChange(current.filter((c) => c !== codigo));
    }
  }

  return (
    <div className="space-y-3">
      {/* Opción "acceso total" */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <Checkbox
          checked={sinRestriccion}
          onCheckedChange={(c) => toggleSinRestriccion(!!c)}
        />
        <span className="text-sm font-medium">Acceso total (sin restricciones)</span>
      </label>

      {/* Checklist por grupo, solo visible cuando hay restricción */}
      {!sinRestriccion && (
        <div className="rounded-md border p-3 space-y-4">
          {GRUPOS.map((grupo) => (
            <div key={grupo}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {grupo}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {MODULOS.filter((m) => m.grupo === grupo).map((m) => (
                  <label key={m.codigo} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={(value ?? []).includes(m.codigo)}
                      onCheckedChange={(c) => toggleModulo(m.codigo, !!c)}
                    />
                    <span className="text-sm">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── RolesSection ───────────────────────────────────────────────────────────────

export function RolesSection() {
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRol, setEditingRol] = useState<Rol | null>(null);
  const [deletingRol, setDeletingRol] = useState<Rol | null>(null);

  const { data, isLoading, error } = useRoles({ pageSize: 100, search });
  const crear = useCrearRol();
  const actualizar = useActualizarRol();
  const eliminar = useEliminarRol();

  async function handleSubmit(values: RolFormValues) {
    try {
      if (editingRol) {
        const payload: RolUpdate = {
          codigo: values.codigo,
          nombre: values.nombre,
          descripcion: emptyToNull(values.descripcion),
          modulos_permitidos: values.modulos_permitidos,
        };
        await actualizar.mutateAsync({ id: editingRol.id, payload });
        toast.success("Rol actualizado.");
      } else {
        const payload: RolInsert = {
          codigo: values.codigo,
          nombre: values.nombre,
          descripcion: emptyToNull(values.descripcion),
          modulos_permitidos: values.modulos_permitidos,
        };
        await crear.mutateAsync(payload);
        toast.success("Rol creado.");
      }
      setDrawerOpen(false);
      setEditingRol(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el rol.");
    }
  }

  async function handleDelete() {
    if (!deletingRol) return;
    try {
      await eliminar.mutateAsync(deletingRol.id);
      toast.success(`Rol "${deletingRol.nombre}" eliminado.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el rol.");
    } finally {
      setDeletingRol(null);
    }
  }

  const columns: DataTableColumn<Rol>[] = [
    {
      key: "codigo",
      header: "Código",
      className: "w-28",
      cell: (row) => <span className="font-mono text-xs">{row.codigo}</span>,
    },
    {
      key: "nombre",
      header: "Nombre",
      cell: (row) => (
        <div>
          <p className="text-sm font-medium">{row.nombre}</p>
          {row.descripcion && <p className="text-xs text-muted-foreground">{row.descripcion}</p>}
        </div>
      ),
    },
    {
      key: "modulos_permitidos",
      header: "Módulos",
      cell: (row) => {
        if (row.modulos_permitidos === null) {
          return <span className="text-xs text-muted-foreground">Acceso total</span>;
        }
        if (row.modulos_permitidos.length === 0) {
          return <span className="text-xs text-destructive">Sin acceso</span>;
        }
        return (
          <span className="text-xs text-muted-foreground">
            {row.modulos_permitidos.length} módulo{row.modulos_permitidos.length !== 1 ? "s" : ""}
          </span>
        );
      },
    },
    {
      key: "acciones",
      header: "",
      className: "w-[88px]",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Editar rol"
            onClick={(e) => {
              e.stopPropagation();
              setEditingRol(row);
              setDrawerOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            aria-label="Eliminar rol"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingRol(row);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Roles</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditingRol(null);
            setDrawerOpen(true);
          }}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          Nuevo rol
        </Button>
      </div>
      <div className="mb-3">
        <SearchBar value={search} onChange={(v) => setSearch(v)} placeholder="Buscar rol..." />
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
          emptyTitle="Sin roles"
          emptyDescription="Crea el primer rol."
          emptyAction={
            <Button
              size="sm"
              onClick={() => {
                setEditingRol(null);
                setDrawerOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Nuevo rol
            </Button>
          }
        />
      )}

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerOpen(false);
            setEditingRol(null);
          }
        }}
      >
        <DrawerContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-lg">
          <DrawerHeader>
            <DrawerTitle>{editingRol ? "Editar rol" : "Nuevo rol"}</DrawerTitle>
            <DrawerDescription>
              {editingRol
                ? "Modifica los datos del rol y sus módulos accesibles."
                : "Define un nuevo rol y elige qué módulos puede ver."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <EntityForm
              schema={rolSchema}
              defaultValues={editingRol ? toForm(editingRol) : emptyForm()}
              onSubmit={handleSubmit}
              onCancel={() => {
                setDrawerOpen(false);
                setEditingRol(null);
              }}
              loading={crear.isPending || actualizar.isPending}
              submitLabel={editingRol ? "Guardar cambios" : "Crear rol"}
            >
              {(form) => (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="codigo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código *</FormLabel>
                          <FormControl>
                            <Input placeholder="admin" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre *</FormLabel>
                          <FormControl>
                            <Input placeholder="Administrador" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="descripcion"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Descripción</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Descripción del rol"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="modulos_permitidos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Módulos accesibles</FormLabel>
                        <FormControl>
                          <ModulosChecklist
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </EntityForm>
          </div>
        </DrawerContent>
      </Drawer>

      <DeleteDialog
        open={!!deletingRol}
        onOpenChange={(open) => !open && setDeletingRol(null)}
        entityLabel={`el rol "${deletingRol?.nombre ?? ""}"`}
        onConfirm={handleDelete}
        loading={eliminar.isPending}
      />
    </>
  );
}
