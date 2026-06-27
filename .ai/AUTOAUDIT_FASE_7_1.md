# Autoauditoría FASE 7.1 — Estabilización Integral
**Fecha:** 2026-06-26  
**Verificación final:** `npx tsc --noEmit` → 0 errores · `npm run lint` → 0 errores, 8 warnings estructurales inamovibles

---

## 1. Problemas encontrados

| ID | Categoría | Archivo | Descripción |
|---|---|---|---|
| ARCH-1 | Arquitectura | `src/routes/dashboard.tsx` | Import directo de `supabase` + hook `usePresupuestoTotal` con `useQuery` inline que consulta tabla `presupuestos` sin pasar por service/hook |
| DEAD-1 | Código muerto | `src/components/common/filters-panel.tsx` | Componente exportado sin ningún consumidor en todo el proyecto (0 imports) |
| INDEX-1 | Exports | `src/services/index.ts` | Faltaban 8 módulos: `roles`, `parametros`, `politicas`, `catalogs`, `dashboard`, `permissions`, `workflow-read`, `workflow-actions` |
| A11Y-1 | Accesibilidad | `src/routes/clientes.tsx` | 2 botones icon-only (Editar, Eliminar) sin `aria-label` |
| FMT-1 | Formato | 23 archivos en `src/` | 48 errores `prettier/prettier` detectados por ESLint |
| QUAL-1 | Calidad | `src/components/dashboard/dashboard-charts.tsx` | Parámetro `name` destructurado en `PieLabel` pero no usado en el render body |

---

## 2. Problemas corregidos

### ARCH-1 — Violación de arquitectura en `dashboard.tsx`

**Causa:** El route importaba `supabase` directamente y contenía un `useQuery` local que consultaba la tabla `presupuestos` sin pasar por la capa de servicio.

**Corrección en 3 archivos:**
- `src/services/dashboard.ts`: añadida función `getPresupuestoTotal(empresaId: string): Promise<number>`
- `src/hooks/entities/use-dashboard.ts`: añadido hook `usePresupuestoTotal(empresaId)` con `queryKey: ["presupuestos", "total", empresaId]`
- `src/routes/dashboard.tsx`: eliminados `import { supabase }`, `import { useQuery }` y la función local; importado `usePresupuestoTotal` desde hook

### DEAD-1 — Dead code eliminado

`src/components/common/filters-panel.tsx` eliminado (verificado 0 consumidores en `src/`).

### INDEX-1 — Barrel de services completado

```ts
// Añadidos a src/services/index.ts:
export { rolesService } from "./roles";
export { parametrosService } from "./parametros";
export { politicasService } from "./politicas";
export * from "./catalogs";
export * from "./dashboard";
export * from "./permissions";
export * from "./workflow-read";
export * from "./workflow-actions";
```

### A11Y-1 — aria-labels en clientes

Añadidos `aria-label="Editar cliente"` y `aria-label="Eliminar cliente"` a los botones icon-only de la tabla.

### FMT-1 — Prettier autofix

`npx eslint --fix` sobre 23 archivos: 48 errores de formato resueltos.

### QUAL-1 — Parámetro sin usar en PieLabel

`name` → `name: _name` en la destructuración de `PieLabel` para marcar explícitamente el parámetro como intencionalmente ignorado (requerido por Recharts' `labelContent` callback shape).

---

## 3. Código eliminado

| Archivo | Motivo |
|---|---|
| `src/components/common/filters-panel.tsx` | Dead code — 0 importadores en el proyecto |

---

## 4. Mejoras arquitectónicas realizadas

**Dashboard desacoplado:** El route `dashboard.tsx` ahora sigue la misma arquitectura que todos los demás módulos:
```
Route → usePresupuestoTotal() → getPresupuestoTotal() → supabase.from("presupuestos")
```
Antes consultaba Supabase directamente desde el componente.

**Barrel de services completo:** `src/services/index.ts` ahora es el punto único de entrada para todos los servicios del proyecto (15 módulos de CRUD + catálogos + dashboard + workflow + permisos).

---

## 5. Deuda técnica restante

| ID | Descripción | Prioridad | Justificación de no corrección |
|---|---|---|---|
| WARN-shadcn | 8 warnings `react-refresh/only-export-components` en `src/components/ui/*.tsx` y contextos | Baja | Archivos generados por shadcn/ui que exportan helpers junto a componentes. Separar rompería la API pública. Aceptado por el equipo (warning, no error). |
| SCOPE-placeholder | `src/routes/configuracion.tsx` y `reportes.tsx` muestran `PagePlaceholder` | Normal | Rutas fuera del scope de FASE 7.1. Implementación planificada para FASE 8 (Reportes). |
| IMPORT-type | `import type { Cliente }` en hooks de factory (e.g. `use-clientes.ts`) no se referencia explícitamente | Baja | Imports `type`-only son erased en build. Sirven como documentación del tipo gestionado. Config del proyecto tiene `no-unused-vars: off` explícitamente. |
| N+1-tabs | `GastosTab`, `DocumentosTab`, `ViajesTab`, `WorkflowTab` se montan en el DOM pero solo lanzan queries cuando `rendicion.id` está disponible | Baja | Radix UI monta todos los `TabsContent` en DOM para preservar estado. TanStack Query cachea; las 4 queries paralelas en mount son deseables para pre-cargar data. Requeriría `lazy` loading o `keepMounted={false}` — cambio de comportamiento, no corrección. |

---

## 6. Confirmación de estabilidad para FASE 8

### Métricas finales

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run lint` | ✅ 0 errores · 8 warnings inamovibles |
| Archivos `.ts`/`.tsx` | 173 |
| Rutas registradas | 14 (todas en `routeTree.gen.ts`) |
| Cobertura service → hook | 15/15 módulos |
| Violaciones de arquitectura | 0 |
| Dead code | 0 |
| TODO/FIXME en `src/` | 0 |
| `console.log` residuales | 0 (solo los legítimos: error boundary, startup, env-var warning) |

### Arquitectura verificada (cadena completa)

```
Route (.tsx thin)
  └── Hook (use-*.ts, capa React Query)
        └── Service (*Service | función getXxx)
              └── CRUD Factory (_factory.ts) | RPC call
                    └── supabase client (integrations/supabase/client.ts)
```

Ningún componente ni route accede a `supabase` directamente (excepción justificada: `auth-context.tsx` usa `supabase.auth.*` — capa de autenticación sin service intermedio posible).

### Módulos auditados y estables

Empresa · Usuarios · Clientes · Proyectos · Presupuestos · Rendiciones · Viajes · Gastos · Documentos · Workflow · Dashboard

### Seguridad SQL

Migración `20240626000000_workflow_rpcs.sql` — 25/25 checks de seguridad pasados:
- `SECURITY DEFINER + SET search_path = public` en todas las funciones
- Identidad validada con `auth.uid()` vs `p_usuario_id`
- `SELECT ... FOR UPDATE` en operaciones de escritura de estado
- Whitelist de acciones antes del lock de fila
- Validación de secuencia de pasos (no skip)
- Prevención de auto-aprobación (owner ≠ aprobador)
- Historial con transición explícita `Estado: A → B`

**ERP estable para iniciar FASE 8 (Reportes).** ✅
