import { CheckCircle2, Clock, Receipt } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { useDeclaracionesSri, useUpdateDeclaracion } from "@/hooks/entities/use-impuestos";
import { toast } from "@/components/common/toast";
import type { DeclaracionSri } from "@/services/impuestos";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const MESES = [
  "","Ene","Feb","Mar","Abr","May","Jun",
  "Jul","Ago","Sep","Oct","Nov","Dic",
];

const TIPO_LABELS: Record<string, string> = {
  iva_mensual: "IVA Mensual",
  iva_semestral: "IVA Semestral",
  ir_anual: "Impuesto a la Renta",
  anticipo_ir: "Anticipo IR",
};

const ESTADO_CFG: Record<string, { label: string; cls: string }> = {
  borrador:   { label: "Borrador",   cls: "bg-gray-100 text-gray-600" },
  presentada: { label: "Presentada", cls: "bg-blue-100 text-blue-700" },
  pagada:     { label: "Pagada",     cls: "bg-emerald-100 text-emerald-700" },
};

interface Props {
  empresaId: string;
  anio: number;
}

export function HistorialDeclaraciones({ empresaId, anio }: Props) {
  const { data: declaraciones = [], isLoading } = useDeclaracionesSri(empresaId, anio);
  const update = useUpdateDeclaracion();

  async function handleEstado(decl: DeclaracionSri, estado: string) {
    try {
      await update.mutateAsync({
        id: decl.id,
        payload: {
          estado,
          fecha_presentacion: estado !== "borrador" ? new Date().toISOString().split("T")[0] : null,
        },
      });
      toast.success("Estado actualizado");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function periodoLabel(decl: DeclaracionSri) {
    if (decl.tipo === "ir_anual") return `Año ${decl.anio}`;
    if (decl.tipo === "iva_mensual" && decl.periodo)
      return `${MESES[decl.periodo]} ${decl.anio}`;
    if (decl.tipo === "iva_semestral" && decl.periodo)
      return `${decl.periodo}° sem ${decl.anio}`;
    return `${decl.anio}`;
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Cargando historial…</div>;
  }

  if (declaraciones.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
        <Receipt className="size-8 opacity-40" />
        <p className="text-sm">Sin declaraciones guardadas para {anio}.</p>
        <p className="text-xs">Calcula IVA o IR y presiona "Guardar en historial".</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {declaraciones.map((d) => {
        const cfg = ESTADO_CFG[d.estado] ?? ESTADO_CFG.borrador;
        const montoIva = d.iva_a_pagar;
        const montoIr = d.ir_a_pagar;
        const esIva = d.tipo.startsWith("iva");
        const monto = esIva ? montoIva : montoIr;

        return (
          <div key={d.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
            <div className="shrink-0">
              {d.estado === "pagada" ? (
                <CheckCircle2 className="size-5 text-emerald-500" />
              ) : (
                <Clock className="size-5 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{TIPO_LABELS[d.tipo]}</span>
                <span className="text-xs text-muted-foreground">· {periodoLabel(d)}</span>
              </div>
              {esIva && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ventas: {formatCurrency(d.iva_ventas)} · Crédito: {formatCurrency(d.credito_tributario_compras)} · Ret.: {formatCurrency(d.retenciones_iva_recibidas)}
                </p>
              )}
              {!esIva && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ingresos: {formatCurrency(d.ingresos_gravables)} · Gastos: {formatCurrency(d.gastos_deducibles)} · IR causado: {formatCurrency(d.ir_causado)}
                </p>
              )}
            </div>

            <div className="text-right shrink-0">
              <p className={`text-base font-bold ${monto > 0 ? "text-destructive" : "text-emerald-600"}`}>
                {formatCurrency(monto)}
              </p>
              <p className="text-xs text-muted-foreground">a pagar</p>
            </div>

            <Select value={d.estado} onValueChange={(v) => handleEstado(d, v)}>
              <SelectTrigger className="h-7 w-28 text-xs">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>
                  {cfg.label}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="presentada">Presentada</SelectItem>
                <SelectItem value="pagada">Pagada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
