import { createFileRoute }        from "@tanstack/react-router";
import { AppShell }               from "@/components/layout/app-shell";
import { CosteosProyectoLayout }  from "@/components/importaciones/costeos-proyecto-layout";

export const Route = createFileRoute("/importaciones/costeos-proyecto")({
  head: () => ({ meta: [{ title: "Costeos de Proyecto · VIATIQ" }] }),
  component: CosteosProyectoPage,
});

function CosteosProyectoPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Costeos de Proyecto</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Agrupa múltiples productos, prorratea gastos de importación y calcula el
            precio de venta del proyecto completo.
          </p>
        </div>
        <CosteosProyectoLayout />
      </div>
    </AppShell>
  );
}
