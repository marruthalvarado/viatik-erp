/**
 * ocr-result.tsx — IA-1
 *
 * Muestra el resultado del procesamiento OCR:
 * - Texto extraído
 * - Confianza
 * - Proveedor OCR
 * - Tiempo de procesamiento
 * - Estado (completado / requiere_backend / error)
 *
 * El componente no accede a servicios ni a Supabase directamente.
 * Recibe la extracción como prop desde el hook `useOcr`.
 */
import { CheckCircle2, Clock, AlertCircle, Server, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { OcrExtraccion } from "@/types/entities";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface OcrResultProps {
  extraccion: OcrExtraccion;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confianzaLabel(valor: number): {
  texto: string;
  variante: "default" | "secondary" | "destructive";
} {
  if (valor >= 80) return { texto: `${valor}% Alta`, variante: "default" };
  if (valor >= 50) return { texto: `${valor}% Media`, variante: "secondary" };
  return { texto: `${valor}% Baja`, variante: "destructive" };
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function MetaDato({
  icon: Icon,
  etiqueta,
  valor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  etiqueta: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{etiqueta}:</span>
      <span className="font-medium text-foreground">{valor}</span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function OcrResult({ extraccion, className }: OcrResultProps) {
  const {
    estado,
    texto_extraido,
    confianza,
    ocr_proveedor,
    tiempo_procesamiento_ms,
    error_mensaje,
  } = extraccion;

  const esCompletado = estado === "completado";
  const esError = estado === "error";
  const esRequiereBackend = estado === "requiere_backend";
  const esProcesando = estado === "procesando" || estado === "pendiente";

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-4", className)}>
      {/* Cabecera con estado */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {esCompletado && <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />}
          {esError && <AlertCircle className="size-4 text-destructive" aria-hidden="true" />}
          {esRequiereBackend && <Server className="size-4 text-amber-500" aria-hidden="true" />}

          <span className="text-sm font-semibold">Resultado OCR</span>
        </div>

        <Badge variant={esCompletado ? "default" : esError ? "destructive" : "secondary"}>
          {estado.replace("_", " ")}
        </Badge>
      </div>

      <Separator />

      {/* Metadatos */}
      {(ocr_proveedor || confianza != null || tiempo_procesamiento_ms != null) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {ocr_proveedor && <MetaDato icon={Server} etiqueta="Proveedor" valor={ocr_proveedor} />}
          {confianza != null && (
            <MetaDato
              icon={Percent}
              etiqueta="Confianza"
              valor={
                <Badge
                  variant={confianzaLabel(confianza).variante}
                  className="h-4 px-1.5 text-[10px]"
                >
                  {confianzaLabel(confianza).texto}
                </Badge>
              }
            />
          )}
          {tiempo_procesamiento_ms != null && (
            <MetaDato icon={Clock} etiqueta="Tiempo" valor={formatMs(tiempo_procesamiento_ms)} />
          )}
        </div>
      )}

      {/* Texto extraído */}
      {esCompletado && texto_extraido && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Texto extraído
          </p>
          <ScrollArea className="h-48 rounded-md border bg-muted/30 p-3">
            <pre className="whitespace-pre-wrap text-xs leading-relaxed font-mono text-foreground">
              {texto_extraido}
            </pre>
          </ScrollArea>
        </div>
      )}

      {/* Sin texto */}
      {esCompletado && !texto_extraido && (
        <p className="text-xs text-muted-foreground italic">
          No se pudo extraer texto del documento.
        </p>
      )}

      {/* Procesando */}
      {esProcesando && <p className="text-xs text-muted-foreground">Procesamiento en curso...</p>}

      {/* Requiere backend */}
      {esRequiereBackend && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs text-amber-800">
            Este PDF requiere procesamiento en servidor. El texto se extraerá automáticamente cuando
            se implemente el módulo de Edge Functions (IA-2).
          </p>
        </div>
      )}

      {/* Error */}
      {esError && error_mensaje && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-xs text-destructive">{error_mensaje}</p>
        </div>
      )}
    </div>
  );
}
