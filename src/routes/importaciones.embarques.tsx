import { createFileRoute } from "@tanstack/react-router";
import { EmbarquesLayout } from "@/components/importaciones/embarques-layout";

export const Route = createFileRoute("/importaciones/embarques")({
  component: EmbarquesLayout,
});
