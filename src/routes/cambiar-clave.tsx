/**
 * /cambiar-clave — Pantalla de cambio obligatorio de clave.
 * Se muestra cuando un admin crea un usuario con clave temporal.
 * El usuario no puede acceder a ninguna otra pantalla hasta completar este paso.
 */
import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, Eye, EyeOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useMarcarClaveCambiada } from "@/hooks/entities/use-admin-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingState } from "@/components/common/loading-state";

export const Route = createFileRoute("/cambiar-clave")({
  head: () => ({ meta: [{ title: "Cambiar contraseña · VIATIQ" }] }),
  component: CambiarClavePage,
});

function CambiarClavePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const marcarCambiada = useMarcarClaveCambiada();

  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Cargando sesión..." />
      </div>
    );
  }

  if (!user) {
    void navigate({ to: "/auth", search: { redirect: "/cambiar-clave" }, replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (nueva.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (nueva !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);
    try {
      // 1. Actualizar la contraseña en Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({ password: nueva });
      if (authError) throw new Error(authError.message);

      // 2. Marcar que la clave ya fue cambiada
      await marcarCambiada.mutateAsync();

      // 3. Redirigir al dashboard
      void navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar la contraseña.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-background p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="size-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Cambia tu contraseña</h1>
          <p className="text-sm text-muted-foreground">
            Por seguridad, debes establecer una nueva contraseña antes de continuar.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="nueva">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="nueva"
                type={showNueva ? "text" : "password"}
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                autoFocus
                className="pr-9"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2.5 flex items-center text-muted-foreground"
                onClick={() => setShowNueva((v) => !v)}
                tabIndex={-1}
              >
                {showNueva ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="confirmar">Confirmar contraseña</Label>
            <div className="relative">
              <Input
                id="confirmar"
                type={showConfirmar ? "text" : "password"}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repite la nueva contraseña"
                required
                className="pr-9"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2.5 flex items-center text-muted-foreground"
                onClick={() => setShowConfirmar((v) => !v)}
                tabIndex={-1}
              >
                {showConfirmar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Guardando..." : "Establecer nueva contraseña"}
          </Button>
        </form>
      </div>
    </div>
  );
}
