/**
 * unirse-empresa-dialog.tsx
 * Dialog que aparece cuando el usuario autenticado no pertenece a ninguna empresa.
 * Ofrece dos opciones: unirse con código o crear empresa nueva.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Building2 } from "lucide-react";
import {
  useUnirseEmpresaPorCodigo,
  useCrearEmpresaYUnirse,
} from "@/hooks/entities/use-empresa-usuarios";
import { useCompany } from "@/contexts/company-context";
import { useAuth } from "@/contexts/auth-context";

function extractMsg(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return fallback;
}

export function UnirseEmpresaDialog() {
  const { empresas, loading, refresh } = useCompany();
  const { user } = useAuth();
  const unirse = useUnirseEmpresaPorCodigo();
  const crear = useCrearEmpresaYUnirse();

  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [codigoNuevo, setCodigoNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

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
      setError(extractMsg(err, "Error al unirse a la empresa."));
    }
  }

  async function handleCrear() {
    if (!nombre.trim()) return;
    setError(null);
    setExito(null);
    try {
      const res = await crear.mutateAsync({
        nombre: nombre.trim(),
        codigo: codigoNuevo.trim() || undefined,
      });
      setExito(`Empresa "${res.empresa}" creada con código ${res.codigo}. Cargando...`);
      await refresh();
    } catch (err) {
      setError(extractMsg(err, "Error al crear la empresa."));
    }
  }

  function handleTabChange() {
    setError(null);
    setExito(null);
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="size-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Empresa</DialogTitle>
          <DialogDescription className="text-center">
            Tu cuenta no está vinculada a ninguna empresa. Únete con un código o crea una nueva.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="unirse" onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="unirse">Unirse con código</TabsTrigger>
            <TabsTrigger value="crear">Crear empresa</TabsTrigger>
          </TabsList>

          {/* ── Tab: Unirse ── */}
          <TabsContent value="unirse" className="mt-4 space-y-3">
            <Input
              placeholder="Ej: PROTONMED"
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
              Solicita el código al administrador de tu organización.
            </p>
          </TabsContent>

          {/* ── Tab: Crear ── */}
          <TabsContent value="crear" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre de la empresa *</label>
              <Input
                placeholder="Ej: Mi Empresa S.A."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCrear();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Código{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional — se genera automáticamente)
                </span>
              </label>
              <Input
                placeholder="Ej: MIEMPRESA"
                value={codigoNuevo}
                onChange={(e) => setCodigoNuevo(e.target.value.toUpperCase())}
                className="font-mono uppercase"
              />
            </div>
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
              disabled={!nombre.trim() || crear.isPending}
              onClick={() => void handleCrear()}
            >
              {crear.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Crear empresa
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
