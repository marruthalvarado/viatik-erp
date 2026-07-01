/**
 * usuarios-section.tsx
 * Gestión de usuarios de la empresa — visible sólo para administradores.
 * Permite ver, cambiar rol y activar/desactivar miembros.
 * También permite invitar nuevos usuarios por email.
 */
import { useState } from "react";
import { UserCheck, UserX, ShieldCheck, User, UserPlus } from "lucide-react";

import { DataTable } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { toast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  useEmpresaUsuarios,
  useCambiarRolUsuario,
  useDesactivarUsuario,
  useReactivarUsuario,
  useInvitarUsuarioPorEmail,
} from "@/hooks/entities/use-empresa-usuarios";
import { useRoles } from "@/hooks/entities/use-roles";
import { useCompany } from "@/contexts/company-context";

import type { DataTableColumn } from "@/components/common/data-table";
import type { EmpresaUsuario } from "@/hooks/entities/use-empresa-usuarios";

export function UsuariosSection() {
  const { empresaActiva } = useCompany();
  const { data: miembros = [], isLoading } = useEmpresaUsuarios();
  const { data: rolesData } = useRoles({ pageSize: 20 });
  const cambiarRol = useCambiarRolUsuario();
  const desactivar = useDesactivarUsuario();
  const reactivar = useReactivarUsuario();
  const invitar = useInvitarUsuarioPorEmail();

  const roles = rolesData?.rows ?? [];
  const [changingRol, setChangingRol] = useState<string | null>(null);

  // Dialogo invitar
  const [dialogOpen, setDialogOpen] = useState(false);
  const [emailInvite, setEmailInvite] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

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

  async function handleInvitar() {
    if (!emailInvite.trim()) return;
    setInviteError(null);
    try {
      const res = await invitar.mutateAsync(emailInvite.trim());
      toast.success(
        res.ya_miembro
          ? "El usuario ya era miembro. Se reactivó su acceso."
          : "Usuario agregado correctamente.",
      );
      setDialogOpen(false);
      setEmailInvite("");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Error al agregar usuario.");
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
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Usuarios de la empresa</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona los miembros y sus roles. El primer usuario registrado es administrador
            automáticamente.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={() => {
            setInviteError(null);
            setEmailInvite("");
            setDialogOpen(true);
          }}
        >
          <UserPlus className="size-4" />
          Agregar usuario
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={miembros}
        isLoading={isLoading}
        getRowId={(row) => row.id}
        emptyTitle="Sin usuarios"
        emptyDescription="No hay usuarios registrados en esta empresa."
      />

      {empresaActiva && (
        <div className="mt-3 rounded-md border bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Código de empresa:{" "}
            <span className="font-mono font-semibold text-foreground">{empresaActiva.codigo}</span>
            {" — "}
            Comparte este código con los nuevos usuarios para que se unan al registrarse.
          </p>
        </div>
      )}

      {/* Dialog: invitar por email */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar usuario</DialogTitle>
            <DialogDescription>
              El usuario debe tener una cuenta en VIATIQ. Ingresa su correo y quedará vinculado a
              esta empresa con rol "Usuario".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Input
              type="email"
              placeholder="correo@ejemplo.com"
              value={emailInvite}
              onChange={(e) => setEmailInvite(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleInvitar();
              }}
              autoFocus
            />
            {inviteError && (
              <Alert variant="destructive">
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEmailInvite("");
                setInviteError(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!emailInvite.trim() || invitar.isPending}
              onClick={() => void handleInvitar()}
            >
              {invitar.isPending ? "Agregando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
