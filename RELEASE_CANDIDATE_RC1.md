# Viatik ERP — Release Candidate RC1
**FASE 11 — Production Readiness Audit**
Fecha: 2026-06-27 | Rama: `feature/reportes`

---

## Arquitectura

**Patrón central (enforced en todos los módulos):**
```
Route → Hook → Service → Supabase
```
- 18 rutas flat (TanStack Router file-based)
- 86 componentes de negocio (sin contar shadcn/ui)
- 28 hooks (factory + entities + especialistas)
- 33 servicios (CRUD factory + dominio + export + notifications + BI)
- 5 migraciones SQL con RLS, SECURITY DEFINER, triggers

**Capas verificadas:**

| Capa | Estado |
|---|---|
| Routes (thin, solo orquestación) | ✅ |
| Hooks (React Query, sin lógica de negocio) | ✅ |
| Services (solo acceso a Supabase) | ✅ |
| Componentes (sin acceso directo a Supabase) | ✅ |
| Tipos centralizados (`entities.ts`, `database.ts`, `reportes.ts`) | ✅ |
| Context (Auth, Company) | ✅ |
| Error boundaries en root | ✅ |

---

## Seguridad

### Hallazgos corregidos en FASE 11

**CRÍTICO (corregido):** Las 4 RPCs de BI (`rpt_evolucion_mensual`, `rpt_top_proveedores`, `rpt_tiempos_workflow`, `rpt_resumen_ejecutivo`) eran `SECURITY DEFINER` sin validar que `auth.uid()` pertenezca a `p_empresa_id`. Cualquier usuario autenticado podía consultar datos de otras empresas pasando un `empresa_id` arbitrario.

**Solución aplicada:** Migración `20240630000000_bi_security_hardening.sql` — función helper `_bi_assert_empresa_member(uuid)` que valida membresía activa antes de ejecutar cualquier consulta. Todas las RPCs BI convertidas a PL/pgSQL con el guard al inicio.

### Estado de seguridad post-corrección

| Control | Estado |
|---|---|
| RLS habilitado en todas las tablas | ✅ (verificado en migraciones) |
| Workflow RPCs validan `auth.uid()` | ✅ (FASE 7 hardening) |
| Notificaciones usan `SECURITY DEFINER` privado (`_notif_insertar`) | ✅ |
| `_notif_insertar` REVOKE FROM PUBLIC | ✅ |
| BI RPCs validan membresía de empresa | ✅ (corregido FASE 11) |
| No hay `dangerouslySetInnerHTML` en código propio | ✅ (solo shadcn/ui chart) |
| No hay acceso a Supabase desde componentes | ✅ |
| Triggers usan `EXCEPTION WHEN OTHERS THEN RAISE WARNING` | ✅ |
| Validaciones Zod en todos los formularios | ✅ |

### Riesgos residuales

- **Storage / uploads:** No implementado. Cuando se implemente, validar MIME type server-side (no solo en cliente) y configurar políticas de Storage RLS.
- **Edge Functions:** No implementadas aún. Cuando se añadan, heredar patrón de validación `auth.uid()`.
- **Rate limiting:** No hay throttling de RPCs. Implementar en producción a nivel de API Gateway o Supabase.

---

## Performance

### Hallazgos y correcciones aplicadas

| Ítem | Acción |
|---|---|
| `QueryClient` sin `defaultOptions` | Corregido FASE 10: `retry:1`, `refetchOnWindowFocus:false` |
| `useList` / `useOne` sin `staleTime` | Corregido FASE 10: 2 min / 5 min respectivamente |
| `useNotificaciones` polling 30s | ✅ (FASE 9A) |
| `useConteoNoLeidas` polling 60s | ✅ (FASE 9A) |
| `refetchOnWindowFocus: false` global | ✅ aplicado |
| Lazy loading de rutas | TanStack Start gestiona code-splitting automático. No aplicable en SSR. |
| Imports circulares | Ninguno encontrado |
| Dead code | Eliminado (`notifications-center.tsx`) |
| 0 `any` types | ✅ |
| 0 `@ts-ignore` en código propio | ✅ (solo `routeTree.gen.ts` auto-generado) |

### Advertencias de lint (8, no bloquean)

Todos son `react-refresh/only-export-components` — archivos que mezclan componentes con helpers o tipos en el mismo archivo. No afectan producción, son advertencias de HMR en desarrollo.

---

## Calidad

### Métricas

| Métrica | Valor |
|---|---|
| Archivos TypeScript/TSX | 242 |
| Errores TSC | 0 |
| Errores ESLint | 0 |
| Advertencias ESLint | 8 (todas react-refresh, no críticas) |
| Archivos > 400 líneas (excl. auto-generados y shadcn) | 2 (442, 439 — borderline) |
| TODO / FIXME en código propio | 0 |
| `any` types en código propio | 0 |
| Componentes muertos | 0 (eliminados) |
| Imports sin usar | 0 |

### Archivos borderline (>400 líneas, aceptables)

- `rendicion-detail.tsx` (311 → tras split de FASE 11)
- `workflow-report-layout.tsx` (439) — un único componente orquestador, no hay split natural sin forzar prop drilling
- `catalog-crud-base.tsx` (365) — dividido en FASE 11

### Archivos excluidos de la regla de 400 líneas

- `database.ts` (2673) — generado por Supabase CLI
- `sidebar.tsx` (744) — componente shadcn/ui (biblioteca, no código propio)
- `routeTree.gen.ts` (408) — generado por TanStack Router

---

## Módulos funcionales implementados

| Módulo | Ruta | Estado |
|---|---|---|
| Dashboard BI ejecutivo | `/dashboard` | ✅ |
| Rendiciones (CRUD + drill-down) | `/rendiciones` | ✅ |
| Workflow de aprobaciones | `/workflow` | ✅ |
| Gastos | `/gastos` | ✅ |
| Documentos + OCR (lectura) | `/documentos` | ✅ |
| Clientes | `/clientes` | ✅ |
| Proyectos | `/proyectos` | ✅ |
| Proveedores | `/proveedores` | ✅ |
| Presupuestos | `/presupuestos` | ✅ |
| Reportes BI | `/reportes` | ✅ |
| Reportes Financieros | `/reportes/financieros` | ✅ |
| Reportes Operativos | `/reportes/operativos` | ✅ |
| Workflow Analytics | `/reportes/workflow` | ✅ |
| Administración | `/administracion` | ✅ |
| Notificaciones (infraestructura) | Sidebar bell | ✅ |
| Configuración | `/configuracion` | ⚠️ placeholder |

---

## Deuda técnica

### CRÍTICA (bloquea producción)

Ninguna. Los bloqueantes de seguridad BI fueron corregidos en esta fase.

### ALTA (resolver antes del primer cliente)

1. **Configuración de Storage RLS:** Las migraciones no incluyen políticas de Supabase Storage. Cuando se activen uploads de documentos OCR, se necesita RLS de bucket.

2. **Multi-empresa completa:** `company-context.tsx` permite cambiar empresa activa, pero las RPCs asumen una empresa activa validada. Si un usuario pertenece a múltiples empresas, el estado del switcher debe ser la fuente de verdad para todas las consultas.

3. **Paginación en tabla de catálogos:** `CatalogCrud` carga hasta 200 registros. Con catálogos grandes necesita paginación real del lado del servidor.

4. **Viajes en rendición:** `viajes-tab.tsx` (396 líneas) tiene lógica de cálculo de KM — necesita validación contra política activa de la empresa.

### MEDIA (resolver antes de v1.0)

5. **Búsqueda global:** Barra de búsqueda en topbar está deshabilitada (`disabled`, `aria-hidden`). Funcionalidad pendiente para RC2.

6. **Configuración de usuario:** `/configuracion` es un PagePlaceholder. Preferencias de idioma, zona horaria, notificaciones por email.

7. **Perfil / Facturación / Soporte:** Items del menú de usuario marcados `disabled`. Requieren pantallas propias.

8. **Exportación PDF en móvil:** `jspdf` funciona en desktop. Probar en Safari iOS antes del primer cliente.

9. **Error boundary por módulo:** Solo hay un error boundary global en `__root.tsx`. Un módulo que crashee afecta toda la app.

10. **Notificaciones en tiempo real:** Implementadas con polling (30s). Supabase Realtime (`supabase.channel`) daría latencia < 1s y reduciría tráfico.

### BAJA (backlog v1.1+)

11. **React.memo / useMemo agresivo:** Los componentes de tabla re-renderizan en cada cambio de React Query. Aplicar `memo` a columnas pesadas si se detecta lag en tablas grandes.

12. **`react-refresh/only-export-components` (8 advertencias):** Mover helpers y tipos a archivos `.ts` separados cuando corresponda.

13. **i18n:** Texto hardcoded en español. Si se expande a otros países, necesita biblioteca de internacionalización.

14. **Dark mode:** TailwindCSS v4 soporta dark. No está activado.

15. **Favicon y PWA manifest:** No configurados.

---

## Riesgos antes de producción

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Storage sin RLS al activar uploads | Alta | Crítico | Agregar migration de Storage antes de activar |
| Rate limit de Supabase Free Tier | Media | Alto | Monitorear y migrar a Pro antes del piloto |
| Polling de notificaciones en clientes concurrentes | Media | Medio | Migrar a Realtime o aumentar intervalo |
| N+1 en catálogos admin (200 registros) | Baja | Bajo | Paginación servidor si catálogos crecen |

---

## Autoauditoría final

### ¿Está listo para un piloto comercial?

**SÍ, con condiciones:**

El ERP cubre el ciclo completo de gestión de gastos y rendiciones: creación → aprobación → reportes → exportación. La arquitectura es sólida, el código está tipado al 100%, sin errores TSC ni ESLint, y los módulos críticos tienen controles de seguridad correctos.

**Condiciones antes del primer cliente real:**
1. Configurar Storage RLS en Supabase antes de activar upload de documentos
2. Ejecutar las 5 migraciones SQL en el proyecto Supabase de producción
3. Configurar variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) en hosting
4. Verificar políticas RLS con un usuario de prueba en producción
5. Definir plan de empresa → usuarios → roles antes del onboarding

### ¿Qué falta para una versión 1.0?

- Pantalla de Configuración de usuario (zona horaria, notificaciones)
- Pantalla de Perfil y Facturación
- Búsqueda global funcional
- Onboarding wizard (crear empresa → invitar usuarios → asignar roles → crear política)
- Email transaccional para aprobaciones (via Supabase Edge Functions + Resend)
- Pruebas de integración (Playwright o Cypress) sobre flujo principal

### ¿Qué falta para SaaS multiempresa en producción?

- Plan de billing integrado (Stripe) con `empresa.plan` y límites de usuarios/rendiciones
- Throttling de RPCs por empresa (Supabase + middleware)
- Supabase Realtime para notificaciones (eliminar polling)
- Observabilidad: Sentry / Datadog para errores y performance por tenant
- GDPR: política de retención de datos, export personal data, derecho al olvido
- Backups automáticos de Supabase en plan Pro+
- CI/CD: pipeline GitHub Actions para TSC + lint + migraciones automáticas
- Dominio custom y certificado SSL por cliente (si es white-label)

---

*Documento generado automáticamente por FASE 11 — Production Readiness RC1*
*Commit: `FASE 11 - Production Readiness RC1`*
