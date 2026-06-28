# DEPLOY — VIATIQ

Guía completa de despliegue en producción.  
Stack: **React + TanStack Start · Supabase · Vercel**

---

## Índice de contenido

1. [Requisitos previos](#1-requisitos-previos)
2. [Variables de entorno](#2-variables-de-entorno)
3. [Supabase — Configuración inicial](#3-supabase--configuración-inicial)
4. [Supabase — Migraciones SQL](#4-supabase--migraciones-sql)
5. [Supabase — Storage Bucket](#5-supabase--storage-bucket)
6. [Supabase — Edge Functions](#6-supabase--edge-functions)
7. [Supabase — Secrets](#7-supabase--secrets)
8. [Despliegue en Vercel](#8-despliegue-en-vercel)
9. [Orden correcto de instalación](#9-orden-correcto-de-instalación)
10. [Verificaciones post-despliegue](#10-verificaciones-post-despliegue)
11. [Checklist final](#11-checklist-final)

---

## 1. Requisitos previos

| Herramienta | Versión mínima | Instalación |
|---|---|---|
| Node.js | 22.x | https://nodejs.org |
| npm | 10.x | incluido con Node |
| Supabase CLI | última | `npm install -g supabase` |
| Git | cualquiera | https://git-scm.com |
| Cuenta Vercel | — | https://vercel.com |
| Cuenta Supabase | — | https://supabase.com |
| Cuenta OpenAI | — | https://platform.openai.com (para IA OCR) |

---

## 2. Variables de entorno

### Variables requeridas (frontend)

Solo estas dos variables son necesarias para el frontend. No hay más.

```env
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<tu-clave-anon>
```

**Dónde obtenerlas:**
- Supabase Dashboard → tu proyecto → Settings → API
- `VITE_SUPABASE_URL` = Project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` = `anon` public key (también llamada `SUPABASE_ANON_KEY`)

### Variables NO necesarias

| Variable | Estado | Motivo |
|---|---|---|
| `VITE_OPENAI_API_KEY` | **No configurar** | Reemplazada por Edge Function proxy. La API key de OpenAI vive como Supabase Secret en el servidor, nunca en el frontend. |
| `VITE_SUPABASE_PROJECT_ID` | Opcional | Solo útil en scripts locales de admin. |

### Archivo `.env` local (desarrollo)

```env
# .env (en .gitignore — no commitear)
VITE_SUPABASE_URL=https://mpeztjykwwtagdelqsuc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tPW47xwDYy_VDm_1y2YAYA_DadK10lw
```

---

## 3. Supabase — Configuración inicial

### 3.1 Crear proyecto

1. Ir a https://supabase.com/dashboard
2. New Project → elegir organización
3. Nombre: `viatik-erp` (o el que prefieras)
4. Región: la más cercana a tus usuarios (ej: `South America (São Paulo)`)
5. Base de datos password: guardar en lugar seguro
6. Plan: Free (MVP) o Pro (producción)

### 3.2 Obtener credenciales

En Settings → API copiar:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_PUBLISHABLE_KEY`

### 3.3 Configurar Supabase CLI

```bash
supabase login
supabase link --project-ref <project-id>
# Donde <project-id> es el ID del proyecto (ej: mpeztjykwwtagdelqsuc)
```

---

## 4. Supabase — Migraciones SQL

Las migraciones están en `supabase/migrations/`. **Deben ejecutarse en orden estrictamente.**

Las primeras migraciones (esquema base con todas las tablas del ERP) fueron creadas directamente en el Supabase Dashboard y NO están en este repositorio. Estas se aplican sobre un schema base ya existente.

### 4.1 Tablas base del ERP (schema pre-existente)

Las siguientes tablas deben existir **antes** de aplicar las migraciones del repositorio:

```
empresas                  clientes                  proyectos
empresas_usuarios         presupuestos              proveedores
roles                     gastos                    rendiciones
parametros_sistema        documentos                politicas
politicas_empresa         categorias_gasto          estados_gasto
origenes_gasto            estados_rendicion         tipos_rendicion
monedas                   categorias_documento      tipos_documento
ocr_extracciones          notificaciones
workflows_aprobacion      workflow_pasos
aprobaciones              historial_workflow
acciones_aprobacion       comentarios
```

> **Nota:** Si partes de un proyecto Supabase nuevo (sin schema base), aplica primero el dump del schema original antes de ejecutar las migraciones del repositorio.

### 4.2 Migraciones del repositorio (en orden)

Ejecutar desde el Supabase Dashboard → SQL Editor, o via CLI:

```bash
supabase db push
# O manualmente, una a una:
```

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `20240626000000_workflow_rpcs.sql` | RPCs de workflow (wf_*), seed de estados y acciones de aprobación |
| 2 | `20240627000000_bi_reportes.sql` | 7 vistas SQL analíticas (vw_rpt_*), 4 RPCs de reportes (rpt_*), 12 índices |
| 3 | `20240628000000_notificaciones_infraestructura.sql` | Extiende tabla `notificaciones` con tipo, prioridad, url_destino; RPC `marcar_todas_notificaciones_leidas` |
| 4 | `20240629000000_notificaciones_motor.sql` | 9 triggers automáticos de notificaciones (workflow, presupuesto, política, OCR) |
| 5 | `20240630000000_bi_security_hardening.sql` | Hardening de seguridad: agrega guard de membresía a las 4 RPCs de BI |
| 6 | `20240701000000_ocr_infraestructura.sql` | Storage bucket `documentos`, RLS de storage, columnas OCR en `ocr_extracciones` |

#### Ejecutar via CLI

```bash
# Aplicar todas las migraciones pendientes:
supabase db push

# O aplicar una a una en el SQL Editor del Dashboard:
# Dashboard → SQL Editor → pegar contenido del archivo → Run
```

### 4.3 RPCs creadas

```sql
-- Workflow
wf_paso_actual(p_rendicion_id uuid)
wf_enviar_aprobacion(p_rendicion_id, p_workflow_id, p_usuario_id)
wf_registrar_accion(p_workflow_paso_id, p_accion_codigo, p_usuario_id, p_comentario)
wf_mis_pendientes()

-- Reportes BI
rpt_resumen_ejecutivo(p_empresa_id, p_fecha_desde, p_fecha_hasta)
rpt_evolucion_mensual(p_empresa_id, p_fecha_desde, p_fecha_hasta)
rpt_top_proveedores(p_empresa_id, p_fecha_desde, p_fecha_hasta, p_limit)
rpt_tiempos_workflow(p_empresa_id, p_fecha_desde, p_fecha_hasta)

-- Notificaciones
marcar_todas_notificaciones_leidas(p_empresa_id)
contar_notificaciones_no_leidas(p_empresa_id)
```

### 4.4 Vistas SQL

```sql
vw_rpt_gastos_detalle
vw_rpt_rendiciones_estado
vw_rpt_ejecucion_presupuestaria
vw_rpt_anticipos
vw_rpt_viajes_detalle
vw_rpt_cumplimiento_politicas
vw_rpt_aprobaciones_eficiencia
```

---

## 5. Supabase — Storage Bucket

El bucket `documentos` se crea automáticamente al ejecutar la migración `20240701000000_ocr_infraestructura.sql`.

### Configuración del bucket

| Parámetro | Valor |
|---|---|
| Nombre | `documentos` |
| Acceso | Privado (no público) |
| Límite por archivo | 20 MB |
| MIME types permitidos | `image/jpeg`, `image/png`, `application/pdf` |
| Estructura de paths | `{empresa_id}/{rendicion_id}/{documento_id}_{nombre_archivo}` |

### RLS del bucket

Las 4 políticas RLS (SELECT, INSERT, UPDATE, DELETE) validan que el `empresa_id` del path del archivo corresponda a una empresa a la que pertenece el usuario autenticado.

### Verificación manual (Dashboard)

Storage → Buckets → verificar que existe `documentos` con `Public`: Off.

---

## 6. Supabase — Edge Functions

### Función: `ai-document-extract`

**Propósito:** Proxy seguro entre el frontend y la API de OpenAI. La `OPENAI_API_KEY` nunca se expone en el bundle del cliente.

**Flujo:** `Frontend → supabase.functions.invoke() → Edge Function → OpenAI → respuesta`

#### Desplegar

```bash
# Desde la raíz del proyecto:
supabase functions deploy ai-document-extract

# Verificar:
supabase functions list
```

#### Código fuente

```
supabase/functions/ai-document-extract/index.ts
```

#### Variables de entorno que usa (automáticas de Supabase)

- `SUPABASE_URL` — inyectada automáticamente por Supabase
- `SUPABASE_ANON_KEY` — inyectada automáticamente por Supabase
- `OPENAI_API_KEY` — debe configurarse como Secret (ver sección 7)

#### Endpoints

| Método | Path | Auth | Descripción |
|---|---|---|---|
| POST | `/functions/v1/ai-document-extract` | Bearer JWT | Extrae datos de gasto desde texto OCR |

#### Body de la request

```json
{
  "text": "Texto extraído por OCR del documento...",
  "context": {
    "pais": "Ecuador",
    "monedaPredeterminada": "USD",
    "categoriasDisponibles": ["Alimentación", "Transporte", ...],
    "nombreArchivo": "factura.jpg"
  }
}
```

#### Errores manejados

| Status | Causa |
|---|---|
| 401 | Token JWT inválido o expirado |
| 400 | Texto demasiado corto (< 20 chars) |
| 429 | Rate limit de OpenAI |
| 500 | `OPENAI_API_KEY` no configurada en el servidor |
| 502 | Error de red o respuesta inválida de OpenAI |

---

## 7. Supabase — Secrets

Los secrets son variables de entorno del lado del servidor, accesibles solo por las Edge Functions.

```bash
# Configurar la API key de OpenAI (OBLIGATORIO para el módulo IA):
supabase secrets set OPENAI_API_KEY=sk-proj-...

# Verificar que se guardó:
supabase secrets list
```

> **Seguridad:** Esta key NUNCA debe ir en `.env`, en Vercel, ni en ningún lugar accesible al cliente.

---

## 8. Despliegue en Vercel

### 8.1 Conectar repositorio

1. Ir a https://vercel.com/new
2. Import Git Repository → seleccionar `feature/reportes` (o `main` cuando se mergee)
3. Framework Preset: **Vite** (o dejarlo en Auto-detect)

### 8.2 Configuración de build

| Campo | Valor |
|---|---|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node.js Version | 22.x |

> **Nota sobre TanStack Start:** El proyecto usa TanStack Start con Nitro. Si Vercel detecta SSR, puede usar el preset automático. Si el build falla por el preset de Cloudflare (default de Nitro), agregar la variable de entorno `NITRO_PRESET=vercel` en Vercel.

### 8.3 Variables de entorno en Vercel

En Vercel → tu proyecto → Settings → Environment Variables:

```
VITE_SUPABASE_URL          = https://mpeztjykwwtagdelqsuc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = sb_publishable_...
```

Aplicar a: **Production**, **Preview**, **Development**.

### 8.4 Dominio y redirecciones

Si se usa dominio personalizado, agregar en Supabase:
- Authentication → URL Configuration → Site URL: `https://tu-dominio.com`
- Redirect URLs: `https://tu-dominio.com/**`

### 8.5 Redeploy

Cada push a `feature/reportes` (o `main`) desplegará automáticamente.  
Para forzar un redeploy manual: Vercel Dashboard → Deployments → Redeploy.

---

## 9. Orden correcto de instalación

Seguir este orden exacto para evitar errores de dependencias:

```
1. Crear proyecto Supabase
   └── Obtener URL y ANON_KEY

2. Aplicar schema base del ERP (tablas pre-existentes)
   └── Si es proyecto nuevo: restaurar dump del schema original

3. Aplicar migraciones del repositorio (en orden)
   ├── 20240626000000_workflow_rpcs.sql
   ├── 20240627000000_bi_reportes.sql
   ├── 20240628000000_notificaciones_infraestructura.sql
   ├── 20240629000000_notificaciones_motor.sql
   ├── 20240630000000_bi_security_hardening.sql
   └── 20240701000000_ocr_infraestructura.sql
       └── (crea bucket 'documentos' automáticamente)

4. Configurar Secret de OpenAI
   └── supabase secrets set OPENAI_API_KEY=sk-...

5. Desplegar Edge Function
   └── supabase functions deploy ai-document-extract

6. Configurar variables de entorno en Vercel
   ├── VITE_SUPABASE_URL
   └── VITE_SUPABASE_PUBLISHABLE_KEY

7. Conectar repositorio a Vercel y hacer deploy
   └── npm run build → Output: dist/

8. Configurar dominio y redirect URLs en Supabase Auth
```

---

## 10. Verificaciones post-despliegue

Verificar cada módulo después del deploy:

### Auth / Login

- [ ] El formulario de login carga correctamente
- [ ] Login con email/password funciona
- [ ] Al login redirige al dashboard
- [ ] Logout borra la sesión correctamente
- [ ] Refresh de página no pierde la sesión

### Dashboard

- [ ] Carga KPIs (gastos totales, rendiciones activas, tasa aprobación)
- [ ] Gráfico de evolución mensual aparece con datos
- [ ] Ranking de proveedores carga
- [ ] Filtro por empresa funciona

### Módulos CRUD

- [ ] Clientes: listar, crear, editar, eliminar
- [ ] Proveedores: listar, crear, editar, eliminar
- [ ] Proyectos: listar, crear, editar, eliminar
- [ ] Presupuestos: listar, crear, editar, eliminar
- [ ] Gastos: listar, crear, editar, eliminar
- [ ] Rendiciones: listar, crear, drill-down de detalle

### Workflow de aprobaciones

- [ ] Enviar rendición a aprobación
- [ ] Bandeja de aprobaciones muestra pendientes
- [ ] Aprobar rendición actualiza estado
- [ ] Rechazar con comentario funciona
- [ ] Historial de workflow visible en detalle de rendición
- [ ] Notificación generada al aprobar/rechazar

### Reportes BI

- [ ] Dashboard ejecutivo carga (/reportes)
- [ ] Reportes financieros carga (/reportes/financieros)
- [ ] Reportes operativos carga (/reportes/operativos)
- [ ] Reportes de workflow carga (/reportes/workflow)
- [ ] Exportar a Excel funciona
- [ ] Exportar a PDF funciona

### OCR e IA

- [ ] Botón "Subir factura IA" visible en módulo Documentos
- [ ] Dialog de wizard abre correctamente
- [ ] Zona de drag-and-drop acepta JPG/PNG (PDF muestra estado 'requiere_backend')
- [ ] Progreso de upload se muestra en tiempo real
- [ ] OCR extrae texto del documento
- [ ] Edge Function `ai-document-extract` responde (verificar en Supabase → Functions → Logs)
- [ ] Formulario de gasto se pre-llena con datos de IA
- [ ] Badge de confianza muestra color correcto (verde/amarillo/rojo)
- [ ] Guardar gasto crea el registro en la BD con `documento_id` vinculado

### Storage

- [ ] Upload de documento almacena archivo en bucket `documentos`
- [ ] Path del archivo sigue estructura `{empresa_id}/{rendicion_id}/...`
- [ ] Descarga de documento vía signed URL funciona (URL expira en ~1h)

### Notificaciones

- [ ] Campanita de notificaciones aparece en el sidebar
- [ ] Crear un gasto que supera política genera notificación
- [ ] Enviar rendición a aprobación genera notificación
- [ ] "Marcar todas como leídas" funciona

### Administración

- [ ] Gestión de usuarios y roles
- [ ] Parámetros del sistema: monedas, categorías, estados
- [ ] Políticas de gasto: crear y editar topes por categoría

---

## 11. Checklist final

### Supabase

- [ ] Proyecto creado en la región correcta
- [ ] Todas las tablas base existen (verificar en Table Editor)
- [ ] Las 6 migraciones del repo aplicadas en orden
- [ ] Bucket `documentos` existe y es privado
- [ ] 4 políticas RLS activas en `storage.objects` para bucket `documentos`
- [ ] Edge Function `ai-document-extract` desplegada y activa
- [ ] Secret `OPENAI_API_KEY` configurado (verificar con `supabase secrets list`)
- [ ] URL de sitio configurada en Auth settings
- [ ] Redirect URLs configuradas en Auth settings

### Vercel

- [ ] Repositorio conectado (rama correcta: `feature/reportes` o `main`)
- [ ] `VITE_SUPABASE_URL` configurada en Production
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` configurada en Production
- [ ] Build command: `npm run build`
- [ ] Node.js version: 22.x
- [ ] Deploy exitoso (sin errores en build logs)
- [ ] Dominio personalizado configurado (si aplica)

### Código

- [ ] TypeScript: 0 errores (`npx tsc --noEmit`)
- [ ] ESLint: 0 errores en archivos nuevos
- [ ] `VITE_OPENAI_API_KEY` NO está en ningún `.env` de producción
- [ ] `.env` local en `.gitignore` y NO commitado
- [ ] Rama `feature/reportes` pusheada al remoto

---

## Comandos de referencia rápida

```bash
# Verificar TypeScript local
npx tsc --noEmit

# Verificar ESLint local
npx eslint src/ --max-warnings 0

# Build local (requiere ~4GB RAM)
npm run build

# Preview del build local
npm run preview

# Linkear proyecto Supabase
supabase link --project-ref mpeztjykwwtagdelqsuc

# Aplicar migraciones
supabase db push

# Desplegar Edge Function
supabase functions deploy ai-document-extract

# Configurar secret OpenAI
supabase secrets set OPENAI_API_KEY=sk-proj-...

# Ver logs de Edge Functions
supabase functions logs ai-document-extract --tail

# Ver secrets configurados
supabase secrets list
```

---

*Generado: Sprint Deploy 1 — VIATIQ*
