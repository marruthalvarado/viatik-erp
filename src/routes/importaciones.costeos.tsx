import { createFileRoute } from "@tanstack/react-router";
import { AppShell }        from "@/components/layout/app-shell";
import { CosteosLayout }   from "@/components/importaciones/costeos-layout";

export const Route = createFileRoute("/importaciones/costeos")({
  head: () => ({ meta: [{ title: "Costeos de Importación · VIATIQ" }] }),
  component: CosteosPage,
});

function CosteosPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Costeos de Importación</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Calcula el costo de aterrizaje y PVP de tus productos antes de importar.
          </p>
        </div>
        <CosteosLayout />
      </div>
    </AppShell>
  );
}
