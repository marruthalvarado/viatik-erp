/**
 * usuarios-section.tsx
 * Gestion de usuarios de la empresa — visible solo para administradores.
 */
import { useState } from "react";
import { UserCheck, UserX, ShieldCheck, User, UserPlus, Pencil } from "lucide-react";

import { DataTable } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { toast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAdminActualizarPerfil } from "@/hooks/entities/use-perfil";
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
  const actualizarPerfil = useAdminActualizarPerfil();

  const roles = rolesData?.rows ?? [];
  const [changingRol, setChangingRol] = useState<string | null>(null);

  // Dialog: invitar
  const [dialogOpen, setDialogOpen] = useState(false);
  const [emailInvite, setEmailInvite] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Dialog: editar perfil de usuario
  const [editTarget, setEditTarget] = useState<EmpresaUsuario | null>(null);
  const [editNombres, setEditNombres] = useState("");
  const [editApellidos, setEditApellidos] = useState("");
  const [editCargo, setEditCargo] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  function openEditDialog(m: EmpresaUsuario) {
    setEditTarget(m);
    setEditNombres(m.nombres ?? "");
    setEditApellidos(m.apellidos ?? "");
    setEditCargo(m.cargo ?? "");
    setEditError(null);
  }

  function extractMsg(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err !== null && "message" in err)
      return String((err as { message: unknown }).message);
    return fallback;
  }

  async function handleCambiarRol(miembroId: string, rolId: string) {
    setChangingRol(miembroId);
    try {
      await cambiarRol.mutateAsync({ miembroId, rolId });
      toast.success("Rol actualizado.");
    } catch (err) {
      toast.error(extractMsg(err, "Error al cambiar rol."));
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
      toast.error(extractMsg(err, "Error al cambiar estado."));
    }
  }

  async function handleInvitar() {
    if (!emailInvite.trim()) return;
    setInviteError(null);
    try {
      const res = await invitar.mutateAsync(emailInvite.trim());
      toast.success(
        res.ya_miembro
          ? "El usuario ya era miembro. Se reactivo su acceso."
          : "Usuario agregado correctamente.",
      );
      setDialogOpen(false);
      setEmailInvite("");
    } catch (err) {
      setInviteError(extractMsg(err, "Error al agregar usuario."));
    }
  }

  async function handleGuardarPerfil() {
    if (!editTarget || !editNombres.trim()) {
      setEditError("El nombre es requerido.");
      return;
    }
    setEditError(null);
    try {
      await actualizarPerfil.mutateAsync({
        usuarioId: editTarget.usuario_id,
        data: {
          nombres: editNombres.trim(),
          apellidos: editApellidos.trim(),
          cargo: editCargo.trim(),
        },
      });
      toast.success("Perfil actualizado.");
      setEditTarget(null);
    } catch (err) {
      setEditError(extractMsg(err, "Error al guardar perfil."));
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
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Editar perfil"
            onClick={() => openEditDialog(row)}
          >
            <Pencil className="size-3.5 text-muted-foreground" />
          </Button>
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
        </div>
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
            automaticamente.
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
            Codigo de empresa:{" "}
            <span className="font-mono font-semibold text-foreground">{empresaActiva.codigo}</span>
            {" — "}
            Comparte este codigo con los nuevos usuarios para que se unan al registrarse.
          </p>
        </div>
      )}

      {/* Dialog: invitar por email */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar usuario</DialogTitle>
            <DialogDescription>
              El usuario debe tener una cuenta en VIATIQ. Ingresa su correo y quedara vinculado a
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

      {/* Dialog: editar perfil de usuario */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(v) => {
          if (!v) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>
              El nombre aparece en las liquidaciones de gastos como "Empleado".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-nombres">Nombre(s) *</Label>
              <Input
                id="edit-nombres"
                value={editNombres}
                onChange={(e) => setEditNombres(e.target.value)}
                placeholder="Daniel"
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-apellidos">Apellido(s)</Label>
              <Input
                id="edit-apellidos"
                value={editApellidos}
                onChange={(e) => setEditApellidos(e.target.value)}
                placeholder="Zhunio"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-cargo">Cargo</Label>
              <Input
                id="edit-cargo"
                value={editCargo}
                onChange={(e) => setEditCargo(e.target.value)}
                placeholder="Gerente de Operaciones"
              />
            </div>
            {editError && (
              <Alert variant="destructive">
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!editNombres.trim() || actualizarPerfil.isPending}
              onClick={() => void handleGuardarPerfil()}
            >
              {actualizarPerfil.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
