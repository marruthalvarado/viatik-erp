import { Search } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserProfileMenu } from "./user-profile-menu";

export function Topbar() {
  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      role="banner"
    >
      <SidebarTrigger className="-ml-1" aria-label="Alternar menú lateral" />
      <Separator orientation="vertical" className="mx-1 h-5" aria-hidden="true" />

      <div className="hidden md:block">
        <Breadcrumbs />
      </div>

      {/* Búsqueda global — pendiente de implementación (RC2) */}
      <div className="relative ml-4 hidden lg:flex flex-1 max-w-md" aria-hidden="true">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar en Viatik..."
          className="h-9 pl-8 bg-muted/40 border-transparent opacity-50 cursor-not-allowed"
          disabled
          tabIndex={-1}
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <NotificationBell />
        <UserProfileMenu />
      </div>
    </header>
  );
}
