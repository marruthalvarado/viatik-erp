/**
 * Dialog para que el usuario edite su propio perfil (nombres, apellidos, cargo).
 * Se abre desde el menu de usuario (top-right avatar).
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/components/common/toast";
import { useActualizarPerfilPropio } from "@/hooks/entities/use-perfil";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function EditProfileDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const actualizar = useActualizarPerfilPropio();

  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [cargo, setCargo] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Cargar perfil actual cuando abre
  useEffect(() => {
    if (!open || !user?.id) return;
    void supabase
      .from("usuarios")
      .select("nombres, apellidos, cargo")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setNombres(data.nombres ?? "");
          setApellidos(data.apellidos ?? "");
          setCargo(data.cargo ?? "");
        }
      });
  }, [open, user?.id]);

  async function handleSave() {
    if (!nombres.trim()) {
      setError("El nombre es requerido.");
      return;
    }
    setError(null);
    try {
      await actualizar.mutateAsync({ nombres: nombres.trim(), apellidos: apellidos.trim(), cargo: cargo.trim() });
      toast.success("Perfil actualizado.");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>
            Tu nombre y apellido aparecen en las liquidaciones de gastos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ep-nombres">Nombre(s) *</Label>
            <Input
              id="ep-nombres"
              value={nombres}
              onChange={(e) => setNombres(e.target.value)}
              placeholder="Daniel"
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ep-apellidos">Apellido(s)</Label>
            <Input
              id="ep-apellidos"
              value={apellidos}
              onChange={(e) => setApellidos(e.target.value)}
              placeholder="Zhunio"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ep-cargo">Cargo</Label>
            <Input
              id="ep-cargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Gerente de Operaciones"
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!nombres.trim() || actualizar.isPending}
            onClick={() => void handleSave()}
          >
            {actualizar.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
