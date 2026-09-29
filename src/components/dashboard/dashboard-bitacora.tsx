import { ArrowRight, BookOpen, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  NIVEL_BLOQUEO_LABELS,
  NIVEL_BLOQUEO_COLOR,
  TIPO_PROYECTO_LABELS,
  type ResumenBitacora,
  type NivelBloqueo,
  type TipoProyecto,
} from "@/services/bitacora";

interface Props {
  data: ResumenBitacora[] | undefined;
  loading: boolean;
  onNavigate: () => void;
}

export function DashboardBitacora({ data, loading, onNavigate }: Props) {
  const rows = data ?? [];
  const conActividad = rows.filter((r) => r.total_entradas > 0);
  const conBloqueo = rows.filter((r) => r.tiene_bloqueo);

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Bitácora de proyectos</h3>
          {conBloqueo.length > 0 && (
            <Badge variant="destructive" className="text-xs gap-1 px-1.5 py-0 h-4">
              <AlertTriangle className="size-2.5" />
              {conBloqueo.length} bloqueo{conBloqueo.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={onNavigate}>
          Ver proyectos
          <ArrowRight className="size-3" />
        </Button>
      </div>

      {/* Body */}
      <div className="divide-y">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-5 py-3 space-y-1.5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No hay proyectos registrados.
          </div>
        ) : (
          rows.slice(0, 8).map((r) => {
            const nivel = r.nivel_bloqueo_max as NivelBloqueo | null;
            const tipo = r.tipo_proyecto as TipoProyecto | null;
            const pct = r.ultimo_pct ?? 0;

            return (
              <div key={r.proyecto_id} className="px-5 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium truncate">{r.proyecto_nombre}</span>
                      {tipo && tipo !== "otro" && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-3.5 shrink-0">
                          {TIPO_PROYECTO_LABELS[tipo]}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {r.ultima_fecha && (
                        <span className="text-xs text-muted-foreground">
                          Última entrada: {new Date(r.ultima_fecha + "T12:00:00").toLocaleDateString("es-EC", { day: "numeric", month: "short" })}
                        </span>
                      )}
                      {r.ultimo_usuario && (
                        <span className="text-xs text-muted-foreground">· {r.ultimo_usuario}</span>
                      )}
                      {r.entradas_hoy > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-3.5">
                          {r.entradas_hoy} hoy
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {nivel && r.tiene_bloqueo && (
                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded",
                          NIVEL_BLOQUEO_COLOR[nivel],
                        )}
                      >
                        {NIVEL_BLOQUEO_LABELS[nivel]}
                      </span>
                    )}
                    <span className="text-xs font-semibold tabular-nums w-8 text-right">{pct}%</span>
                  </div>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      {!loading && rows.length > 0 && (
        <div className="px-5 py-2.5 border-t flex items-center gap-4 text-xs text-muted-foreground">
          <span>{rows.length} proyecto{rows.length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{conActividad.length} con bitácora</span>
          {conBloqueo.length > 0 && (
            <>
              <span>·</span>
              <span className="text-destructive font-medium">
                {conBloqueo.length} con bloqueo activo
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
