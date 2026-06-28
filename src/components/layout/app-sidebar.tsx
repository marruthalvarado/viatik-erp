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
  TrendingUp,
  Activity,
  Network,
  Settings,
  Shield,
  DollarSign,
  GitBranch,
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
import { BrandLogo } from "./brand-logo";

const workspaceItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Rendiciones", url: "/rendiciones", icon: Receipt },
  { title: "Workflow", url: "/workflow", icon: GitBranch },
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
  { title: "Dashboard BI", url: "/reportes", icon: BarChart3 },
  { title: "Rpt. Financieros", url: "/reportes/financieros", icon: TrendingUp },
  { title: "Rpt. Operativos", url: "/reportes/operativos", icon: Activity },
  { title: "Workflow Rpt.", url: "/reportes/workflow", icon: Network },
];

const systemItems = [
  { title: "Configuracion", url: "/configuracion", icon: Settings },
  { title: "Administracion", url: "/administracion", icon: Shield },
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
          <BrandLogo iconOnly className="size-8 shrink-0" />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm font-semibold tracking-tight">VIATIQ</span>
              <span className="text-[11px] text-muted-foreground">Gestión de viáticos</span>
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
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground leading-tight">
            <span className="font-medium">VIATIQ</span> v1.0 RC1
            <br />© 2026 Nuclearpet S.A.S.
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
