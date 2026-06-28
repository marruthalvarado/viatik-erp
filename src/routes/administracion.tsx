import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Users, Shield, Settings, Sliders, BookOpen, Tag, Layers } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";

import { EmpresaSection } from "@/components/admin/empresa-section";
import { UsuariosSection } from "@/components/admin/usuarios-section";
import { RolesSection } from "@/components/admin/roles-section";
import { ParametrosSection } from "@/components/admin/parametros-section";
import { PoliticasSection } from "@/components/admin/politicas-section";
import {
  CatGastoSection,
  CatDocumentoSection,
  OrigenGastoSection,
  MonedasSection,
  EstadoGastoSection,
  EstadoRendicionSection,
  TipoRendicionSection,
  TipoDocumentoSection,
} from "@/components/admin/catalog-crud";

export const Route = createFileRoute("/administracion")({
  head: () => ({ meta: [{ title: "Administración · VIATIQ" }] }),
  component: AdministracionPage,
});

// ─── Navigation ───────────────────────────────────────────────────────────────

type AdminSection =
  | "empresa"
  | "usuarios"
  | "roles"
  | "parametros"
  | "politicas"
  | "cat-gastos"
  | "cat-documentos"
  | "origenes"
  | "monedas"
  | "est-gastos"
  | "est-rendicion"
  | "tip-rendicion"
  | "tip-documento";

interface NavGroup {
  label: string;
  items: { id: AdminSection; label: string; icon: React.ElementType }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Organización",
    items: [
      { id: "empresa", label: "Empresa", icon: Building2 },
      { id: "usuarios", label: "Usuarios", icon: Users },
      { id: "roles", label: "Roles", icon: Shield },
    ],
  },
  {
    label: "Configuración",
    items: [
      { id: "parametros", label: "Parámetros", icon: Sliders },
      { id: "politicas", label: "Políticas", icon: Settings },
    ],
  },
  {
    label: "Catálogos",
    items: [
      { id: "cat-gastos", label: "Categorías de Gasto", icon: Tag },
      { id: "cat-documentos", label: "Categorías de Doc.", icon: Tag },
      { id: "origenes", label: "Orígenes de Gasto", icon: BookOpen },
      { id: "monedas", label: "Monedas", icon: Layers },
    ],
  },
  {
    label: "Estados",
    items: [
      { id: "est-gastos", label: "Estados de Gasto", icon: Layers },
      { id: "est-rendicion", label: "Estados de Rendición", icon: Layers },
    ],
  },
  {
    label: "Tipos",
    items: [
      { id: "tip-rendicion", label: "Tipos de Rendición", icon: Layers },
      { id: "tip-documento", label: "Tipos de Documento", icon: Layers },
    ],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function AdministracionPage() {
  return (
    <AppShell>
      <AdminContent />
    </AppShell>
  );
}

function AdminContent() {
  const [activeSection, setActiveSection] = useState<AdminSection>("empresa");

  const activeLabel =
    NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeSection)?.label ??
    "Administración";

  return (
    <>
      <PageHeader
        title="Administración"
        description="Configuración central del ERP."
        breadcrumbs={[{ label: "Administración" }, { label: activeLabel }]}
      />

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <nav className="w-52 shrink-0">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className="size-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {activeSection === "empresa" && <EmpresaSection />}
          {activeSection === "usuarios" && <UsuariosSection />}
          {activeSection === "roles" && <RolesSection />}
          {activeSection === "parametros" && <ParametrosSection />}
          {activeSection === "politicas" && <PoliticasSection />}
          {activeSection === "cat-gastos" && <CatGastoSection />}
          {activeSection === "cat-documentos" && <CatDocumentoSection />}
          {activeSection === "origenes" && <OrigenGastoSection />}
          {activeSection === "monedas" && <MonedasSection />}
          {activeSection === "est-gastos" && <EstadoGastoSection />}
          {activeSection === "est-rendicion" && <EstadoRendicionSection />}
          {activeSection === "tip-rendicion" && <TipoRendicionSection />}
          {activeSection === "tip-documento" && <TipoDocumentoSection />}
        </div>
      </div>
    </>
  );
}
