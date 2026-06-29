# SUPABASE_AUDIT_RC0 — Auditoría Completa de Infraestructura Supabase

**Proyecto:** VIATIQ ERP  
**Empresa:** Nuclearpet S.A.S.  
**Fecha auditoría:** 2026-06-29  
**Proyecto Supabase:** `mpeztjykwwtagdelqsuc`  
**Rama:** `feature/reportes`  

---

## Metodología

| Fuente | Interpretación |
|--------|---------------|
| `src/types/database.ts` | Generado con `supabase gen types` desde la DB en vivo → **prueba de existencia** |
| `supabase/migrations/*.sql` | Cambios incrementales. Si el objeto **también aparece en `database.ts`**, la migración **ya fue ejecutada** |
| Código fuente (services/hooks) | Contratos que el frontend espera que existan |
| Sandbox sin red | No se pudo conectar al endpoint REST en tiempo real → columna **"Estado Real"** requiere verificación manual con las queries SQL al final de este documento |

### Convenciones

| Símbolo | Significado |
|---------|-------------|
| ✔ | Confirmado en `database.ts` (existe en DB cuando se generaron los tipos) |
| ❌ | No encontrado en `database.ts` ni en migraciones |
| ⚠ | Existe en migración pero no verificable en `database.ts` (triggers, índices, policies, funciones VOID) — requiere verificación manual |
| 🔴 | Pendiente crítico — el frontend lo necesita pero no hay evidencia de que exista |

---

## 1. Tablas

> Fuente: `src/types/database.ts` → sección `Tables`  
> Las 44 tablas están en `database.ts` → **confirmadas en DB**.  
> Ninguna tabla tiene migración `CREATE TABLE` en el repo (se crearon directamente en Supabase antes del primer commit de migraciones).

| # | Tabla | En DB (`database.ts`) | Migración SQL | Notas |
|---|-------|----------------------|---------------|-------|
| 1 | `acciones_aprobacion` | ✔ | — | Catálogo de acciones workflow |
| 2 | `adjuntos` | ✔ | — | Archivos adjuntos de rendiciones |
| 3 | `anticipos` | ✔ | — | Anticipos de viáticos |
| 4 | `aprobaciones` | ✔ | — | Registro de aprobaciones |
| 5 | `auditoria` | ✔ | — | Log de auditoría general |
| 6 | `auditorias_ia` | ✔ | — | Auditorías de extracción IA |
| 7 | `categorias_documento` | ✔ | — | Catálogo tipos documento |
| 8 | `categorias_gasto` | ✔ | — | Catálogo categorías de gasto |
| 9 | `centros_costo` | ✔ | — | Centros de costo |
| 10 | `clientes` | ✔ | — | Catálogo de clientes |
| 11 | `comentarios` | ✔ | — | Comentarios en rendiciones |
| 12 | `documentos` | ✔ | — | Documentos / comprobantes |
| 13 | `empresas` | ✔ | — | Empresas (tenant raíz) |
| 14 | `empresas_usuarios` | ✔ | — | Relación empresa-usuario |
| 15 | `estados_documento` | ✔ | — | Catálogo estados documento |
| 16 | `estados_gasto` | ✔ | — | Catálogo estados gasto |
| 17 | `estados_proyecto` | ✔ | — | Catálogo estados proyecto |
| 18 | `estados_rendicion` | ✔ | — | Catálogo estados rendición |
| 19 | `gastos` | ✔ | — | Gastos individuales |
| 20 | `historial_workflow` | ✔ | — | Historial de acciones workflow |
| 21 | `monedas` | ✔ | — | Catálogo de monedas |
| 22 | `niveles_riesgo_ia` | ✔ | — | Catálogo niveles de riesgo IA |
| 23 | `notificaciones` | ✔ | `20240628` + `20240629` | RLS habilitado en migración |
| 24 | `ocr_extracciones` | ✔ | `20240701` | RLS habilitado en migración |
| 25 | `origenes_gasto` | ✔ | — | Catálogo orígenes de gasto |
| 26 | `paises` | ✔ | — | Catálogo de países |
| 27 | `parametros_sistema` | ✔ | — | Parámetros configurables |
| 28 | `politicas` | ✔ | — | Políticas de viáticos |
| 29 | `presupuesto_detalle` | ✔ | — | Líneas de presupuesto |
| 30 | `presupuestos` | ✔ | — | Cabeceras de presupuesto |
| 31 | `proveedores` | ✔ | — | Catálogo de proveedores |
| 32 | `proyectos` | ✔ | — | Proyectos / viajes |
| 33 | `rendicion_tags` | ✔ | — | Relación rendición-tag |
| 34 | `rendiciones` | ✔ | — | Rendiciones de gastos |
| 35 | `roles` | ✔ | — | Roles de usuario |
| 36 | `sucursales` | ✔ | — | Sucursales de empresa |
| 37 | `tags` | ✔ | — | Etiquetas |
| 38 | `tipos_cambio` | ✔ | — | Tasas de cambio |
| 39 | `tipos_documento` | ✔ | — | Tipos de documento |
| 40 | `tipos_rendicion` | ✔ | — | Tipos de rendición |
| 41 | `usuarios` | ✔ | — | Perfil de usuarios |
| 42 | `viajes` | ✔ | — | Viajes (legacy/alias) |
| 43 | `workflow_pasos` | ✔ | — | Pasos de aprobación workflow |
| 44 | `workflows_aprobacion` | ✔ | — | Plantillas de workflow |

**Resultado: 44/44 tablas ✔**

---

## 2. Vistas BI

> Las 12 vistas están en `database.ts` → **confirmadas en DB**.  
> Las 7 vistas de reportes provienen de la migración `20240627000000_bi_reportes.sql`.  
> Las 5 vistas de dashboard **no tienen migración** (creadas directamente en Supabase).

| # | Vista | En DB (`database.ts`) | Migración SQL | Descripción |
|---|-------|----------------------|---------------|-------------|
| 1 | `vw_dashboard_clientes` | ✔ | — | KPIs clientes para dashboard |
| 2 | `vw_dashboard_ejecutivo` | ✔ | — | Métricas ejecutivas |
| 3 | `vw_dashboard_ia` | ✔ | — | Estadísticas IA/OCR |
| 4 | `vw_dashboard_proveedores` | ✔ | — | KPIs proveedores |
| 5 | `vw_dashboard_proyectos` | ✔ | — | KPIs proyectos |
| 6 | `vw_rpt_rendiciones_estado` | ✔ | `20240627` | Reporte rendiciones por estado |
| 7 | `vw_rpt_gastos_detalle` | ✔ | `20240627` | Detalle de gastos |
| 8 | `vw_rpt_viajes_detalle` | ✔ | `20240627` | Detalle de viajes |
| 9 | `vw_rpt_anticipos` | ✔ | `20240627` | Reporte anticipos |
| 10 | `vw_rpt_aprobaciones_eficiencia` | ✔ | `20240627` | Eficiencia de aprobaciones |
| 11 | `vw_rpt_ejecucion_presupuestaria` | ✔ | `20240627` | Ejecución presupuestaria |
| 12 | `vw_rpt_cumplimiento_politicas` | ✔ | `20240627` | Cumplimiento de políticas |

**Resultado: 12/12 vistas ✔**

---

## 3. Funciones RPC

> Las 12 funciones están en `database.ts` → **confirmadas en DB**.  
> Las funciones de tipo `TRIGGER RETURNS` y helpers internos (`_`) **no aparecen en `database.ts` por diseño** (PostgREST no las expone).

### 3a. Funciones RPC públicas (llamables desde frontend)

| # | Función | En DB (`database.ts`) | Migración SQL | Descripción |
|---|---------|----------------------|---------------|-------------|
| 1 | `generar_codigo` | ✔ | — | Genera códigos únicos |
| 2 | `mi_empresa_id` | ✔ | — | Retorna empresa_id del usuario actual |
| 3 | `wf_paso_actual` | ✔ | `20240626` | Paso actual de workflow |
| 4 | `wf_mis_pendientes` | ✔ | `20240626` | Rendiciones pendientes de aprobación |
| 5 | `wf_enviar_aprobacion` | ✔ | `20240626` | Envía rendición al flujo |
| 6 | `wf_registrar_accion` | ✔ | `20240626` | Registra acción de aprobación |
| 7 | `marcar_todas_notificaciones_leidas` | ✔ | `20240628` | Marca todas como leídas |
| 8 | `contar_notificaciones_no_leidas` | ✔ | `20240628` | Cuenta no leídas |
| 9 | `rpt_evolucion_mensual` | ✔ | `20240627` + `20240630` | Evolución mensual de gastos |
| 10 | `rpt_top_proveedores` | ✔ | `20240627` + `20240630` | Ranking top proveedores |
| 11 | `rpt_tiempos_workflow` | ✔ | `20240627` + `20240630` | Tiempos de aprobación |
| 12 | `rpt_resumen_ejecutivo` | ✔ | `20240627` + `20240630` | Resumen ejecutivo |

### 3b. Funciones internas (no en `database.ts` — requieren verificación manual)

| # | Función | Tipo | Migración SQL | Descripción |
|---|---------|------|---------------|-------------|
| 1 | `_bi_assert_empresa_member` | `VOID SECURITY DEFINER` | `20240630` | Guard de seguridad para RPCs BI |
| 2 | `_notif_insertar` | `VOID` | `20240629` | Helper interno de notificaciones |
| 3 | `trg_fn_notif_rendicion_estado` | `TRIGGER RETURNS` | `20240629` | Trigger notif. cambio estado rendición |
| 4 | `trg_fn_notif_comentario_nuevo` | `TRIGGER RETURNS` | `20240629` | Trigger notif. nuevo comentario |
| 5 | `trg_fn_notif_presupuesto_ejecucion` | `TRIGGER RETURNS` | `20240629` | Trigger notif. ejecución presupuestaria |
| 6 | `trg_fn_notif_gasto_politica` | `TRIGGER RETURNS` | `20240629` | Trigger notif. gasto fuera de política |
| 7 | `trg_fn_notif_ocr_extraccion` | `TRIGGER RETURNS` | `20240629` | Trigger notif. extracción OCR |
| 8 | `trg_fn_notif_usuario_nuevo` | `TRIGGER RETURNS` | `20240629` | Trigger notif. usuario nuevo |
| 9 | `trg_fn_notif_rol_cambio` | `TRIGGER RETURNS` | `20240629` | Trigger notif. cambio de rol |
| 10 | `trg_fn_notif_politica_cambio` | `TRIGGER RETURNS` | `20240629` | Trigger notif. cambio de política |

**Estado: ⚠ Requieren verificación con SQL — ver Sección 11**

---

## 4. Triggers

> No verificables desde `database.ts`. Requieren query directa a `pg_trigger`.

| # | Trigger | Tabla | Función | Migración SQL | Estado |
|---|---------|-------|---------|---------------|--------|
| 1 | `trg_notif_rendicion_estado` | `rendiciones` | `trg_fn_notif_rendicion_estado` | `20240629` | ⚠ Verificar |
| 2 | `trg_notif_comentario_nuevo` | `comentarios` | `trg_fn_notif_comentario_nuevo` | `20240629` | ⚠ Verificar |
| 3 | `trg_notif_presupuesto_ejecucion` | `presupuestos` | `trg_fn_notif_presupuesto_ejecucion` | `20240629` | ⚠ Verificar |
| 4 | `trg_notif_gasto_politica` | `gastos` | `trg_fn_notif_gasto_politica` | `20240629` | ⚠ Verificar |
| 5 | `trg_notif_ocr_extraccion` | `ocr_extracciones` | `trg_fn_notif_ocr_extraccion` | `20240629` | ⚠ Verificar |
| 6 | `trg_notif_usuario_nuevo` | `usuarios` | `trg_fn_notif_usuario_nuevo` | `20240629` | ⚠ Verificar |
| 7 | `trg_notif_rol_cambio` | `empresas_usuarios` | `trg_fn_notif_rol_cambio` | `20240629` | ⚠ Verificar |

> ⚠ **`trg_fn_notif_politica_cambio`** tiene función creada en migración pero **NO tiene `CREATE TRIGGER` correspondiente**. Posible omisión.

---

## 5. Políticas RLS

> Las políticas de `notificaciones` y `ocr_extracciones` tienen migración.  
> Las demás tablas no tienen migraciones de RLS en el repositorio — se desconoce si fueron configuradas directamente en Supabase.

### 5a. Políticas con migración en el repo

| # | Política | Tabla | Operación | Migración SQL | Estado |
|---|----------|-------|-----------|---------------|--------|
| 1 | `notificaciones_select_own` | `notificaciones` | SELECT | `20240628` | ⚠ Verificar |
| 2 | `notificaciones_update_own` | `notificaciones` | UPDATE | `20240628` | ⚠ Verificar |
| 3 | `notificaciones_delete_own` | `notificaciones` | DELETE | `20240628` | ⚠ Verificar |
| 4 | `storage_documentos_select` | `storage.objects` | SELECT | `20240701` | ⚠ Verificar |
| 5 | `storage_documentos_insert` | `storage.objects` | INSERT | `20240701` | ⚠ Verificar |
| 6 | `storage_documentos_update` | `storage.objects` | UPDATE | `20240701` | ⚠ Verificar |
| 7 | `storage_documentos_delete` | `storage.objects` | DELETE | `20240701` | ⚠ Verificar |
| 8 | `ocr_extracciones_select` | `ocr_extracciones` | SELECT | `20240701` | ⚠ Verificar |
| 9 | `ocr_extracciones_insert` | `ocr_extracciones` | INSERT | `20240701` | ⚠ Verificar |
| 10 | `ocr_extracciones_update` | `ocr_extracciones` | UPDATE | `20240701` | ⚠ Verificar |

### 5b. RLS en tablas críticas sin migración en el repo

> ⚠ **RIESGO ALTO**: Las siguientes tablas **deben** tener RLS habilitado para seguridad multi-tenant, pero no existe ninguna migración en el repo que lo haga explícitamente. Requieren verificación urgente.

| Tabla | RLS Requerido | Migración en repo | Acción |
|-------|--------------|-------------------|--------|
| `empresas` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `rendiciones` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `gastos` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `documentos` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `usuarios` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `empresas_usuarios` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `presupuestos` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `politicas` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `proyectos` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `proveedores` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `clientes` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `workflow_pasos` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `workflows_aprobacion` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `aprobaciones` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `historial_workflow` | Sí | ❌ Sin migración | Verificar en Supabase Dashboard |
| `notificaciones` | Sí | ✔ `20240628` | OK |
| `ocr_extracciones` | Sí | ✔ `20240701` | OK |

---

## 6. Índices

> Todos creados con `IF NOT EXISTS` — seguros de re-ejecutar.

| # | Índice | Tabla | Columnas | Migración SQL | Estado |
|---|--------|-------|----------|---------------|--------|
| 1 | `idx_gastos_fecha` | `gastos` | `fecha` | `20240627` | ⚠ Verificar |
| 2 | `idx_gastos_categoria_fecha` | `gastos` | `categoria_gasto_id, fecha` | `20240627` | ⚠ Verificar |
| 3 | `idx_gastos_proveedor` | `gastos` | `proveedor_id` | `20240627` | ⚠ Verificar |
| 4 | `idx_gastos_rendicion` | `gastos` | `rendicion_id` | `20240627` | ⚠ Verificar |
| 5 | `idx_rendiciones_estado` | `rendiciones` | `estado_rendicion_codigo` | `20240627` | ⚠ Verificar |
| 6 | `idx_rendiciones_fecha` | `rendiciones` | `fecha` | `20240627` | ⚠ Verificar |
| 7 | `idx_rendiciones_usuario` | `rendiciones` | `usuario_id` | `20240627` | ⚠ Verificar |
| 8 | `idx_rendiciones_proyecto` | `rendiciones` | `proyecto_id` | `20240627` | ⚠ Verificar |
| 9 | `idx_aprobaciones_usuario_fecha` | `aprobaciones` | `usuario_id, created_at` | `20240627` | ⚠ Verificar |
| 10 | `idx_aprobaciones_rendicion_fecha` | `aprobaciones` | `rendicion_id, created_at` | `20240627` | ⚠ Verificar |
| 11 | `idx_historial_rendicion_fecha` | `historial_workflow` | `rendicion_id, created_at` | `20240627` | ⚠ Verificar |
| 12 | `idx_auditorias_ia_score` | `auditorias_ia` | `confianza_score` | `20240627` | ⚠ Verificar |
| 13 | `idx_notificaciones_usuario_leida` | `notificaciones` | `usuario_id, leida` | `20240628` | ⚠ Verificar |
| 14 | `idx_notificaciones_empresa_created` | `notificaciones` | `empresa_id, created_at` | `20240628` | ⚠ Verificar |
| 15 | `idx_notificaciones_tipo` | `notificaciones` | `tipo` | `20240628` | ⚠ Verificar |
| 16 | `idx_ocr_extracciones_estado` | `ocr_extracciones` | `estado` | `20240701` | ⚠ Verificar |
| 17 | `idx_ocr_extracciones_proveedor` | `ocr_extracciones` | `proveedor_id` | `20240701` | ⚠ Verificar |

---

## 7. Storage Buckets

| # | Bucket | Público | Límite | MIME permitidos | Migración SQL | Estado |
|---|--------|---------|--------|-----------------|---------------|--------|
| 1 | `documentos` | No (privado) | 20 MB | `image/*, application/pdf, ...` | `20240701` | ⚠ Verificar |

> El bucket usa **signed URLs** — nunca URLs públicas directas. Correcto para documentos financieros.

---

## 8. Edge Functions

| # | Función | Archivo | Descripción | Desplegada | Secrets requeridos |
|---|---------|---------|-------------|------------|--------------------|
| 1 | `ai-document-extract` | `supabase/functions/ai-document-extract/index.ts` | Proxy seguro OpenAI para extracción IA | ⚠ Verificar | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` |

---

## 9. Secrets de Supabase

| # | Secret | Requerido por | Obligatorio | Estado |
|---|--------|--------------|-------------|--------|
| 1 | `OPENAI_API_KEY` | Edge Function `ai-document-extract` | Sí | ⚠ Verificar |
| 2 | `SUPABASE_URL` | Edge Function (auto-inyectado) | Sí — auto | ✔ Auto |
| 3 | `SUPABASE_ANON_KEY` | Edge Function (auto-inyectado) | Sí — auto | ✔ Auto |

> `SUPABASE_URL` y `SUPABASE_ANON_KEY` son **auto-inyectados** por Supabase en todas las Edge Functions. Solo `OPENAI_API_KEY` requiere configuración manual.

---

## 10. Variables de Entorno del Frontend (`.env`)

| # | Variable | Usada en | Estado actual |
|---|----------|----------|---------------|
| 1 | `VITE_SUPABASE_URL` | `src/integrations/supabase/client.ts` | ✔ En `.env` |
| 2 | `VITE_SUPABASE_PUBLISHABLE_KEY` | `src/integrations/supabase/client.ts` | ✔ En `.env` |
| 3 | `VITE_SUPABASE_PROJECT_ID` | Referencia interna | ✔ En `.env` |
| 4 | `VITE_OPENAI_API_KEY` | **No debe usarse en frontend** | ⚠ Advertencia — ver nota |

> ⚠ **SEGURIDAD**: `VITE_OPENAI_API_KEY` **NO debe configurarse ni usarse en el frontend**. Toda comunicación con OpenAI debe ir por la Edge Function `ai-document-extract`. Confirmar que esta variable no está en `.env` de producción.

---

## 11. Migraciones — Estado de Ejecución

> **Criterio de verificación:** Si los objetos creados por una migración están en `database.ts`, la migración **ya fue ejecutada**.

| Migración | Objetos creados | En `database.ts` | Estado estimado |
|-----------|----------------|------------------|-----------------|
| `20240626000000_workflow_rpcs.sql` | 4 RPCs workflow | ✔ Todos presentes | ✔ Ejecutada |
| `20240627000000_bi_reportes.sql` | 7 vistas + 4 RPCs + 12 índices | ✔ Todos presentes | ✔ Ejecutada |
| `20240628000000_notificaciones_infraestructura.sql` | 2 RPCs + tabla `notificaciones` cols + 3 índices + 3 policies RLS | ✔ Tabla y RPCs presentes | ✔ Ejecutada (probable) |
| `20240629000000_notificaciones_motor.sql` | 10 funciones trigger + 7 triggers | No verificable desde `database.ts` | ⚠ Pendiente verificación |
| `20240630000000_bi_security_hardening.sql` | `_bi_assert_empresa_member` + REVOKE/GRANT | No verificable desde `database.ts` | ⚠ Pendiente verificación |
| `20240701000000_ocr_infraestructura.sql` | bucket `documentos` + 4 policies Storage + 3 policies `ocr_extracciones` + 2 índices | `ocr_extracciones` en `database.ts` | ⚠ Pendiente verificación bucket/policies |

---

## 12. Hallazgos y Riesgos

### 🔴 Críticos

| # | Hallazgo | Riesgo | Acción requerida |
|---|----------|--------|-----------------|
| 1 | RLS de tablas core (`rendiciones`, `gastos`, `empresas`, etc.) **no tiene migración en el repo** | Si RLS no está habilitado, cualquier usuario autenticado puede leer datos de otras empresas | Verificar con SQL Sección 12 — si no existe, crear migración urgente |
| 2 | `OPENAI_API_KEY` aparece referenciada como `VITE_OPENAI_API_KEY` en el frontend | La API key quedaría expuesta en el bundle JS del cliente | Confirmar que esta variable NO se usa ni está configurada en producción |
| 3 | `trg_fn_notif_politica_cambio` tiene función creada pero **no tiene trigger** en las migraciones | Las notificaciones de cambio de política nunca dispararían | Crear `CREATE TRIGGER trg_notif_politica_cambio` |

### ⚠ Importantes

| # | Hallazgo | Riesgo | Acción requerida |
|---|----------|--------|-----------------|
| 4 | Las 5 vistas dashboard (`vw_dashboard_*`) no tienen migración en el repo | No se pueden reproducir en un entorno nuevo | Extraer DDL desde Supabase y crear migración |
| 5 | Las 2 funciones helper (`generar_codigo`, `mi_empresa_id`) no tienen migración | Ídem | Extraer DDL y crear migración |
| 6 | Las migraciones `20240629` y `20240630` no son verificables sin acceso directo a DB | No se sabe si los triggers y el security hardening están activos | Ejecutar queries de verificación (Sección 12) |
| 7 | Edge Function `ai-document-extract` puede no estar desplegada | La funcionalidad IA/OCR fallaría silenciosamente | Verificar con `supabase functions list` |
| 8 | Secret `OPENAI_API_KEY` puede no estar configurado | La Edge Function retornaría 502 | Verificar con `supabase secrets list` |

### ℹ Informativos

| # | Hallazgo |
|---|----------|
| 9 | `supabase/migrations/` contiene solo migraciones incrementales (no el schema base) — es el patrón correcto si el proyecto comenzó con Supabase Studio |
| 10 | `database.ts` estaba actualizado a la fecha del último commit analizado — refleja el estado real del proyecto |
| 11 | Las funciones trigger no aparecen en `database.ts` por diseño (PostgREST no las expone como RPC) |

---

## 12. Queries de Verificación

> Ejecutar en **Supabase Dashboard → SQL Editor** para completar la auditoría en tiempo real.

### 12a. Verificar RLS en todas las tablas

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### 12b. Verificar políticas RLS existentes

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY tablename, policyname;
```

### 12c. Verificar triggers

```sql
SELECT
  trigger_name,
  event_object_table AS table_name,
  event_manipulation AS event,
  action_timing AS timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

### 12d. Verificar funciones (incluyendo helpers y triggers)

```sql
SELECT
  routine_name,
  routine_type,
  data_type AS return_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

### 12e. Verificar índices

```sql
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;
```

### 12f. Verificar Storage bucket

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets;
```

### 12g. Verificar migraciones ejecutadas (tabla interna Supabase)

```sql
SELECT version, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY inserted_at DESC;
```

### 12h. Verificar Edge Functions desplegadas

```bash
# Desde terminal con Supabase CLI:
supabase functions list --project-ref mpeztjykwwtagdelqsuc

# Verificar secrets:
supabase secrets list --project-ref mpeztjykwwtagdelqsuc
```

---

## Resumen Ejecutivo

| Categoría | Total esperado | Confirmado ✔ | Requiere verificación ⚠ | Pendiente crítico 🔴 |
|-----------|---------------|-------------|------------------------|---------------------|
| Tablas | 44 | 44 | 0 | 0 |
| Vistas BI | 12 | 12 | 0 | 0 |
| Funciones RPC (públicas) | 12 | 12 | 0 | 0 |
| Funciones internas/trigger | 10 | 0 | 10 | 0 |
| Triggers | 7 | 0 | 6 | 1 (`trg_notif_politica_cambio` sin trigger) |
| Índices | 17 | 0 | 17 | 0 |
| Políticas RLS (con migración) | 10 | 0 | 10 | 0 |
| RLS tablas core (sin migración) | 15 | 0 | 0 | 15 |
| Storage buckets | 1 | 0 | 1 | 0 |
| Edge Functions | 1 | 0 | 1 | 0 |
| Secrets | 1 (manual) | 0 | 1 | 0 |
| Variables de entorno frontend | 3 | 3 | 0 | 0 |

### Prioridad de acción antes del despliegue

1. 🔴 **Verificar RLS en tablas core** — ejecutar query 12a y 12b
2. 🔴 **Verificar que `VITE_OPENAI_API_KEY` no esté en `.env` de producción**
3. 🔴 **Agregar trigger faltante** para `trg_fn_notif_politica_cambio`
4. ⚠ **Ejecutar migraciones pendientes** si las queries 12c/12d/12f muestran objetos faltantes
5. ⚠ **Desplegar Edge Function** `ai-document-extract` si no está activa
6. ⚠ **Configurar secret** `OPENAI_API_KEY` en Supabase
7. ⚠ **Crear migraciones para objetos sin DDL en repo** (vistas dashboard, funciones helper)

---

*Auditoría generada automáticamente desde el repositorio. Para verificación completa ejecutar las queries SQL de la Sección 12 en Supabase Dashboard.*
