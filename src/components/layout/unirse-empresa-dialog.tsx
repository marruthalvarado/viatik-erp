/**
 * unirse-empresa-dialog.tsx
 * Dialog que aparece cuando el usuario autenticado no pertenece a ninguna empresa.
 * Permite ingresar el código de empresa para unirse o crear una nueva.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Building2 } from "lucide-react";
import { useUnirseEmpresaPorCodigo } from "@/hooks/entities/use-empresa-usuarios";
import { useCompany } from "@/contexts/company-context";
import { useAuth } from "@/contexts/auth-context";

export function UnirseEmpresaDialog() {
  const { empresas, loading, refresh } = useCompany();
  const { user } = useAuth();
  const unirse = useUnirseEmpresaPorCodigo();

  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Solo mostrar cuando el usuario está cargado y no tiene empresas
  const open = !!user && !loading && empresas.length === 0;

  async function handleUnirse() {
    if (!codigo.trim()) return;
    setError(null);
    setExito(null);
    try {
      const res = await unirse.mutateAsync(codigo.trim());
      setExito(
        res.ya_miembro
          ? `Ya eras miembro de "${res.empresa}". Cargando...`
          : `Te uniste a "${res.empresa}". Cargando...`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al unirse a la empresa.");
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        // Sin onOpenChange — no puede cerrarse sin unirse a una empresa
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="size-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Únete a una empresa</DialogTitle>
          <DialogDescription className="text-center">
            Tu cuenta aún no está vinculada a ninguna empresa. Ingresa el código que te proporcionó
            el administrador para continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          <Input
            placeholder="Ej: NUCLEARPET"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleUnirse();
            }}
            autoFocus
            className="text-center font-mono tracking-widest uppercase"
          />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {exito && (
            <Alert>
              <AlertDescription>{exito}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            disabled={!codigo.trim() || unirse.isPending}
            onClick={() => void handleUnirse()}
          >
            {unirse.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Unirse a la empresa
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            ¿No tienes el código? Contacta al administrador de tu organización.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
