/**
 * usuarios-section.tsx
 * Gestión de usuarios de la empresa — visible sólo para administradores.
 * Permite ver, cambiar rol y activar/desactivar miembros.
 */
import { useState } from "react";
import { UserCheck, UserX, ShieldCheck, User } from "lucide-react";

import { DataTable } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { toast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useEmpresaUsuarios,
  useCambiarRolUsuario,
  useDesactivarUsuario,
  useReactivarUsuario,
} from "@/hooks/entities/use-empresa-usuarios";
import { useRoles } from "@/hooks/entities/use-roles";

import type { DataTableColumn } from "@/components/common/data-table";
import type { EmpresaUsuario } from "@/hooks/entities/use-empresa-usuarios";

export function UsuariosSection() {
  const { data: miembros = [], isLoading } = useEmpresaUsuarios();
  const { data: rolesData } = useRoles({ pageSize: 20 });
  const cambiarRol = useCambiarRolUsuario();
  const desactivar = useDesactivarUsuario();
  const reactivar = useReactivarUsuario();

  const roles = rolesData?.rows ?? [];
  const [changingRol, setChangingRol] = useState<string | null>(null);

  async function handleCambiarRol(miembroId: string, rolId: string) {
    setChangingRol(miembroId);
    try {
      await cambiarRol.mutateAsync({ miembroId, rolId });
      toast.success("Rol actualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar rol.");
    } finally {
      setChangingRol(null);
    }
  }

  async function handleToggleActivo(m: EmpresaUsuario) {
    try {
      if (m.activo) {
        await desactivar.mutateAsync(m.id);
        toast.success("Usuario desactivado.");
      } else {
        await reactivar.mutateAsync(m.id);
        toast.success("Usuario reactivado.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar estado.");
    }
  }

  const columns: DataTableColumn<EmpresaUsuario>[] = [
    {
      key: "nombre",
      header: "Usuario",
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.rol_codigo === "admin" ? (
            <ShieldCheck className="size-4 text-primary" />
          ) : (
            <User className="size-4 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {row.nombres} {row.apellidos ?? ""}
            </p>
            {row.cargo && <p className="text-xs text-muted-foreground">{row.cargo}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      className: "w-28",
      cell: (row) => (
        <StatusBadge tone={row.activo ? "success" : "neutral"}>
          {row.activo ? "Activo" : "Inactivo"}
        </StatusBadge>
      ),
    },
    {
      key: "rol",
      header: "Rol",
      className: "w-44",
      cell: (row) => (
        <Select
          value={row.rol_id}
          onValueChange={(v) => void handleCambiarRol(row.id, v)}
          disabled={changingRol === row.id}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-20",
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={row.activo ? "Desactivar" : "Reactivar"}
          onClick={() => void handleToggleActivo(row)}
        >
          {row.activo ? (
            <UserX className="size-3.5 text-destructive" />
          ) : (
            <UserCheck className="size-3.5 text-success" />
          )}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-base font-semibold">Usuarios de la empresa</h3>
        <p className="text-sm text-muted-foreground">
          Gestiona los miembros y sus roles. El primer usuario registrado es administrador
          automáticamente.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={miembros}
        isLoading={isLoading}
        getRowId={(row) => row.id}
        emptyTitle="Sin usuarios"
        emptyDescription="No hay usuarios registrados en esta empresa."
      />

      <p className="mt-3 text-xs text-muted-foreground">
        Para agregar usuarios: comparte el enlace de registro de la aplicación. Al registrarse, el
        nuevo usuario deberá unirse a tu empresa usando el nombre o ID de empresa.
      </p>
    </div>
  );
}
