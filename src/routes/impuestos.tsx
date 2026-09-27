/**
 * Módulo Impuestos SRI Ecuador.
 *
 * Calcula IVA (mensual/semestral Form. 104/104A) e Impuesto a la Renta anual
 * según normativa SRI Ecuador, usando RPCs de Supabase.
 *
 * - Fase A: IVA + IR calculados en RPC · historial de declaraciones
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Calculator } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompany } from "@/contexts/company-context";
import { useTipoContribuyente } from "@/hooks/entities/use-impuestos";

import { TipoContribuyenteConfig } from "@/components/impuestos/tipo-contribuyente-config";
import { IvaPanel } from "@/components/impuestos/iva-panel";
import { IrPanel } from "@/components/impuestos/ir-panel";
import { HistorialDeclaraciones } from "@/components/impuestos/historial-declaraciones";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/impuestos")({
  head: () => ({ meta: [{ title: "Impuestos SRI · VIATIQ" }] }),
  component: ImpuestosPage,
});

function ImpuestosPage() {
  return (
    <AppShell>
      <ImpuestosContent />
    </AppShell>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

const anioActual = new Date().getFullYear();
const ANIOS = [anioActual, anioActual - 1, anioActual - 2];

function ImpuestosContent() {
  const { empresaActivaId } = useCompany();
  const [anio, setAnio] = useState<number>(anioActual);
  const { data: tipo } = useTipoContribuyente(empresaActivaId);
  const tipoEfectivo = tipo ?? "sociedad";

  if (!empresaActivaId) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
        <Calculator className="size-8 opacity-40" />
        <p className="text-sm">Selecciona una empresa para ver los impuestos.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Impuestos SRI"
          description="Cálculo automático de IVA e Impuesto a la Renta según normativa Ecuador"
        />
        {/* Selector de año */}
        <Select
          value={String(anio)}
          onValueChange={(v) => setAnio(Number(v))}
        >
          <SelectTrigger className="h-9 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANIOS.map((a) => (
              <SelectItem key={a} value={String(a)}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Configuración tipo contribuyente */}
      <TipoContribuyenteConfig empresaId={empresaActivaId} />

      {/* Pestañas */}
      <Tabs defaultValue="iva">
        <TabsList>
          <TabsTrigger value="iva">IVA</TabsTrigger>
          <TabsTrigger value="ir">Impuesto a la Renta</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="iva" className="mt-4">
          <IvaPanel
            empresaId={empresaActivaId}
            anio={anio}
            tipo={tipoEfectivo}
          />
        </TabsContent>

        <TabsContent value="ir" className="mt-4">
          <IrPanel
            empresaId={empresaActivaId}
            anio={anio}
            tipo={tipoEfectivo}
          />
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <HistorialDeclaraciones
            empresaId={empresaActivaId}
            anio={anio}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
