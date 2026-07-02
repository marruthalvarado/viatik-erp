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

  const map = new Map<string, { nombre: string; total: number }>();
  for (const row of data ?? []) {
    const key = row.categoria_gasto_id ?? "__sin_categoria__";
    const nombre =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row as any).categorias_gasto?.nombre ?? "Sin categoria";
    const existing = map.get(key);
    if (existing) {
      existing.total += Number(row.valor_factura) || 0;
    } else {
      map.set(key, { nombre, total: Number(row.valor_factura) || 0 });
    }
  }

  const result = Array.from(map.entries())
    .map(([id, { nombre, total }]) => ({
      categoria_id: id === "__sin_categoria__" ? null : id,
      categoria_nombre: nombre,
      total,
    }))
    .sort((a, b) => b.total - a.total);

  // Agregar "Vehiculo propio" sumando km desde viajes + politica
  try {
    let rQuery = supabase
      .from("rendiciones")
      .select("id")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null);
    if (anio) {
      rQuery = rQuery
        .gte("fecha_rendicion", `${anio}-01-01`)
        .lte("fecha_rendicion", `${anio}-12-31`);
    }
    const { data: rendData } = await rQuery;
    const rendIds = (rendData ?? []).map((r: { id: string }) => r.id);

    if (rendIds.length > 0) {
      const [politicaRes, viajesRes] = await Promise.all([
        supabase
          .from("politicas")
          .select("valor_km, km_ciudad_por_dia")
          .eq("empresa_id", empresaId)
          .order("created_at")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("viajes")
          .select("distancia_km, fecha_inicio, fecha_fin")
          .in("rendicion_id", rendIds)
          .eq("vehiculo_propio", true)
          .gt("distancia_km", 0),
      ]);

      const valorKm = Number(politicaRes.data?.valor_km ?? 0);
      const kmCiudadDia = Number(politicaRes.data?.km_ciudad_por_dia ?? 0);

      let totalVehiculo = 0;
      for (const v of viajesRes.data ?? []) {
        totalVehiculo += Number(v.distancia_km ?? 0) * 2 * valorKm;
        if (v.fecha_inicio && v.fecha_fin && kmCiudadDia > 0) {
          const dias =
            Math.ceil(
              (new Date(v.fecha_fin).getTime() - new Date(v.fecha_inicio).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1;
          totalVehiculo += dias * kmCiudadDia * valorKm;
        }
      }

      if (totalVehiculo > 0) {
        result.push({
          categoria_id: "__vehiculo_propio__",
          categoria_nombre: "Vehiculo propio",
          total: totalVehiculo,
        });
        result.sort((a, b) => b.total - a.total);
      }
    }
  } catch {
    // No fatal: si falla km propio, retorna solo gastos por categoria
  }

  return result;
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
  // Leer de rendiciones.total_facturado (incluye km vehiculo propio y filtro politica)
  const { data, error } = await supabase
    .from("rendiciones")
    .select("fecha_rendicion, total_facturado, total_reembolsable")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .gte("fecha_rendicion", `${anio}-01-01`)
    .lte("fecha_rendicion", `${anio}-12-31`);
  if (error) throw new Error(error.message);

  const map = new Map<string, { total_facturado: number; total_reembolsable: number }>();
  for (const row of data ?? []) {
    if (!row.fecha_rendicion) continue;
    const mes = row.fecha_rendicion.slice(0, 7); // "YYYY-MM"
    const existing = map.get(mes) ?? { total_facturado: 0, total_reembolsable: 0 };
    existing.total_facturado += Number(row.total_facturado) || 0;
    existing.total_reembolsable += Number(row.total_reembolsable) || 0;
    map.set(mes, existing);
  }

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

// ─── Presupuesto activo total ──────────────────────────────────────────────────

export async function getPresupuestoTotal(empresaId: string): Promise<number> {
  const { data, error } = await supabase
    .from("presupuestos")
    .select("valor_total")
    .eq("empresa_id", empresaId)
    .eq("activo", true);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
}
