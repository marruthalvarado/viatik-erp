/**
 * full-page-shell.tsx
 * Layout de página completa — sin sidebar, ancho máximo sin restricción.
 * Ideal para módulos que requieren toda la pantalla (p.ej. Ciclotrones en móvil).
 */
import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/auth-context";
import { LoadingState } from "@/components/common/loading-state";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserProfileMenu } from "./user-profile-menu";
import { BrandLogo } from "./brand-logo";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { UnirseEmpresaDialog } from "./unirse-empresa-dialog";

export function FullPageShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user && location.pathname !== "/auth") {
      const originalPath = `${location.pathname}${location.searchStr}${location.hash ? `#${location.hash}` : ""}`;
      navigate({ to: "/auth", search: { redirect: originalPath }, replace: true });
    }
  }, [loading, user, location.pathname, location.searchStr, location.hash, navigate]);

  useEffect(() => {
    if (!user) return;
    if (location.pathname === "/cambiar-clave") return;
    supabase
      .from("usuarios")
      .select("debe_cambiar_clave")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.debe_cambiar_clave) {
          void navigate({ to: "/cambiar-clave", replace: true });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Cargando sesión..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <UnirseEmpresaDialog />

      {/* Header compacto sin sidebar trigger */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <BrandLogo className="h-7 w-auto flex-none" />
        <div className="hidden sm:block flex-1 min-w-0">
          <Breadcrumbs />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <NotificationBell />
          <UserProfileMenu />
        </div>
      </header>

      {/* Contenido a pantalla completa — padding mínimo en móvil */}
      <main className="flex-1 px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 w-full">
        {children}
      </main>

      <footer className="border-t bg-background px-4 py-2.5 text-center text-[11px] text-muted-foreground">
        VIATIQ v1.0 RC1 &nbsp;·&nbsp; © 2026 Nahdan Todos los derechos reservados.
      </footer>
    </div>
  );
}
