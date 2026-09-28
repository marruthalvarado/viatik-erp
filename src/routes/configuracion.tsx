/**
 * configuracion.tsx — Perfil de usuario + seguridad + empresa activa.
 *
 * Secciones:
 *   - Mi perfil: editar nombres, apellidos, cargo, teléfono
 *   - Cambiar contraseña: usa supabase.auth.updateUser
 *   - Empresa activa: info de solo lectura
 */
import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Lock, Building2, FileText } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/common/toast";

import { useAuth } from "@/contexts/auth-context";
import { useCompany } from "@/contexts/company-context";
import { useUsuario, useActualizarUsuario } from "@/hooks/entities/use-usuarios";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/configuracion")({
  head: () => ({ meta: [{ title: "Configuración · VIATIQ" }] }),
  component: () => (
    <AppShell>
      <ConfiguracionPage />
    </AppShell>
  ),
});

// ─── Schemas ─────────────────────────────────────────────────────────────────

const perfilSchema = z.object({
  nombres: z.string().min(1, "Requerido"),
  apellidos: z.string().nullable().optional(),
  cargo: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
});
type PerfilValues = z.infer<typeof perfilSchema>;

const passwordSchema = z
  .object({
    nueva: z.string().min(6, "Mínimo 6 caracteres"),
    confirmar: z.string(),
  })
  .refine((d) => d.nueva === d.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

function ConfiguracionPage() {
  const { user } = useAuth();
  const { empresaActiva, empresaActivaId, rolActivo } = useCompany();
  const { data: perfil, isLoading } = useUsuario(user?.id ?? "");
  const actualizar = useActualizarUsuario();
  const [cambiandoPass, setCambiandoPass] = useState(false);

  // ── Propuesta Comercial ──────────────────────────────────────────────────
  const [propuestaResumen, setPropuestaResumen] = useState("");
  const [propuestaTerminos, setPropuestaTerminos] = useState("");
  const [loadingPropuesta, setLoadingPropuesta] = useState(true);
  const [savingPropuesta, setSavingPropuesta] = useState(false);

  useEffect(() => {
    if (!empresaActivaId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("parametros_sistema")
        .select("clave, valor")
        .eq("empresa_id", empresaActivaId)
        .in("clave", ["propuesta_resumen_ejecutivo", "propuesta_terminos_condiciones"]);
      if (cancelled) return;
      if (data) {
        const map = Object.fromEntries(data.map((r) => [r.clave, r.valor ?? ""]));
        setPropuestaResumen(map["propuesta_resumen_ejecutivo"] ?? "");
        setPropuestaTerminos(map["propuesta_terminos_condiciones"] ?? "");
      }
      setLoadingPropuesta(false);
    })();
    return () => { cancelled = true; };
  }, [empresaActivaId]);

  async function handlePropuesta() {
    if (!empresaActivaId) return;
    setSavingPropuesta(true);
    try {
      const { error } = await supabase.from("parametros_sistema").upsert(
        [
          {
            empresa_id: empresaActivaId,
            clave: "propuesta_resumen_ejecutivo",
            valor: propuestaResumen,
            descripcion: "Resumen ejecutivo para propuestas técnico-comerciales",
          },
          {
            empresa_id: empresaActivaId,
            clave: "propuesta_terminos_condiciones",
            valor: propuestaTerminos,
            descripcion: "Términos y condiciones para propuestas técnico-comerciales",
          },
        ],
        { onConflict: "empresa_id,clave" },
      );
      if (error) throw error;
      toast.success("Propuesta comercial guardada correctamente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSavingPropuesta(false);
    }
  }

  const perfilForm = useForm<PerfilValues>({
    resolver: zodResolver(perfilSchema),
    values: perfil
      ? {
          nombres: perfil.nombres,
          apellidos: perfil.apellidos ?? "",
          cargo: perfil.cargo ?? "",
          telefono: perfil.telefono ?? "",
        }
      : undefined,
  });

  const passForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { nueva: "", confirmar: "" },
  });

  if (!user) return null;
  if (isLoading) return <LoadingState label="Cargando perfil..." />;

  async function handlePerfil(values: PerfilValues) {
    try {
      await actualizar.mutateAsync({
        id: user!.id,
        payload: {
          nombres: values.nombres,
          apellidos: values.apellidos || null,
          cargo: values.cargo || null,
          telefono: values.telefono || null,
        },
      });
      toast.success("Perfil actualizado correctamente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar perfil.");
    }
  }

  async function handlePassword(values: PasswordValues) {
    setCambiandoPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: values.nueva });
      if (error) throw error;
      toast.success("Contraseña actualizada correctamente.");
      passForm.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar contraseña.");
    } finally {
      setCambiandoPass(false);
    }
  }

  return (
    <>
      <PageHeader title="Configuración" description="Ajustes de tu perfil y seguridad de cuenta." />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ── Mi perfil ─────────────────────────────────────────────────── */}
        <section className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <User className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Mi perfil</h2>
          </div>

          <Form {...perfilForm}>
            <form onSubmit={perfilForm.handleSubmit(handlePerfil)} className="space-y-4">
              <FormField
                control={perfilForm.control}
                name="nombres"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombres *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombres" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={perfilForm.control}
                name="apellidos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellidos</FormLabel>
                    <FormControl>
                      <Input placeholder="Apellidos" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={perfilForm.control}
                  name="cargo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <FormControl>
                        <Input placeholder="Cargo" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={perfilForm.control}
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="+593..." {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-1 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Email: <span className="font-medium text-foreground">{user.email}</span>
                </p>
                <Button type="submit" size="sm" disabled={actualizar.isPending}>
                  {actualizar.isPending ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </form>
          </Form>
        </section>

        {/* ── Columna derecha ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          {/* Cambiar contraseña */}
          <section className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Cambiar contraseña</h2>
            </div>

            <Form {...passForm}>
              <form onSubmit={passForm.handleSubmit(handlePassword)} className="space-y-4">
                <FormField
                  control={passForm.control}
                  name="nueva"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passForm.control}
                  name="confirmar"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" size="sm" disabled={cambiandoPass}>
                  {cambiandoPass ? "Actualizando..." : "Cambiar contraseña"}
                </Button>
              </form>
            </Form>
          </section>

          {/* Empresa activa */}
          {empresaActiva && (
            <section className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold">Empresa activa</h2>
              </div>

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground shrink-0">Nombre</dt>
                  <dd className="font-medium text-right">{empresaActiva.nombre}</dd>
                </div>
                {empresaActiva.codigo && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground shrink-0">Código</dt>
                    <dd className="font-medium text-right">{empresaActiva.codigo}</dd>
                  </div>
                )}
                {rolActivo && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground shrink-0">Tu rol</dt>
                    <dd className="font-medium text-right capitalize">{rolActivo.nombre}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>
      </div>

      {/* ── Propuesta Comercial ──────────────────────────────────────────── */}
      <section className="mt-6 rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Propuesta Comercial</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Estos textos se incluirán automáticamente en todas las propuestas técnico-comerciales exportadas.
        </p>

        {loadingPropuesta ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Resumen ejecutivo</label>
              <Textarea
                value={propuestaResumen}
                onChange={(e) => setPropuestaResumen(e.target.value)}
                placeholder="Descripción de la empresa, experiencia y propuesta de valor que aparecerá al inicio de cada cotización…"
                className="min-h-[120px] text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Términos y condiciones</label>
              <Textarea
                value={propuestaTerminos}
                onChange={(e) => setPropuestaTerminos(e.target.value)}
                placeholder="Condiciones comerciales, de entrega, de pago, garantías, etc. que aparecerán al final de cada cotización…"
                className="min-h-[120px] text-sm"
              />
            </div>

            <Button size="sm" onClick={handlePropuesta} disabled={savingPropuesta}>
              {savingPropuesta ? "Guardando…" : "Guardar propuesta comercial"}
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
