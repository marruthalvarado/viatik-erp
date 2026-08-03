import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { FlujoCajaMes } from "@/services/facturas-emitidas";

export function FlujoCajaChart({ data, anio }: { data: FlujoCajaMes[]; anio: number }) {
  return (
    <div className="mb-6 rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Flujo de Caja Proyectado {anio}</p>
          <p className="text-xs text-muted-foreground">
            Monto esperado vs cobrado por mes de vencimiento
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) =>
              v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
            }
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                monto_esperado: "Esperado",
                monto_cobrado: "Cobrado",
                monto_pendiente: "Pendiente",
              };
              return [`$${value.toFixed(2)}`, labels[name] ?? name];
            }}
          />
          <Legend
            formatter={(value: string) =>
              (
                {
                  monto_esperado: "Esperado",
                  monto_cobrado: "Cobrado",
                  monto_pendiente: "Pendiente",
                } as Record<string, string>
              )[value] ?? value
            }
          />
          <Bar dataKey="monto_esperado" fill="#94a3b8" radius={[3, 3, 0, 0]} />
          <Bar dataKey="monto_cobrado" fill="#10b981" radius={[3, 3, 0, 0]} />
          <Bar dataKey="monto_pendiente" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
