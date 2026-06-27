# Autoauditoría FASE 8A — Infraestructura BI y Reportes
**Fecha:** 2026-06-26  
**Rama:** `feature/reportes`  
**Commit:** `44a88e3`  
**Verificación final:** `npx tsc --noEmit` → 0 errores · `npx eslint` (12 archivos) → 0 errores

---

## 1. Entregables creados

### Base de datos — `supabase/migrations/20240627000000_bi_reportes.sql` (602 líneas)

#### Vistas analíticas (7)

| Vista | Propósito | Joins principales |
|---|---|---|
| `vw_rpt_rendiciones_estado` | RPT-OPS-01: Estado de rendiciones | rendiciones + estados + tipos + proyectos + usuarios |
| `vw_rpt_gastos_detalle` | RPT-OPS-02: Detalle de gastos | gastos + rendiciones + proyectos + categorías + proveedores + estados |
| `vw_rpt_viajes_detalle` | RPT-OPS-03: Detalle de viajes | viajes + paises + rendiciones + proyectos + usuarios |
| `vw_rpt_anticipos` | RPT-OPS-04: Anticipos vs liquidaciones | anticipos + proyectos + rendiciones |
| `vw_rpt_aprobaciones_eficiencia` | RPT-WF-02/03: Eficiencia de aprobadores | aprobaciones + acciones + pasos + workflows + usuarios |
| `vw_rpt_ejecucion_presupuestaria` | RPT-FIN-01: Presupuesto vs ejecución | presupuestos + detalle + proyectos + categorías + gastos (GROUP BY) |
| `vw_rpt_cumplimiento_politicas` | RPT-AUD-04: Excedentes de política | gastos + rendiciones + usuarios + categorías + políticas (CASE tope) |

Todas las vistas son de solo lectura (`SELECT`). Ninguna tiene `INSERT`, `UPDATE` ni `DELETE`. Propietario `postgres`.

#### RPCs analíticas (4)

| RPC | Parámetros | Retorno | Seguridad |
|---|---|---|---|
| `rpt_evolucion_mensual` | `p_empresa_id, p_anio_desde, p_anio_hasta, p_categoria_id?` | `TABLE(anio, mes, label, facturado, reembolsable)` | SECURITY DEFINER + SET search_path |
| `rpt_top_proveedores` | `p_empresa_id, p_fecha_desde, p_fecha_hasta, p_limite?` | `TABLE(proveedor_id, nombre, pais, ciudad, n_gastos, total, pct_total, categoria_principal)` | SECURITY DEFINER + SET search_path |
| `rpt_tiempos_workflow` | `p_empresa_id, p_fecha_desde, p_fecha_hasta` | `TABLE(rendicion_id, ..., horas_espera_total, n_acciones, n_rechazos)` | SECURITY DEFINER + SET search_path |
| `rpt_resumen_ejecutivo` | `p_empresa_id, p_fecha_desde, p_fecha_hasta` | `JSONB` con `kpis` + `periodo` | SECURITY DEFINER + SET search_path |

#### Índices de rendimiento (12)

| Índice | Tabla | Columnas |
|---|---|---|
| `idx_gastos_fecha` | gastos | (empresa_id, fecha) |
| `idx_gastos_categoria_fecha` | gastos | (empresa_id, categoria_gasto_id, fecha) |
| `idx_gastos_proveedor` | gastos | (empresa_id, proveedor_id) |
| `idx_gastos_rendicion` | gastos | (rendicion_id) |
| `idx_rendiciones_estado` | rendiciones | (empresa_id, estado_rendicion_id) |
| `idx_rendiciones_fecha` | rendiciones | (empresa_id, fecha_rendicion) |
| `idx_rendiciones_usuario` | rendiciones | (empresa_id, usuario_id) |
| `idx_rendiciones_proyecto` | rendiciones | (empresa_id, proyecto_id) |
| `idx_aprobaciones_usuario_fecha` | aprobaciones | (empresa_id, usuario_id, fecha_accion) |
| `idx_aprobaciones_rendicion_fecha` | aprobaciones | (rendicion_id, fecha_accion) |
| `idx_historial_rendicion_fecha` | historial_workflow | (rendicion_id, created_at) |
| `idx_auditorias_ia_score` | auditorias_ia | (empresa_id, score) |

Todos con `CREATE INDEX IF NOT EXISTS` — idempotentes y seguros en re-deploy.

---

### Types — `src/types/database.ts` (2652 líneas, +216 vs FASE 7.1)

Se insertaron los tipos generados correspondientes a:
- 7 nuevas vistas en la sección `Views: { }` del schema `public`
- 4 nuevas RPCs en la sección `Functions: { }` del schema `public`

No se modificó ningún tipo existente.

**Incidencia detectada y resuelta:** El Edit tool truncó el archivo en 2430 líneas durante la inserción de los tipos RPC. Se detectó via `wc -l` / Python byte scan y se reconstruyó el contenido faltante con script Python. TSC validó la corrección (0 errores).

---

### Types — `src/types/reportes.ts` (374 líneas)

Tipos del módulo BI. Organizado en secciones:

| Sección | Contenido |
|---|---|
| Parámetros comunes | `FiltroFechas`, `FiltrosGlobales` |
| Operativos | `FiltroRendicionesEstado`, `RendicionEstadoRow`, `FiltroGastosDetalle`, `GastoDetalleRow`, `FiltroViajesDetalle`, `ViajeDetalleRow`, `FiltroAnticipos`, `AnticipoRow` |
| Financieros | `FiltroEjecucionPresupuestaria`, `EjecucionPresupuestariaRow`, `ParamsEvolucionMensual`, `EvolucionMensualRow` |
| Gerenciales | `ResumenEjecutivoKpis`, `ResumenEjecutivoResponse`, `ParamsResumenEjecutivo`, `ParamsTopProveedores`, `TopProveedorRow` |
| Auditoría | `FiltroCumplimientoPoliticas`, `CumplimientoPoliticaRow` |
| Workflow | `FiltroAprobacionesEficiencia`, `AprobacionEficienciaRow`, `ParamsTiemposWorkflow`, `TiempoWorkflowRow` |
| Exportación | `FormatoExportacion`, `OpcionesExportacion` |
| UI | `PaginacionReporte`, `EstadoReporte<T>` |

Sin `any`. Todos los campos nullables de vistas marcados `| null`.

---

### Services (5 archivos, read-only)

| Archivo | Líneas | Funciones exportadas |
|---|---|---|
| `reportes-operativos.ts` | 158 | `getRptRendicionesEstado`, `getRptGastosDetalle`, `getRptViajesDetalle`, `getRptAnticipos` |
| `reportes-financieros.ts` | 81 | `getRptEjecucionPresupuestaria`, `getRptEvolucionMensual` |
| `reportes-gerenciales.ts` | 72 | `getRptResumenEjecutivo`, `getRptTopProveedores` |
| `reportes-auditoria.ts` | 52 | `getRptCumplimientoPoliticas` |
| `reportes-workflow.ts` | 74 | `getRptAprobacionesEficiencia`, `getRptTiemposWorkflow` |

Restricciones verificadas: solo `.select()` y `.rpc()`. Sin `.insert()`, `.update()`, `.delete()`, `.upsert()`. Sin CRUD Factory.

---

### Hooks (5 archivos)

| Archivo | Líneas | Hooks exportados | staleTime |
|---|---|---|---|
| `use-reportes-operativos.ts` | 93 | `useRptRendicionesEstado`, `useRptGastosDetalle`, `useRptViajesDetalle`, `useRptAnticipos` | 5 min |
| `use-reportes-financieros.ts` | 49 | `useRptEjecucionPresupuestaria`, `useRptEvolucionMensual` | 30 min |
| `use-reportes-gerenciales.ts` | 47 | `useRptResumenEjecutivo`, `useRptTopProveedores` | 30 min |
| `use-reportes-auditoria.ts` | 29 | `useRptCumplimientoPoliticas` | 2 min |
| `use-reportes-workflow.ts` | 47 | `useRptAprobacionesEficiencia`, `useRptTiemposWorkflow` | 1 min |

staleTime según categoría de dato (diseño técnico FASE 8): operativos=5min, financieros/gerenciales=30min, auditoría=2min, workflow=1min.

---

## 2. Verificaciones de calidad

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errores |
| `npx eslint` (12 archivos nuevos) | ✅ 0 errores, 0 warnings |
| Archivos > 400 líneas | ✅ Ninguno (máximo: reportes.ts con 374) |
| `any` en archivos nuevos | ✅ 0 usos |
| INSERT/UPDATE/DELETE en services | ✅ 0 usos |
| CRUD Factory en services BI | ✅ No se usa |
| Modificación de services existentes | ✅ Ninguna |
| Modificación de hooks existentes | ✅ Ninguna |
| Modificación de componentes/contextos | ✅ Ninguna |
| SECURITY DEFINER en todas las RPCs | ✅ 4/4 |
| SET search_path = public en RPCs | ✅ 4/4 |
| CREATE INDEX IF NOT EXISTS | ✅ 12/12 |

---

## 3. Arquitectura verificada

```
Route (.tsx)          — no creado en esta fase (FASE 8B+)
  └── Hook (use-reportes-*.ts)
        └── Service (reportes-*.ts)
              └── supabase.from("vw_rpt_*") | supabase.rpc("rpt_*")
                    └── Supabase (vistas y RPCs del migration 20240627)
```

Ningún hook de reportes importa `supabase` directamente. Ningún service de reportes usa CRUD Factory.

---

## 4. Incidencias

| ID | Descripción | Resolución |
|---|---|---|
| INC-1 | Truncación de `database.ts` al insertar tipos RPC via Edit tool | Detectado con `wc -l` + Python byte scan. Reconstruido el contenido faltante (wf_mis_pendientes continuación + wf_enviar/registrar_accion + 4 RPCs BI + cierre del schema + utility types). TSC confirmó 0 errores. |
| INC-2 | Comentario con caracteres Unicode `─` (U+2500) en Views section | Reemplazado por comentario ASCII puro `// FASE 8A: RPCs analiticas BI` en el bloque Functions para evitar futuros riesgos de encoding en tsc. |

---

## 5. Lo que NO se implementó (intencional)

- UI / componentes de reporte
- Rutas `/reportes/*`
- Exportaciones PDF/XLSX
- Vistas materializadas (`mvw_*`) — planificadas para FASE 8H
- Filtros persistentes en localStorage — se implementan junto con la UI

---

## 6. Confirmación de readiness para FASE 8B

La infraestructura BI está lista. Las siguientes fases solo necesitan:

1. Crear `src/routes/reportes.tsx` (thin route, importa hooks BI)
2. Crear `src/components/reportes/*` (UI de cada reporte)
3. Importar hooks desde `use-reportes-*.ts` — ya disponibles, tipados, con staleTime correcto

**ERP + infraestructura BI estable para iniciar FASE 8B (UI de Reportes).** ✅
