/**
 * Servicio de Dashboard Ejecutivo.
 * Consume vistas vw_dashboard_* para KPIs agregados.
 * Para datos no cubiertos por vistas (evolución mensual, por categoría,
 * top viajeros, rendiciones pendientes) consulta tablas directamente.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/types/database";

// ─── Tipos derivados de vistas ─────────────────────────────────────────────────

export type DashboardEjecutivo = Tables<"vw_dashboard_ejecutivo">;
export type DashboardProyecto = Tables<"vw_dashboard_proyectos">;
export type DashboardCliente = Tables<"vw_dashboard_clientes">;
export type DashboardProveedor = Tables<"vw_dashboard_proveedores">;
export type DashboardIA = Tables<"vw_dashboard_ia">;

// ─── Tipos para datos sin vista ────────────────────────────────────────────────

export interface GastoCategoria {
  categoria_id: string | null;
  categoria_nombre: string;
  total: number;
}

export interface EvolucionMensual {
  mes: string; // "YYYY-MM"
  label: string; // "Ene", "Feb", …
  total_facturado: number;
  total_reembolsable: number;
}

export interface RendicionPendiente {
  id: string;
  numero: string;
  descripcion: string | null;
  proyecto_nombre: string | null;
  fecha_rendicion: string | null;
  total_facturado: number | null;
  estado_nombre: string | null;
  estado_codigo: string | null;
  usuario_nombre: string | null;
}

export interface TopViajero {
  usuario_id: string;
  nombre: string;
  total_rendiciones: number;
  total_gastado: number;
}

// ─── Vistas ────────────────────────────────────────────────────────────────────

export async function getEjecutivo(empresaId: string): Promise<DashboardEjecutivo | null> {
  const { data, error } = await supabase
    .from("vw_dashboard_ejecutivo")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getProyectos(empresaId: string, limit = 10): Promise<DashboardProyecto[]> {
  const { data, error } = await supabase
    .from("vw_dashboard_proyectos")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("gasto_real", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClientes(empresaId: string, limit = 10): Promise<DashboardCliente[]> {
  const { data, error } = await supabase
    .from("vw_dashboard_clientes")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("total_gastado", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProveedores(empresaId: string, limit = 10): Promise<DashboardProveedor[]> {
  const { data, error } = await supabase
    .from("vw_dashboard_proveedores")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("total_gastado", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getIA(empresaId: string): Promise<DashboardIA | null> {
  const { data, error } = await supabase
    .from("vw_dashboard_ia")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// ─── Datos sin vista ───────────────────────────────────────────────────────────

export async function getGastosPorCategoria(
  empresaId: string,
  anio?: number,
): Promise<GastoCategoria[]> {
  let q = supabase
    .from("gastos")
    .select("categoria_gasto_id, valor_factura, categorias_gasto(nombre)")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null);

  if (anio) {
    q = q.gte("fecha", `${anio}-01-01`).lte("fecha", `${anio}-12-31`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  // Agregar en cliente
  const map = new Map<string, { nombre: string; total: number }>();
  for (const row of data ?? []) {
    const key = row.categoria_gasto_id ?? "__sin_categoria__";
    const nombre =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row as any).categorias_gasto?.nombre ?? "Sin categoría";
    const existing = map.get(key);
    if (existing) {
      existing.total += Number(row.valor_factura) || 0;
    } else {
      map.set(key, { nombre, total: Number(row.valor_factura) || 0 });
    }
  }

  return Array.from(map.entries())
    .map(([id, { nombre, total }]) => ({
      categoria_id: id === "__sin_categoria__" ? null : id,
      categoria_nombre: nombre,
      total,
    }))
    .sort((a, b) => b.total - a.total);
}

const MES_LABELS: Record<string, string> = {
  "01": "Ene",
  "02": "Feb",
  "03": "Mar",
  "04": "Abr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dic",
};

export async function getEvolucionMensual(
  empresaId: string,
  anio: number,
): Promise<EvolucionMensual[]> {
  const { data, error } = await supabase
    .from("gastos")
    .select("fecha, valor_factura, valor_reembolsable")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .gte("fecha", `${anio}-01-01`)
    .lte("fecha", `${anio}-12-31`);
  if (error) throw new Error(error.message);

  const map = new Map<string, { total_facturado: number; total_reembolsable: number }>();
  for (const row of data ?? []) {
    if (!row.fecha) continue;
    const mes = row.fecha.slice(0, 7); // "YYYY-MM"
    const existing = map.get(mes) ?? { total_facturado: 0, total_reembolsable: 0 };
    existing.total_facturado += Number(row.valor_factura) || 0;
    existing.total_reembolsable += Number(row.valor_reembolsable) || 0;
    map.set(mes, existing);
  }

  // Generar los 12 meses del año (para que el gráfico muestre meses vacíos)
  const result: EvolucionMensual[] = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    const mes = `${anio}-${mm}`;
    const val = map.get(mes) ?? { total_facturado: 0, total_reembolsable: 0 };
    result.push({ mes, label: MES_LABELS[mm] ?? mm, ...val });
  }
  return result;
}

export async function getRendicionesPendientes(
  empresaId: string,
  limit = 10,
): Promise<RendicionPendiente[]> {
  const { data, error } = await supabase
    .from("rendiciones")
    .select(
      `id, numero, descripcion, fecha_rendicion, total_facturado,
       proyectos(nombre),
       estados_rendicion(nombre, codigo),
       usuarios(nombres, apellidos)`,
    )
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .not("estados_rendicion.codigo", "in", '("aprobada","rechazada")')
    .order("fecha_rendicion", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ra = r as any;
    return {
      id: r.id,
      numero: r.numero,
      descripcion: r.descripcion,
      proyecto_nombre: ra.proyectos?.nombre ?? null,
      fecha_rendicion: r.fecha_rendicion,
      total_facturado: r.total_facturado,
      estado_nombre: ra.estados_rendicion?.nombre ?? null,
      estado_codigo: ra.estados_rendicion?.codigo ?? null,
      usuario_nombre: ra.usuarios
        ? `${ra.usuarios.nombres ?? ""} ${ra.usuarios.apellidos ?? ""}`.trim()
        : null,
    };
  });
}

export async function getTopViajeros(
  empresaId: string,
  anio?: number,
  limit = 10,
): Promise<TopViajero[]> {
  let q = supabase
    .from("rendiciones")
    .select(`usuario_id, total_facturado, usuarios(nombres, apellidos)`)
    .eq("empresa_id", empresaId)
    .is("deleted_at", null);

  if (anio) {
    q = q.gte("fecha_rendicion", `${anio}-01-01`).lte("fecha_rendicion", `${anio}-12-31`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  // Agregar por usuario
  const map = new Map<
    string,
    { nombre: string; total_rendiciones: number; total_gastado: number }
  >();
  for (const row of data ?? []) {
    if (!row.usuario_id) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ra = row as any;
    const nombre = ra.usuarios
      ? `${ra.usuarios.nombres ?? ""} ${ra.usuarios.apellidos ?? ""}`.trim()
      : row.usuario_id;
    const existing = map.get(row.usuario_id) ?? {
      nombre,
      total_rendiciones: 0,
      total_gastado: 0,
    };
    existing.total_rendiciones += 1;
    existing.total_gastado += Number(row.total_facturado) || 0;
    map.set(row.usuario_id, existing);
  }

  return Array.from(map.entries())
    .map(([usuario_id, vals]) => ({ usuario_id, ...vals }))
    .sort((a, b) => b.total_gastado - a.total_gastado)
    .slice(0, limit);
}
