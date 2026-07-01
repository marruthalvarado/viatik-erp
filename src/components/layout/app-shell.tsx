import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";
import { UnirseEmpresaDialog } from "./unirse-empresa-dialog";
import { useAuth } from "@/contexts/auth-context";
import { LoadingState } from "@/components/common/loading-state";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user && location.pathname !== "/auth") {
      const originalPath = `${location.pathname}${location.searchStr}${location.hash ? `#${location.hash}` : ""}`;
      navigate({
        to: "/auth",
        search: { redirect: originalPath },
        replace: true,
      });
    }
  }, [loading, user, location.pathname, location.searchStr, location.hash, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Cargando sesión..." />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <UnirseEmpresaDialog />
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen">
        <Topbar />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
        <footer className="border-t bg-background px-4 py-2.5 text-center text-[11px] text-muted-foreground">
          VIATIQ v1.0 RC1 &nbsp;·&nbsp; © 2026 Nuclearpet S.A.S. Todos los derechos reservados.
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
