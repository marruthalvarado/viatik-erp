import { createFileRoute } from "@tanstack/react-router";
import { ImportacionesDashboard } from "@/components/importaciones/importaciones-dashboard";

export const Route = createFileRoute("/importaciones/dashboard")({
  component: ImportacionesDashboard,
});
