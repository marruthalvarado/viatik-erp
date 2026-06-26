# Arquitectura base Viatik — Plan de reorganización

## 0. Prerrequisito bloqueante

No tengo el esquema real de las ~44 tablas. Para no inventar nombres de tablas ni de columnas necesito **uno** de estos dos insumos antes de generar servicios/hooks/tipos:

- **Opción A (recomendada)**: que me confirmes los nombres exactos de tablas (al menos: clientes, proyectos, proveedores, presupuestos, gastos, documentos, rendiciones, viajes, usuarios, empresas) y su PK. Con esto genero servicios tipados sin tocar Supabase.
- **Opción B**: que pegues el contenido de `src/integrations/supabase/types.ts` si ya existe en tu repo, o me autorices a generarlo desde Supabase CLI (solo lectura del esquema, no migra nada).

Sin esto solo puedo dejar el scaffold genérico (capa, factory, hooks base) pero los servicios concretos quedarían como TODO.

## 1. Reorganización de carpetas

Estado actual ya cumple gran parte. Cambios mínimos:

```text
src/
  components/
    common/        (existe — se amplía)
    layout/        (existe)
    ui/            (shadcn — sin tocar)
  contexts/        (NUEVO — CompanyContext, AuthContext)
  hooks/           (existe — se amplía)
  integrations/
    supabase/      (existe — sin tocar client.ts)
  lib/             (existe)
  pages/           → NO se crea. TanStack Start usa src/routes/. Las rutas actuales se mantienen.
  routes/          (existe)
  services/        (NUEVO)
  types/           (NUEVO)
  utils/           (NUEVO — formatters, validators)
```

Nota: el prompt menciona `pages/`, pero el stack es TanStack Start con file-based routing en `src/routes/`. Mantengo `routes/` y no creo `pages/` (mezclar ambos rompe el router).

## 2. Capa de servicios (`src/services/`)

Patrón: **factory genérica tipada** + wrapper por entidad. Evita duplicar 9 archivos casi idénticos.

```text
services/
  _factory.ts       ← createCrudService<Row, Insert, Update>(table)
  clientes.ts
  proyectos.ts
  proveedores.ts
  presupuestos.ts
  gastos.ts
  documentos.ts
  rendiciones.ts
  viajes.ts
  usuarios.ts
  empresas.ts
```

Cada wrapper expone `listar`, `obtener`, `crear`, `actualizar`, `eliminar` tipados contra `Database['public']['Tables'][...]` y permite extender con queries específicas (joins, filtros por empresa) sin tocar la factory. Todas las llamadas a `supabase.from(...)` viven solo aquí.

## 3. Hooks (`src/hooks/`)

Patrón TanStack Query (ya está en el stack). Una factory base + hooks por entidad:

```text
hooks/
  use-mobile.tsx           (existe)
  use-company.ts           (selección de empresa activa)
  use-auth.ts              (sesión Supabase + onAuthStateChange)
  entities/
    use-clientes.ts        (useClientes, useCliente, useCrearCliente, ...)
    use-proyectos.ts
    use-proveedores.ts
    use-presupuestos.ts
    use-gastos.ts
    use-documentos.ts
    use-rendiciones.ts
    use-viajes.ts
    use-usuarios.ts
    use-empresas.ts
```

Los hooks scopean automáticamente por `empresa_id` activa (del `CompanyContext`) si la tabla la tiene.

## 4. Tipado (`src/types/`)

```text
types/
  database.ts        ← re-export de Database desde integrations/supabase/types
  entities.ts        ← aliases Cliente = Tables<'clientes'>['Row'], etc.
  common.ts          ← Paginated<T>, ListParams, SortDir
```

No se inventan estructuras: todos los tipos derivan del `Database` generado.

## 5. Componentes reutilizables (`src/components/common/`)

Ya existen: `PageHeader`, `MetricCard`, `DataTable`, `StatusBadge`, `EmptyState`, `LoadingState`, `PagePlaceholder`.

Se añaden (envuelven shadcn existente, no duplican):

- `SearchBar` (wrapper de Input + icono + debounce)
- `FiltersPanel` (Sheet lateral con slots)
- `EntityForm` (wrapper de react-hook-form + zod + shadcn Form)
- `Drawer` (re-export tipado de shadcn `sheet`)
- `ConfirmDialog` y `DeleteDialog` (basados en `alert-dialog`)
- `Pagination` (wrapper de shadcn `pagination` con estado controlado)
- `Breadcrumbs` (wrapper de shadcn `breadcrumb` derivando del router)
- `Toast`: re-export del helper `sonner` ya integrado

No se reemplazan los componentes existentes; solo se completan los faltantes.

## 6. Layout único

`AppShell` actual ya combina `AppSidebar` + `Topbar`. Se completa:

- Mover `Breadcrumbs` al `Topbar` (derivados del pathname).
- `CompanySwitcher` pasa a leer/escribir `CompanyContext`.
- `UserProfileMenu` y `NotificationsCenter` quedan listos para conectarse a `useAuth` / servicio de notificaciones cuando exista la tabla.

Una sola fuente de layout; las rutas siguen envolviéndose con `<AppShell>`.

## 7. Contextos (`src/contexts/`)

- `AuthContext`: expone `user`, `session`, `signOut`. Suscribe `onAuthStateChange` una sola vez en `__root.tsx`.
- `CompanyContext`: `empresaActivaId`, `setEmpresaActiva`, persistido en `localStorage`. Todos los hooks de entidad lo consumen.

## 8. Seguridad

- Solo se usa `@/integrations/supabase/client` (anon key + sesión persistida). RLS aplica.
- Nada de `service_role`, nada de server functions privilegiadas en este paso.
- Mutaciones solo cuando hay sesión (los hooks lo verifican).

## 9. Qué NO se hace

- No se crean tablas, migraciones, RLS, edge functions, ni datos mock.
- No se borran rutas/componentes existentes que funcionan.
- No se implementa lógica de negocio por entidad (solo el andamiaje CRUD).
- No se crea `src/pages/` (incompatible con TanStack Router).

## 10. Entregables al cerrar

Resumen con: árbol final, listado de servicios, hooks, componentes nuevos vs reutilizados, y TODOs por entidad pendientes de tipar contra el esquema real.

---

**Decisión que necesito de ti antes de ejecutar:**

1. ¿Me pasas `src/integrations/supabase/types.ts` (o autorizas a generarlo) y los nombres exactos de las 10 tablas principales? Sin esto los servicios quedan como stubs `any`.
2. ¿Confirmas mantener `src/routes/` (TanStack) y descartar `src/pages/`?
