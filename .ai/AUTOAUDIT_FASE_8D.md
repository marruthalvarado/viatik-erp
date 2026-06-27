# AUTOAUDIT — FASE 8D: Reportes Operativos

**Fecha:** 2026-06-26
**Branch:** feature/reportes
**Commit previo:** a13032a (feat(reportes): FASE 8C — Reportes Financieros)

---

## 1. Archivos creados

| Archivo | Lineas | Descripcion |
|---|---|---|
| `src/routes/reportes.operativos.tsx` | 16 | Thin route `/reportes/operativos` |
| `src/components/reportes-operativos/operational-filter-types.ts` | 44 | Tipos + helpers localStorage (sin JSX) |
| `src/components/reportes-operativos/operational-filters.tsx` | 146 | UI de filtros: ano, mes desde/hasta, reset |
| `src/components/reportes-operativos/reporte-viajes.tsx` | 166 | KPIs + tabla 9 columnas |
| `src/components/reportes-operativos/reporte-rendiciones.tsx` | 220 | KPIs + barra distribucion + tabla |
| `src/components/reportes-operativos/reporte-clientes.tsx` | 218 | BarChart ranking + tabla agregada por proyecto |
| `src/components/reportes-operativos/reporte-proyectos-op.tsx` | 198 | Tabla presupuesto/ejecutado/variacion + rendiciones + viajes |
| `src/components/reportes-operativos/reporte-proveedores.tsx` | 181 | KPIs + BarChart + tabla ranking |
| `src/components/reportes-operativos/reportes-operativos-layout.tsx` | 234 | Orquestador: estado, hooks, tabs |

**Archivos modificados:**

| Archivo | Cambio |
|---|---|
| `src/routeTree.gen.ts` | Registro de `/reportes/operativos` en 7 ubicaciones |
| `src/components/layout/app-sidebar.tsx` | Agregado "Rpt. Operativos" (Activity icon) en seccion Finanzas |

**Ningun archivo supera 400 lineas.** Maximo: reportes-operativos-layout.tsx 234.

---

## 2. Reportes implementados (5)

### Tab 1 — Viajes
- KPIs: Total viajes, Con vehiculo propio, Duracion promedio
- Tabla: Numero, Fecha salida, Fecha regreso, Empleado, Proyecto, Destino/Pais, Vehiculo (Propio/Corporativo), Duracion, Rendicion
- Pie de tabla con conteo de viajes propios vs corporativos

### Tab 2 — Rendiciones
- KPIs: Total rendiciones, Aprobadas (con %), Pendientes/En revision, Rechazadas
- Barra de distribucion visual por estado (verde/ambar/rojo) con leyenda
- Tabla: Numero, Responsable, Proyecto, Estado (StatusBadge), Fecha, Dias en estado, Gasto total
- Fila tfoot con promedio de dias y total facturado

### Tab 3 — Clientes
- Nota informativa: datos agrupados por proyecto (campo cliente_nombre no disponible en 8A)
- BarChart horizontal top 10 proyectos por gasto
- Tabla con ranking: #, Proyecto, Viajes, Gasto total, Presupuesto, Ejecutado, % del total
- Fila tfoot con totales

### Tab 4 — Proyectos
- Tabla: Proyecto, Presupuesto, Ejecutado, Variacion (coloreada), % Ejecucion (StatusBadge), Rendiciones, Viajes
- Umbral: >100% = danger, >90% = warning, else = success
- Fila tfoot con totales y sumas de rendiciones/viajes
- Merge de 3 hooks: ejecucion + rendiciones + viajes

### Tab 5 — Proveedores
- KPIs: Total proveedores, Total compras, Mayor proveedor (con % del total)
- BarChart horizontal top 10 por gasto (fill: chart-3)
- Tabla ranking: #, Proveedor, Pais/Ciudad, # Compras, Gasto total, % del total, Categoria principal
- Fila tfoot con totales

---

## 3. Filtros globales

- Selectores: Ano, Mes Desde, Mes Hasta
- Persistencia: `localStorage` bajo `viatik:filtros:operativos`
- `loadFiltrosOperativos()` / `saveFiltrosOperativos()` en archivo `.ts` (react-refresh)
- Boton reset con `RotateCcw`, `aria-label="Restablecer filtros operativos"`

---

## 4. Navegacion

- Sidebar: nueva entrada "Rpt. Operativos" (Activity icon) en seccion Finanzas
- Breadcrumb en layout: Reportes (link `/reportes`) > Operativos

---

## 5. Arquitectura — verificacion

- **Ningun componente accede Supabase directamente** (grep confirm: 0 matches)
- Hooks consumidos (todos 8A):
  - `useRptViajesDetalle` (operativos, staleTime 5min) — Viajes + Clientes + Proyectos
  - `useRptRendicionesEstado` (operativos, staleTime 5min) — Rendiciones + Proyectos
  - `useRptGastosDetalle` (operativos, staleTime 5min) — Clientes
  - `useRptEjecucionPresupuestaria` (financieros, staleTime 30min) — Clientes + Proyectos
  - `useRptTopProveedores` (gerenciales, staleTime 30min) — Proveedores
- Flujo: Route -> ReportesOperativosLayout -> Hooks 8A -> Services 8A -> Supabase

---

## 6. Accesibilidad

- Todos los botones con `aria-label`
- TabsTrigger con `aria-label` explicativos
- Selectores con `aria-label`
- Barra de distribucion de rendiciones con `title` por segmento

---

## 7. Estados UI

Todos los 5 reportes manejan:
- `loading` → `<LoadingState />`
- `error` → `<EmptyState />` con boton "Reintentar" + `aria-label`
- `empty` → `<EmptyState />` con icono contextual
- `data` → tabla/grafico

---

## 8. Incidentes

- **INC-1 — Truncacion app-sidebar.tsx:** Al agregar import `Activity`, Edit tool trunco el archivo en linea 118. Fix: Python reconstruyo las ultimas 5 lineas de cierre JSX.
- **INC-2 — Truncacion routeTree.gen.ts:** rootRouteChildren block truncado. Fix: Python reconstruyo el bloque completo desde linea 361.
- **INC-3 — StatusBadge tones incorrectos:** Usé "destructive"/"default" en lugar de "danger"/"neutral". Fix: Corregidos en reporte-rendiciones.tsx y reporte-proyectos-op.tsx.
- **INC-4 — Null bytes en 2 archivos:** reporte-proyectos-op.tsx y reporte-rendiciones.tsx. Fix: `data.rstrip(b'\x00').rstrip() + b'\n'`.

---

## 9. Resultados de calidad

```
npx tsc --noEmit     → 0 errores
npx eslint --fix     → 0 errores, 8 warnings (todos pre-existentes en ui/ y contexts/)
```

---

*FASE 8D completada. Modulo Reportes Operativos operativo en `/reportes/operativos`.*
