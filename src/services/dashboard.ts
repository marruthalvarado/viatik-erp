/**
 * Servicio de Dashboard Ejecutivo.
 * KPIs y charts filtran por anio cuando se proporciona.
 * Datos sin vista (evolucion mensual, categorias, top viajeros)
 * consultan tablas directamente.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/types/database";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DashboardEjecutivo = Tables<"vw_dashboard_ejecutivo">;
export type DashboardProyecto = Tables<"vw_dashboard_proyectos">;
export type DashboardCliente = Tables<"vw_dashboard_clientes">;
export type DashboardProveedor = Tables<"vw_dashboard_proveedores">;
export type DashboardIA = Tables<"vw_dashboard_ia">;

export interface GastoCategoria {
  categoria_id: string | null;
  categoria_nombre: string;
  total: number;
}

export interface EvolucionMensual {
  mes: string;
  label: string;
  total_facturado: number;
  total_reembolsable: number;
  total_km_vehiculo: number;
}

/** Evolución mensual financiera: Ingresos vs Costos */
export interface EvolucionFinanciera {
  mes: string;
  label: string;
  ingresos: number;        // facturas_emitidas.total
  costos_empresa: number;  // gastos_empresa.total
  costos_viaticos: number; // rendiciones.total_facturado (gastos de viaje)
  margen: number;          // ingresos - costos_empresa - costos_viaticos
}

/** KPIs de negocio: Ingresos, Costos, Margen, Cobros */
export interface KpisNegocio {
  ingresos: number;
  costos: number;
  margen: number;
  margen_pct: number | null;
  cobrado: number;
  por_cobrar: number;
}

/** Proyecto simple para selectores */
export interface ProyectoSimple {
  id: string;
  nombre: string;
  cliente_nombre: string | null;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateRange(anio: number) {
  return { gte: `${anio}-01-01`, lte: `${anio}-12-31` };
}

// ─── KPIs ejecutivo (filtrable por año) ───────────────────────────────────────

export async function getEjecutivo(
  empresaId: string,
  anio?: number,
): Promise<DashboardEjecutivo | null> {
  let qRend = supabase
    .from("rendiciones")
    .select("total_facturado, total_reembolsable, proyecto_id, usuario_id")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null);

  let qGe = supabase
    .from("gastos_empresa")
    .select("total, proyecto_id")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null);

  if (anio) {
    const { gte, lte } = dateRange(anio);
    qRend = qRend.gte("fecha_rendicion", gte).lte("fecha_rendicion", lte);
    qGe = qGe.gte("fecha", gte).lte("fecha", lte);
  }

  const [{ data: rends, error }, { data: geRows }, { data: anticipos }] = await Promise.all([
    qRend,
    qGe,
    supabase.from("anticipos").select("valor").eq("empresa_id", empresaId),
  ]);
  if (error) throw new Error(error.message);

  const rows = rends ?? [];
  const ge = geRows ?? [];
  const totalGe = ge.reduce((s, g) => s + (Number(g.total) || 0), 0);
  const proyectosConMovimiento = new Set([
    ...rows.filter((r) => r.proyecto_id).map((r) => r.proyecto_id),
    ...ge.filter((g) => g.proyecto_id).map((g) => g.proyecto_id),
  ]);

  return {
    empresa_id: empresaId,
    total_gastado: rows.reduce((s, r) => s + (Number(r.total_facturado) || 0), 0) + totalGe,
    total_reembolsable: rows.reduce((s, r) => s + (Number(r.total_reembolsable) || 0), 0),
    total_rendiciones: rows.length,
    total_proyectos_con_movimiento: proyectosConMovimiento.size,
    total_usuarios_con_movimiento: new Set(
      rows.filter((r) => r.usuario_id).map((r) => r.usuario_id),
    ).size,
    total_anticipos: (anticipos ?? []).reduce((s, a) => s + (Number(a.valor) || 0), 0),
  };
}

// ─── Proyectos (filtrable por año) ────────────────────────────────────────────

export async function getProyectos(
  empresaId: string,
  limit = 10,
  anio?: number,
): Promise<DashboardProyecto[]> {
  let qRend = supabase
    .from("rendiciones")
    .select("proyecto_id, total_facturado")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .not("proyecto_id", "is", null);

  let qGe = supabase
    .from("gastos_empresa")
    .select("proyecto_id, total")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .not("proyecto_id", "is", null);

  if (anio) {
    const { gte, lte } = dateRange(anio);
    qRend = qRend.gte("fecha_rendicion", gte).lte("fecha_rendicion", lte);
    qGe = qGe.gte("fecha", gte).lte("fecha", lte);
  }

  const [rendRes, geRes, proyRes] = await Promise.all([
    qRend,
    qGe,
    supabase
      .from("proyectos")
      .select("id, nombre, presupuesto, valor_contrato")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null),
  ]);
  if (rendRes.error) throw new Error(rendRes.error.message);

  const proyMap = new Map((proyRes.data ?? []).map((p) => [p.id, p]));
  const gastoMap = new Map<string, number>();

  for (const r of rendRes.data ?? []) {
    if (!r.proyecto_id) continue;
    gastoMap.set(
      r.proyecto_id,
      (gastoMap.get(r.proyecto_id) ?? 0) + (Number(r.total_facturado) || 0),
    );
  }
  for (const g of geRes.data ?? []) {
    if (!g.proyecto_id) continue;
    gastoMap.set(
      g.proyecto_id,
      (gastoMap.get(g.proyecto_id) ?? 0) + (Number(g.total) || 0),
    );
  }

  // Incluir proyectos con contrato aunque no tengan gastos aún
  for (const p of proyRes.data ?? []) {
    if (!gastoMap.has(p.id)) gastoMap.set(p.id, 0);
  }

  return Array.from(gastoMap.entries())
    .map(([proyecto_id, gasto_real]) => {
      const p = proyMap.get(proyecto_id);
      const presupuesto = Number(p?.presupuesto ?? 0);
      const valor_contrato = Number(p?.valor_contrato ?? 0);
      return {
        empresa_id: empresaId,
        proyecto_id,
        nombre: p?.nombre ?? proyecto_id,
        presupuesto,
        valor_contrato,
        gasto_real,
        saldo_presupuesto: presupuesto - gasto_real,
        margen_estimado:
          valor_contrato > 0
            ? Math.round(((valor_contrato - gasto_real) / valor_contrato) * 100)
            : null,
      };
    })
    .sort((a, b) => b.gasto_real - a.gasto_real)
    .slice(0, limit);
}

// ─── Clientes (filtrable por año) ─────────────────────────────────────────────

export async function getClientes(
  empresaId: string,
  limit = 10,
  anio?: number,
): Promise<DashboardCliente[]> {
  if (!anio) {
    const { data, error } = await supabase
      .from("vw_dashboard_clientes")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("total_gastado", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  const { gte, lte } = dateRange(anio);

  // rendiciones + gastos_empresa → proyecto_id → cliente_id
  const [rendRes, geRes, proyRes, cliRes] = await Promise.all([
    supabase
      .from("rendiciones")
      .select("proyecto_id, total_facturado, id")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .not("proyecto_id", "is", null)
      .gte("fecha_rendicion", gte)
      .lte("fecha_rendicion", lte),
    supabase
      .from("gastos_empresa")
      .select("proyecto_id, total")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .not("proyecto_id", "is", null)
      .gte("fecha", gte)
      .lte("fecha", lte),
    supabase
      .from("proyectos")
      .select("id, cliente_id")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null),
    supabase
      .from("clientes")
      .select("id, nombre")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null),
  ]);
  if (rendRes.error) throw new Error(rendRes.error.message);

  const proyToCliente = new Map((proyRes.data ?? []).map((p) => [p.id, p.cliente_id]));
  const clienteMap = new Map((cliRes.data ?? []).map((c) => [c.id, c.nombre]));
  const totales = new Map<string, { total: number; rendIds: Set<string> }>();

  for (const r of rendRes.data ?? []) {
    if (!r.proyecto_id) continue;
    const clienteId = proyToCliente.get(r.proyecto_id);
    if (!clienteId) continue;
    const entry = totales.get(clienteId) ?? { total: 0, rendIds: new Set() };
    entry.total += Number(r.total_facturado) || 0;
    entry.rendIds.add(r.id);
    totales.set(clienteId, entry);
  }

  for (const g of geRes.data ?? []) {
    if (!g.proyecto_id) continue;
    const clienteId = proyToCliente.get(g.proyecto_id);
    if (!clienteId) continue;
    const entry = totales.get(clienteId) ?? { total: 0, rendIds: new Set() };
    entry.total += Number(g.total) || 0;
    totales.set(clienteId, entry);
  }

  return Array.from(totales.entries())
    .map(([cliente_id, { total, rendIds }]) => ({
      empresa_id: empresaId,
      cliente_id,
      cliente: clienteMap.get(cliente_id) ?? cliente_id,
      total_gastado: total,
      total_rendiciones: rendIds.size,
      total_proyectos: null,
    }))
    .sort((a, b) => b.total_gastado - a.total_gastado)
    .slice(0, limit);
}

// ─── Proveedores (filtrable por año) ──────────────────────────────────────────

export async function getProveedores(
  empresaId: string,
  limit = 10,
  anio?: number,
): Promise<DashboardProveedor[]> {
  if (!anio) {
    const { data, error } = await supabase
      .from("vw_dashboard_proveedores")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("total_gastado", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  const { gte, lte } = dateRange(anio);

  // IDs de rendiciones del año
  const [rendRes, geRes, provRes] = await Promise.all([
    supabase
      .from("rendiciones")
      .select("id")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .gte("fecha_rendicion", gte)
      .lte("fecha_rendicion", lte),
    supabase
      .from("gastos_empresa")
      .select("proveedor_id, total")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .not("proveedor_id", "is", null)
      .gte("fecha", gte)
      .lte("fecha", lte),
    supabase
      .from("proveedores")
      .select("id, nombre")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null),
  ]);
  if (rendRes.error) throw new Error(rendRes.error.message);

  const provMap = new Map((provRes.data ?? []).map((p) => [p.id, p.nombre]));
  const totales = new Map<string, { total: number; count: number }>();

  // Gastos de rendiciones
  const rendIds = (rendRes.data ?? []).map((r) => r.id);
  if (rendIds.length > 0) {
    const gastosRes = await supabase
      .from("gastos")
      .select("proveedor_id, valor_factura")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .in("rendicion_id", rendIds);
    for (const g of gastosRes.data ?? []) {
      if (!g.proveedor_id) continue;
      const entry = totales.get(g.proveedor_id) ?? { total: 0, count: 0 };
      entry.total += Number(g.valor_factura) || 0;
      entry.count += 1;
      totales.set(g.proveedor_id, entry);
    }
  }

  // Gastos empresa
  for (const g of geRes.data ?? []) {
    if (!g.proveedor_id) continue;
    const entry = totales.get(g.proveedor_id) ?? { total: 0, count: 0 };
    entry.total += Number(g.total) || 0;
    entry.count += 1;
    totales.set(g.proveedor_id, entry);
  }

  return Array.from(totales.entries())
    .map(([id, { total, count }]) => ({
      empresa_id: empresaId,
      id,
      nombre: provMap.get(id) ?? id,
      total_gastado: total,
      cantidad_gastos: count,
    }))
    .sort((a, b) => b.total_gastado - a.total_gastado)
    .slice(0, limit);
}

// ─── IA (sin filtro de año) ───────────────────────────────────────────────────

export async function getIA(empresaId: string): Promise<DashboardIA | null> {
  const { data, error } = await supabase
    .from("vw_dashboard_ia")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// ─── Gastos por categoría (filtrable por año) ─────────────────────────────────

export async function getGastosPorCategoria(
  empresaId: string,
  anio?: number,
): Promise<GastoCategoria[]> {
  let qGastos = supabase
    .from("gastos")
    .select("categoria_gasto_id, valor_factura, categorias_gasto(nombre)")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null);

  let qGe = supabase
    .from("gastos_empresa")
    .select("categoria_id, total, categorias_gasto(nombre)")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null);

  if (anio) {
    qGastos = qGastos.gte("fecha", `${anio}-01-01`).lte("fecha", `${anio}-12-31`);
    qGe = qGe.gte("fecha", `${anio}-01-01`).lte("fecha", `${anio}-12-31`);
  }

  const [{ data, error }, { data: geData }] = await Promise.all([qGastos, qGe]);
  if (error) throw new Error(error.message);

  const map = new Map<string, { nombre: string; total: number }>();

  for (const row of data ?? []) {
    const key = row.categoria_gasto_id ?? "__sin_categoria__";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nombre = (row as any).categorias_gasto?.nombre ?? "Sin categoria";
    const ex = map.get(key);
    if (ex) {
      ex.total += Number(row.valor_factura) || 0;
    } else {
      map.set(key, { nombre, total: Number(row.valor_factura) || 0 });
    }
  }

  for (const row of geData ?? []) {
    const key = (row as { categoria_id?: string | null }).categoria_id ?? "__sin_categoria__";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nombre = (row as any).categorias_gasto?.nombre ?? "Sin categoria";
    const ex = map.get(key);
    if (ex) {
      ex.total += Number(row.total) || 0;
    } else {
      map.set(key, { nombre, total: Number(row.total) || 0 });
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
      const { gte, lte } = dateRange(anio);
      rQuery = rQuery.gte("fecha_rendicion", gte).lte("fecha_rendicion", lte);
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
    // no fatal
  }

  return result;
}

// ─── Evolución mensual ────────────────────────────────────────────────────────

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
  const { gte, lte } = dateRange(anio);
  const [{ data, error }, { data: geData }] = await Promise.all([
    supabase
      .from("rendiciones")
      .select("id, fecha_rendicion, total_facturado, total_reembolsable")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .gte("fecha_rendicion", gte)
      .lte("fecha_rendicion", lte),
    supabase
      .from("gastos_empresa")
      .select("fecha, total")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .gte("fecha", gte)
      .lte("fecha", lte),
  ]);
  if (error) throw new Error(error.message);

  type MesEntry = {
    total_facturado: number;
    total_reembolsable: number;
    total_km_vehiculo: number;
  };
  const map = new Map<string, MesEntry>();
  const rendMesMap = new Map<string, string>(); // rendicion_id → mes "YYYY-MM"

  for (const row of data ?? []) {
    if (!row.fecha_rendicion) continue;
    const mes = row.fecha_rendicion.slice(0, 7);
    const ex = map.get(mes) ?? { total_facturado: 0, total_reembolsable: 0, total_km_vehiculo: 0 };
    ex.total_facturado += Number(row.total_facturado) || 0;
    ex.total_reembolsable += Number(row.total_reembolsable) || 0;
    map.set(mes, ex);
    rendMesMap.set(row.id, mes);
  }

  // Sumar gastos_empresa por mes
  for (const g of geData ?? []) {
    if (!g.fecha) continue;
    const mes = g.fecha.slice(0, 7);
    const ex = map.get(mes) ?? { total_facturado: 0, total_reembolsable: 0, total_km_vehiculo: 0 };
    ex.total_facturado += Number(g.total) || 0;
    map.set(mes, ex);
  }

  // Km vehículo propio por mes (sumado desde viajes con vehiculo_propio=true)
  const rendIds = Array.from(rendMesMap.keys());
  if (rendIds.length > 0) {
    try {
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
          .select("rendicion_id, distancia_km, fecha_inicio, fecha_fin")
          .in("rendicion_id", rendIds)
          .eq("vehiculo_propio", true)
          .gt("distancia_km", 0),
      ]);

      const valorKm = Number(politicaRes.data?.valor_km ?? 0);
      const kmCiudadDia = Number(politicaRes.data?.km_ciudad_por_dia ?? 0);

      for (const v of viajesRes.data ?? []) {
        const mes = rendMesMap.get(v.rendicion_id);
        if (!mes) continue;
        const ex = map.get(mes) ?? {
          total_facturado: 0,
          total_reembolsable: 0,
          total_km_vehiculo: 0,
        };
        ex.total_km_vehiculo += Number(v.distancia_km ?? 0) * 2 * valorKm;
        if (v.fecha_inicio && v.fecha_fin && kmCiudadDia > 0) {
          const dias =
            Math.ceil(
              (new Date(v.fecha_fin).getTime() - new Date(v.fecha_inicio).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1;
          ex.total_km_vehiculo += dias * kmCiudadDia * valorKm;
        }
        map.set(mes, ex);
      }
    } catch {
      // no fatal — km vehiculo propio queda en 0 si falla
    }
  }

  const result: EvolucionMensual[] = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    const mes = `${anio}-${mm}`;
    const val = map.get(mes) ?? { total_facturado: 0, total_reembolsable: 0, total_km_vehiculo: 0 };
    result.push({ mes, label: MES_LABELS[mm] ?? mm, ...val });
  }
  return result;
}

// ─── Rendiciones pendientes ───────────────────────────────────────────────────

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

// ─── Top viajeros (filtrable por año) ────────────────────────────────────────

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
    const { gte, lte } = dateRange(anio);
    q = q.gte("fecha_rendicion", gte).lte("fecha_rendicion", lte);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

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
    const ex = map.get(row.usuario_id) ?? { nombre, total_rendiciones: 0, total_gastado: 0 };
    ex.total_rendiciones += 1;
    ex.total_gastado += Number(row.total_facturado) || 0;
    map.set(row.usuario_id, ex);
  }

  return Array.from(map.entries())
    .map(([usuario_id, vals]) => ({ usuario_id, ...vals }))
    .sort((a, b) => b.total_gastado - a.total_gastado)
    .slice(0, limit);
}

// ─── Presupuesto activo total (sin filtro de año) ────────────────────────────

export async function getPresupuestoTotal(empresaId: string): Promise<number> {
  const { data, error } = await supabase
    .from("presupuestos")
    .select("valor_total")
    .eq("empresa_id", empresaId)
    .eq("activo", true);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((acc, p) => acc + (Number(p.valor_total) || 0), 0);
}

// ─── Resumen financiero por proyecto ─────────────────────────────────────────────────

export interface ResumenFinancieroProyecto {
  proyecto_id: string;
  nombre: string;
  cliente_nombre: string | null;
  presupuesto: number;
  valor_contrato: number;
  facturado: number;
  /** Total de gastos ejecutados: rendiciones + gastos_empresa */
  ejecutado: number;
  /** Gastos de rendiciones de viaje asignadas a este proyecto */
  ejecutado_rendiciones: number;
  /** Gastos de empresa (facturas, importaciones, etc.) asignados a este proyecto */
  ejecutado_empresa: number;
  ganancia: number;
  margen_pct: number | null;
}

export async function getResumenFinancieroProyectos(
  empresaId: string,
): Promise<ResumenFinancieroProyecto[]> {
  const [proyRes, rendRes, factRes, geRes] = await Promise.all([
    supabase
      .from("proyectos")
      .select("id, nombre, presupuesto, valor_contrato, cliente:clientes(nombre)")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .order("nombre"),
    supabase
      .from("rendiciones")
      .select("proyecto_id, total_facturado")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .not("proyecto_id", "is", null),
    supabase
      .from("facturas_emitidas")
      .select("proyecto_id, total")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .not("proyecto_id", "is", null),
    supabase
      .from("gastos_empresa")
      .select("proyecto_id, total")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .not("proyecto_id", "is", null),
  ]);

  if (proyRes.error) throw new Error(proyRes.error.message);

  // Gastos de rendiciones de viaje por proyecto
  const rendicionesMap = new Map<string, number>();
  for (const r of rendRes.data ?? []) {
    if (!r.proyecto_id) continue;
    rendicionesMap.set(
      r.proyecto_id,
      (rendicionesMap.get(r.proyecto_id) ?? 0) + (Number(r.total_facturado) || 0),
    );
  }

  // Gastos empresa (facturas, importaciones, etc.) por proyecto
  const gastoEmpresaMap = new Map<string, number>();
  for (const g of geRes.data ?? []) {
    if (!g.proyecto_id) continue;
    gastoEmpresaMap.set(
      g.proyecto_id,
      (gastoEmpresaMap.get(g.proyecto_id) ?? 0) + (Number(g.total) || 0),
    );
  }

  // Facturación emitida al cliente por proyecto
  const facturadoMap = new Map<string, number>();
  for (const f of factRes.data ?? []) {
    if (!f.proyecto_id) continue;
    facturadoMap.set(
      f.proyecto_id,
      (facturadoMap.get(f.proyecto_id) ?? 0) + (Number(f.total) || 0),
    );
  }

  return (proyRes.data ?? []).map((p) => {
    const raw = p.cliente as unknown;
    const cliente = (Array.isArray(raw) ? raw[0] : raw) as { nombre: string } | null;
    const presupuesto = Number(p.presupuesto ?? 0);
    const valor_contrato = Number(p.valor_contrato ?? 0);
    const ejecutado_rendiciones = rendicionesMap.get(p.id) ?? 0;
    const ejecutado_empresa = gastoEmpresaMap.get(p.id) ?? 0;
    const ejecutado = ejecutado_rendiciones + ejecutado_empresa;
    const facturado = facturadoMap.get(p.id) ?? 0;
    const ganancia = facturado > 0 ? facturado - ejecutado : valor_contrato - ejecutado;
    const base_margen = facturado > 0 ? facturado : valor_contrato;
    const margen_pct = base_margen > 0 ? Math.round((ganancia / base_margen) * 100) : null;
    return {
      proyecto_id: p.id,
      nombre: p.nombre,
      cliente_nombre: cliente?.nombre ?? null,
      presupuesto,
      valor_contrato,
      facturado,
      ejecutado,
      ejecutado_rendiciones,
      ejecutado_empresa,
      ganancia,
      margen_pct,
    };
  });
}

// ─── Proyectos simples para selector de filtro ────────────────────────────────

export async function getProyectosSimples(empresaId: string): Promise<ProyectoSimple[]> {
  const { data, error } = await supabase
    .from("proyectos")
    .select("id, nombre, cliente:clientes(nombre)")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cli = (p as any).cliente as { nombre: string } | null;
    return { id: p.id, nombre: p.nombre, cliente_nombre: cli?.nombre ?? null };
  });
}

// ─── Evolución financiera mensual (Ingresos vs Costos) ───────────────────────

export async function getEvolucionFinanciera(
  empresaId: string,
  anio: number,
  proyectoId?: string | null,
): Promise<EvolucionFinanciera[]> {
  const { gte, lte } = dateRange(anio);

  let qFact = supabase
    .from("facturas_emitidas")
    .select("fecha, total")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .neq("estado", "anulada")
    .gte("fecha", gte)
    .lte("fecha", lte);
  if (proyectoId) qFact = qFact.eq("proyecto_id", proyectoId);

  let qGe = supabase
    .from("gastos_empresa")
    .select("fecha, total")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .gte("fecha", gte)
    .lte("fecha", lte);
  if (proyectoId) qGe = qGe.eq("proyecto_id", proyectoId);

  let qRend = supabase
    .from("rendiciones")
    .select("fecha_rendicion, total_facturado")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .gte("fecha_rendicion", gte)
    .lte("fecha_rendicion", lte);
  if (proyectoId) qRend = qRend.eq("proyecto_id", proyectoId);

  const [factRes, geRes, rendRes] = await Promise.all([qFact, qGe, qRend]);
  if (factRes.error) throw new Error(factRes.error.message);

  type MesData = { ingresos: number; costos_empresa: number; costos_viaticos: number };
  const map = new Map<string, MesData>();

  for (const f of factRes.data ?? []) {
    if (!f.fecha) continue;
    const mes = f.fecha.slice(0, 7);
    const e = map.get(mes) ?? { ingresos: 0, costos_empresa: 0, costos_viaticos: 0 };
    e.ingresos += Number(f.total) || 0;
    map.set(mes, e);
  }
  for (const g of geRes.data ?? []) {
    if (!g.fecha) continue;
    const mes = g.fecha.slice(0, 7);
    const e = map.get(mes) ?? { ingresos: 0, costos_empresa: 0, costos_viaticos: 0 };
    e.costos_empresa += Number(g.total) || 0;
    map.set(mes, e);
  }
  for (const r of rendRes.data ?? []) {
    if (!r.fecha_rendicion) continue;
    const mes = r.fecha_rendicion.slice(0, 7);
    const e = map.get(mes) ?? { ingresos: 0, costos_empresa: 0, costos_viaticos: 0 };
    e.costos_viaticos += Number(r.total_facturado) || 0;
    map.set(mes, e);
  }

  const MES_LBL: Record<string, string> = {
    "01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun",
    "07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic",
  };

  const result: EvolucionFinanciera[] = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    const mes = `${anio}-${mm}`;
    const val = map.get(mes) ?? { ingresos: 0, costos_empresa: 0, costos_viaticos: 0 };
    result.push({
      mes,
      label: MES_LBL[mm] ?? mm,
      ...val,
      margen: val.ingresos - val.costos_empresa - val.costos_viaticos,
    });
  }
  return result;
}

// ─── KPIs de negocio (Ingresos / Costos / Margen / Por cobrar) ───────────────

export async function getKpisNegocio(
  empresaId: string,
  anio?: number,
  proyectoId?: string | null,
): Promise<KpisNegocio> {
  const { gte, lte } = anio ? dateRange(anio) : { gte: undefined, lte: undefined };

  let qFact = supabase
    .from("facturas_emitidas")
    .select("id, total")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .neq("estado", "anulada");
  if (gte) qFact = qFact.gte("fecha", gte).lte("fecha", lte!);
  if (proyectoId) qFact = qFact.eq("proyecto_id", proyectoId);

  let qGe = supabase
    .from("gastos_empresa")
    .select("total")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null);
  if (gte) qGe = qGe.gte("fecha", gte).lte("fecha", lte!);
  if (proyectoId) qGe = qGe.eq("proyecto_id", proyectoId);

  let qRend = supabase
    .from("rendiciones")
    .select("total_facturado")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null);
  if (gte) qRend = qRend.gte("fecha_rendicion", gte).lte("fecha_rendicion", lte!);
  if (proyectoId) qRend = qRend.eq("proyecto_id", proyectoId);

  const [factRes, geRes, rendRes] = await Promise.all([qFact, qGe, qRend]);
  if (factRes.error) throw new Error(factRes.error.message);

  const facturas = factRes.data ?? [];
  const ingresos = facturas.reduce((s, f) => s + (Number(f.total) || 0), 0);
  const costos_empresa = (geRes.data ?? []).reduce((s, g) => s + (Number(g.total) || 0), 0);
  const costos_viaticos = (rendRes.data ?? []).reduce((s, r) => s + (Number(r.total_facturado) || 0), 0);
  const costos = costos_empresa + costos_viaticos;
  const margen = ingresos - costos;
  const margen_pct = ingresos > 0 ? Math.round((margen / ingresos) * 100) : null;

  // Cobros de facturas en scope
  const factIds = facturas.map((f) => f.id);
  let cobrado = 0;
  if (factIds.length > 0) {
    const { data: cobrosData } = await supabase
      .from("cobros")
      .select("monto")
      .in("factura_id", factIds);
    cobrado = (cobrosData ?? []).reduce((s, c) => s + (Number(c.monto) || 0), 0);
  }

  return { ingresos, costos, margen, margen_pct, cobrado, por_cobrar: Math.max(0, ingresos - cobrado) };
}

// ─── Reembolsos (gastos en rendiciones ya registrados en gastos_empresa) ──────

/**
 * Suma valor_factura de gastos donde es_reembolso=true.
 * Representa el monto que empleados incluyeron en rendiciones pero que
 * ya estaba registrado en gastos_empresa (posible doble registro).
 */
export async function getTotalReembolsos(
  empresaId: string,
  anio?: number,
): Promise<number> {
  let q = supabase
    .from("gastos")
    .select("valor_factura")
    .eq("empresa_id", empresaId)
    .eq("es_reembolso", true)
    .is("deleted_at", null);
  if (anio) {
    const { gte, lte } = dateRange(anio);
    q = q.gte("fecha", gte).lte("fecha", lte);
  }
  const { data } = await q;
  return (data ?? []).reduce((s, g) => s + (Number(g.valor_factura) || 0), 0);
}
