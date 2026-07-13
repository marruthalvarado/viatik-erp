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
import { useCompany } from "@/contexts/company-context";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  /** Código de módulo usado para filtrar por permisos del rol */
  modulo: string;
}

const workspaceItems: NavItem[] = [
  { title: "Dashboard",   url: "/dashboard",   icon: LayoutDashboard, modulo: "dashboard" },
  { title: "Rendiciones", url: "/rendiciones", icon: Receipt,          modulo: "rendiciones" },
  { title: "Workflow",    url: "/workflow",    icon: GitBranch,        modulo: "workflow" },
  { title: "Documentos",  url: "/documentos",  icon: FileText,         modulo: "documentos" },
];

const relationsItems: NavItem[] = [
  { title: "Clientes",    url: "/clientes",    icon: Users,         modulo: "clientes" },
  { title: "Proyectos",   url: "/proyectos",   icon: FolderKanban,  modulo: "proyectos" },
  { title: "Proveedores", url: "/proveedores", icon: Truck,         modulo: "proveedores" },
];

const financeItems: NavItem[] = [
  { title: "Presupuestos",    url: "/presupuestos",           icon: Wallet,    modulo: "presupuestos" },
  { title: "Gastos",          url: "/gastos",                 icon: DollarSign, modulo: "gastos" },
  { title: "Dashboard BI",    url: "/reportes",               icon: BarChart3,  modulo: "reportes" },
  { title: "Rpt. Financieros",url: "/reportes/financieros",   icon: TrendingUp, modulo: "reportes" },
  { title: "Rpt. Operativos", url: "/reportes/operativos",    icon: Activity,   modulo: "reportes" },
  { title: "Workflow Rpt.",   url: "/reportes/workflow",      icon: Network,    modulo: "reportes" },
];

const systemItems: NavItem[] = [
  { title: "Configuracion",   url: "/configuracion",   icon: Settings, modulo: "configuracion" },
  { title: "Administracion",  url: "/administracion",  icon: Shield,   modulo: "administracion" },
];

/** Códigos de rol que siempre tienen acceso total (sin filtro de módulos) */
const ROLES_ADMIN = ["admin", "administrador"];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const { rolActivo } = useCompany();

  // Determina si un módulo es visible:
  // - rol admin → siempre visible
  // - modulos_permitidos null → sin restricción (visible)
  // - modulos_permitidos array → solo los incluidos
  function puedeVer(modulo: string): boolean {
    if (!rolActivo) return true; // mientras carga, mostrar todo
    if (ROLES_ADMIN.includes(rolActivo.codigo.toLowerCase())) return true;
    if (rolActivo.modulos_permitidos === null) return true;
    return rolActivo.modulos_permitidos.includes(modulo);
  }

  const renderGroup = (label: string, items: NavItem[]) => {
    const visibles = items.filter((item) => puedeVer(item.modulo));
    if (visibles.length === 0) return null;
    return (
      <SidebarGroup>
        {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu>
            {visibles.map((item) => (
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
  };

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
