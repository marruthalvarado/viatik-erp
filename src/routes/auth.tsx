import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Acceso · VIATIQ" },
      { name: "description", content: "Inicia sesión en VIATIQ." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  useEffect(() => {
    if (!loading && user) {
      navigate({ href: getSafeRedirect(redirect), replace: true });
    }
  }, [loading, user, redirect, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo className="h-10 w-auto" alt="VIATIQ" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">VIATIQ</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Plataforma Inteligente para Gestión de Viáticos y Gastos.
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-4">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-0.5 text-center text-[11px] text-muted-foreground">
          <p>
            Diseñado y desarrollado por <span className="font-medium">Nuclearpet S.A.S.</span>
          </p>
          <p>© 2026 Nuclearpet S.A.S. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
}

function getSafeRedirect(redirect: string | undefined) {
  if (!redirect) return "/dashboard";
  if (!redirect.startsWith("/") || redirect.startsWith("//")) return "/dashboard";
  if (redirect === "/auth" || redirect.startsWith("/auth?")) return "/dashboard";
  return redirect;
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (err) setError(err.message);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Correo</Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Contraseña</Label>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
        Iniciar sesión
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigoEmpresa, setCodigoEmpresa] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (err) {
      setSubmitting(false);
      setError(err.message);
      return;
    }

    // Si hay sesión inmediata y se proporcionó código, unirse a la empresa
    if (data.session && codigoEmpresa.trim()) {
      const { error: rpcErr } = await supabase.rpc("unirse_empresa_por_codigo", {
        p_codigo: codigoEmpresa.trim(),
      });
      if (rpcErr) {
        setSubmitting(false);
        setInfo("Cuenta creada. " + rpcErr.message);
        return;
      }
    }

    setSubmitting(false);
    setInfo(
      data.session
        ? "Cuenta creada correctamente."
        : "Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.",
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-email">Correo</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Contraseña</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-codigo">
          Código de empresa <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="signup-codigo"
          type="text"
          placeholder="Ej: NUCLEARPET"
          autoComplete="off"
          value={codigoEmpresa}
          onChange={(e) => setCodigoEmpresa(e.target.value.toUpperCase())}
          className="font-mono tracking-widest uppercase"
        />
        <p className="text-xs text-muted-foreground">
          Si tu administrador ya creó la empresa, ingresa su código para unirte.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {info && (
        <Alert>
          <AlertDescription>{info}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
        Crear cuenta
      </Button>
    </form>
  );
}
