import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";
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
      <AppSidebar />
      <SidebarInset>
        <Topbar />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
