/**
 * topes-partes-relacionadas.tsx
 * Muestra barra de progreso y alerta si los gastos con partes relacionadas
 * se acercan o superan los límites de la LRTI Art. 10 num. 5.
 *
 * Topes:
 *   Regalías / servicios → 20% de (base imponible + gasto)
 *   Gastos indirectos    →  5% de (base imponible + gasto)
 */
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { useTopesPartesRelacionadas } from "@/hooks/entities/use-impuestos";

interface Props {
  empresaId: string;
  anio: number;
}

export function TopesPartesRelacionadas({ empresaId, anio }: Props) {
  const { data, isLoading } = useTopesPartesRelacionadas(empresaId, anio);

  if (isLoading) return null;

  // Si no hay ningún gasto con partes relacionadas, no mostrar el bloque
  if (!data || (data.gastos_royalties_servicios === 0 && data.gastos_indirectos === 0)) {
    return null;
  }

  return (
    <div className="rounded-lg border space-y-0">
      <div className="px-4 py-2.5 text-sm font-medium bg-muted/30 border-b rounded-t-lg flex items-center gap-2">
        <Info className="size-3.5 text-muted-foreground" />
        Topes gastos partes relacionadas — LRTI Art. 10 num. 5
      </div>

      <div className="divide-y">
        {/* Regalías / servicios → 20% */}
        {data.gastos_royalties_servicios > 0 && (
          <TopeRow
            label="Regalías y servicios a partes relacionadas"
            normativa="Límite 20% de la base imponible + gasto (LRTI Art. 10 num. 5)"
            gastado={data.gastos_royalties_servicios}
            limite={data.limite_royalties_servicios}
            exceso={data.exceso_royalties_servicios}
            pctUsado={data.pct_usado_royalties}
          />
        )}

        {/* Gastos indirectos → 5% */}
        {data.gastos_indirectos > 0 && (
          <TopeRow
            label="Gastos indirectos del exterior (partes relacionadas)"
            normativa="Límite 5% de la base imponible + gasto (LRTI Art. 10 num. 5)"
            gastado={data.gastos_indirectos}
            limite={data.limite_indirectos}
            exceso={data.exceso_indirectos}
            pctUsado={data.pct_usado_indirectos}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-componente ────────────────────────────────────────────────────────────

interface TopeRowProps {
  label: string;
  normativa: string;
  gastado: number;
  limite: number;
  exceso: number;
  pctUsado: number;
}

function TopeRow({ label, normativa, gastado, limite, exceso, pctUsado }: TopeRowProps) {
  const superado = exceso > 0;
  const advertencia = !superado && pctUsado >= 80;

  // Color de la barra de progreso
  const barColor = superado
    ? "bg-destructive"
    : advertencia
      ? "bg-amber-400"
      : "bg-emerald-500";

  const pctDisplay = Math.min(pctUsado, 100);

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium">{label}</p>
          <p className="text-[10px] text-muted-foreground">{normativa}</p>
        </div>
        {superado ? (
          <div className="flex items-center gap-1 text-destructive shrink-0">
            <AlertTriangle className="size-3.5" />
            <span className="text-xs font-semibold">Excedido</span>
          </div>
        ) : advertencia ? (
          <div className="flex items-center gap-1 text-amber-600 shrink-0">
            <AlertTriangle className="size-3.5" />
            <span className="text-xs font-semibold">{pctUsado.toFixed(0)}% usado</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-emerald-600 shrink-0">
            <CheckCircle2 className="size-3.5" />
            <span className="text-xs font-semibold">{pctUsado.toFixed(0)}% usado</span>
          </div>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pctDisplay}%` }}
        />
      </div>

      {/* Montos */}
      <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
        <div>
          <p>Gasto registrado</p>
          <p className="font-mono font-medium text-foreground">{formatCurrency(gastado)}</p>
        </div>
        <div>
          <p>Límite deducible</p>
          <p className="font-mono font-medium text-foreground">{formatCurrency(limite)}</p>
        </div>
        <div>
          <p>{superado ? "No deducible" : "Margen disponible"}</p>
          <p className={`font-mono font-medium ${superado ? "text-destructive" : "text-emerald-600"}`}>
            {superado ? formatCurrency(exceso) : formatCurrency(limite - gastado)}
          </p>
        </div>
      </div>

      {superado && (
        <div className="flex items-start gap-1.5 text-xs text-destructive bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <span>
            {formatCurrency(exceso)} no será deducible. Revisa con tu contador antes de presentar la declaración.
          </span>
        </div>
      )}
    </div>
  );
}
