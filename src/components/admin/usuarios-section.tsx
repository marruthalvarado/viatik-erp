/**
 * usuarios-section.tsx
 * Gestion de usuarios de la empresa — visible solo para administradores.
 */
import { useState } from "react";
import { UserCheck, UserX, ShieldCheck, User, UserPlus, Pencil, PlusCircle, Eye, EyeOff, Trash2 } from "lucide-react";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import {
  useEmpresaUsuarios,
  useCambiarRolUsuario,
  useDesactivarUsuario,
  useReactivarUsuario,
  useInvitarUsuarioPorEmail,
  useSetRolesAdicionales,
} from "@/hooks/entities/use-empresa-usuarios";
import { useAdminActualizarPerfil } from "@/hooks/entities/use-perfil";
import { useRoles } from "@/hooks/entities/use-roles";
import { useCompany } from "@/contexts/company-context";
import { useCrearUsuario, useEliminarUsuario } from "@/hooks/entities/use-admin-users";

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
  const setRolesAdicionales = useSetRolesAdicionales();

  const crearUsuario = useCrearUsuario();
  const eliminarUsuario = useEliminarUsuario();

  const roles = rolesData?.rows ?? [];

  // Dialog: confirmar eliminación
  const [deleteTarget, setDeleteTarget] = useState<EmpresaUsuario | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [changingRol, setChangingRol] = useState<string | null>(null);

  // Dialog: invitar
  const [dialogOpen, setDialogOpen] = useState(false);
  const [emailInvite, setEmailInvite] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Dialog: crear usuario nuevo
  const [crearOpen, setCrearOpen] = useState(false);
  const [crearNombres, setCrearNombres] = useState("");
  const [crearApellidos, setCrearApellidos] = useState("");
  const [crearEmail, setCrearEmail] = useState("");
  const [crearPassword, setCrearPassword] = useState("");
  const [crearShowPassword, setCrearShowPassword] = useState(false);
  const [crearRolId, setCrearRolId] = useState("");
  const [crearError, setCrearError] = useState<string | null>(null);

  function resetCrearDialog() {
    setCrearNombres("");
    setCrearApellidos("");
    setCrearEmail("");
    setCrearPassword("");
    setCrearShowPassword(false);
    setCrearRolId("");
    setCrearError(null);
  }

  // Dialog: editar perfil de usuario
  const [editTarget, setEditTarget] = useState<EmpresaUsuario | null>(null);
  const [editNombres, setEditNombres] = useState("");
  const [editApellidos, setEditApellidos] = useState("");
  const [editCargo, setEditCargo] = useState("");
  const [editRolesAdicionales, setEditRolesAdicionales] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);

  function openEditDialog(m: EmpresaUsuario) {
    setEditTarget(m);
    setEditNombres(m.nombres ?? "");
    setEditApellidos(m.apellidos ?? "");
    setEditCargo(m.cargo ?? "");
    setEditRolesAdicionales(m.roles_adicionales ?? []);
    setEditError(null);
  }

  function toggleRolAdicional(rolId: string) {
    setEditRolesAdicionales((prev) =>
      prev.includes(rolId) ? prev.filter((r) => r !== rolId) : [...prev, rolId],
    );
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

  async function handleEliminarUsuario() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      const result = await eliminarUsuario.mutateAsync(deleteTarget.usuario_id);
      toast.success(
        result.full_delete
          ? "Usuario eliminado completamente."
          : "Usuario removido de la empresa. Su cuenta fue conservada por tener registros asociados.",
      );
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(extractMsg(err, "Error al eliminar el usuario."));
    }
  }

  async function handleCrearUsuario() {
    if (!crearNombres.trim()) { setCrearError("El nombre es requerido."); return; }
    if (!crearEmail.trim()) { setCrearError("El correo es requerido."); return; }
    if (crearPassword.length < 8) { setCrearError("La clave temporal debe tener al menos 8 caracteres."); return; }
    if (!crearRolId) { setCrearError("Selecciona un rol."); return; }
    if (!empresaActiva) { setCrearError("Sin empresa activa."); return; }
    setCrearError(null);
    try {
      await crearUsuario.mutateAsync({
        email: crearEmail.trim(),
        password: crearPassword,
        nombres: crearNombres.trim(),
        apellidos: crearApellidos.trim() || undefined,
        empresa_id: empresaActiva.id,
        rol_id: crearRolId,
      });
      toast.success("Usuario creado. Deberá cambiar su clave al primer inicio de sesión.");
      setCrearOpen(false);
      resetCrearDialog();
    } catch (err) {
      setCrearError(extractMsg(err, "Error al crear el usuario."));
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
      // Guardar roles adicionales si cambiaron
      const rolesActuales = editTarget.roles_adicionales ?? [];
      const cambiaron =
        editRolesAdicionales.length !== rolesActuales.length ||
        editRolesAdicionales.some((r) => !rolesActuales.includes(r));
      if (cambiaron) {
        await setRolesAdicionales.mutateAsync({
          euId: editTarget.id,
          roles: editRolesAdicionales,
        });
      }
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
      className: "w-52",
      cell: (row) => {
        const adicionales = row.roles_adicionales ?? [];
        const nombresAdicionales = roles
          .filter((r) => adicionales.includes(r.id))
          .map((r) => r.nombre);
        return (
          <div className="flex flex-col gap-1">
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
            {nombresAdicionales.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {nombresAdicionales.map((n) => (
                  <Badge key={n} variant="secondary" className="gap-1 text-xs py-0">
                    <PlusCircle className="size-2.5" />
                    {n}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );
      },
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Eliminar usuario"
            onClick={() => { setDeleteError(null); setDeleteTarget(row); }}
          >
            <Trash2 className="size-3.5 text-destructive/70 hover:text-destructive" />
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
        <div className="flex gap-2">
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
            Agregar existente
          </Button>
          <Button
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => {
              resetCrearDialog();
              setCrearOpen(true);
            }}
          >
            <UserPlus className="size-4" />
            Crear usuario
          </Button>
        </div>
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

      {/* Dialog: confirmar eliminación */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) { setDeleteTarget(null); setDeleteError(null); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              ¿Eliminar a{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.nombres} {deleteTarget?.apellidos ?? ""}
              </span>
              ?{" "}
              Si no tiene registros asociados se eliminará completamente. Si tiene rendiciones u otros datos, solo se le removerá de esta empresa.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={eliminarUsuario.isPending}
              onClick={() => void handleEliminarUsuario()}
            >
              {eliminarUsuario.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: crear usuario nuevo */}
      <Dialog
        open={crearOpen}
        onOpenChange={(v) => {
          if (!v) { setCrearOpen(false); resetCrearDialog(); }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear usuario</DialogTitle>
            <DialogDescription>
              Se creará una cuenta nueva. El usuario deberá cambiar su clave temporal al primer inicio de sesión.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="crear-nombres">Nombre(s) *</Label>
                <Input
                  id="crear-nombres"
                  value={crearNombres}
                  onChange={(e) => setCrearNombres(e.target.value)}
                  placeholder="Daniel"
                  autoFocus
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="crear-apellidos">Apellido(s)</Label>
                <Input
                  id="crear-apellidos"
                  value={crearApellidos}
                  onChange={(e) => setCrearApellidos(e.target.value)}
                  placeholder="Zhunio"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="crear-email">Correo electrónico *</Label>
              <Input
                id="crear-email"
                type="email"
                value={crearEmail}
                onChange={(e) => setCrearEmail(e.target.value)}
                placeholder="usuario@empresa.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="crear-password">Clave temporal *</Label>
              <div className="relative">
                <Input
                  id="crear-password"
                  type={crearShowPassword ? "text" : "password"}
                  value={crearPassword}
                  onChange={(e) => setCrearPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2.5 flex items-center text-muted-foreground"
                  onClick={() => setCrearShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {crearShowPassword
                    ? <EyeOff className="size-4" />
                    : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="crear-rol">Rol *</Label>
              <Select value={crearRolId} onValueChange={setCrearRolId}>
                <SelectTrigger id="crear-rol">
                  <SelectValue placeholder="Seleccionar rol..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {crearError && (
              <Alert variant="destructive">
                <AlertDescription>{crearError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setCrearOpen(false); resetCrearDialog(); }}
            >
              Cancelar
            </Button>
            <Button
              disabled={crearUsuario.isPending}
              onClick={() => void handleCrearUsuario()}
            >
              {crearUsuario.isPending ? "Creando..." : "Crear usuario"}
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
            {/* Roles adicionales: todos los roles excepto el primario */}
            {roles.filter((r) => r.id !== editTarget?.rol_id).length > 0 && (
              <div className="grid gap-1.5">
                <Label>Roles adicionales</Label>
                <p className="text-xs text-muted-foreground">
                  Permite que este usuario actúe en pasos del workflow que requieran estos roles.
                </p>
                <div className="flex flex-col gap-1.5 rounded-md border p-3">
                  {roles
                    .filter((r) => r.id !== editTarget?.rol_id)
                    .map((r) => (
                      <div key={r.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`rol-adicional-${r.id}`}
                          checked={editRolesAdicionales.includes(r.id)}
                          onCheckedChange={() => toggleRolAdicional(r.id)}
                        />
                        <label
                          htmlFor={`rol-adicional-${r.id}`}
                          className="cursor-pointer text-sm"
                        >
                          {r.nombre}
                        </label>
                      </div>
                    ))}
                </div>
              </div>
            )}
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
