import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Users,
  FolderKanban,
  Truck,
  Wallet,
  BarChart3,
  Settings,
  Shield,
  Sparkles,
  DollarSign,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { CompanySwitcher } from "./company-switcher";

const workspaceItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Rendiciones", url: "/rendiciones", icon: Receipt },
  { title: "Documentos", url: "/documentos", icon: FileText },
];

const relationsItems = [
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Proyectos", url: "/proyectos", icon: FolderKanban },
  { title: "Proveedores", url: "/proveedores", icon: Truck },
];

const financeItems = [
  { title: "Presupuestos", url: "/presupuestos", icon: Wallet },
  { title: "Gastos", url: "/gastos", icon: DollarSign },
  { title: "Reportes", url: "/reportes", icon: BarChart3 },
];

const systemItems = [
  { title: "Configuración", url: "/configuracion", icon: Settings },
  { title: "Administración", url: "/administracion", icon: Shield },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const renderGroup = (label: string, items: typeof workspaceItems) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <Link to={item.url}>
                  <item.icon className="size-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0">
            <Sparkles className="size-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm font-semibold tracking-tight">Viatik</span>
              <span className="text-[11px] text-muted-foreground">Gestión financiera</span>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="px-1 pb-1">
            <CompanySwitcher />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("Workspace", workspaceItems)}
        {renderGroup("Relaciones", relationsItems)}
        {renderGroup("Finanzas", financeItems)}
        {renderGroup("Sistema", systemItems)}
      </SidebarContent>

      <SidebarFooter className="border-t">
        {!collapsed && (
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
            v0.1 · Viatik © {new Date().getFullYear()}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
