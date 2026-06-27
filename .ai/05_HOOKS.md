# HOOKS

Versión 1.0

---

# Objetivo

Los Hooks representan la capa entre la UI y los Services.

Nunca acceder directamente a Services desde un componente cuando exista un Hook.

---

# Arquitectura

UI

↓

Hook

↓

Service

↓

CRUD Factory

↓

Supabase

---

# Responsabilidades

Los Hooks:

- utilizan TanStack Query
- mantienen caché
- realizan invalidaciones
- exponen loading
- exponen error
- exponen mutaciones

No contienen SQL.

No contienen JSX.

---

# Hooks existentes

Ya existen Hooks para:

- Auth
- Company
- Clientes
- Proveedores
- Empresas
- Usuarios
- Gastos
- Proyectos
- Presupuestos
- Documentos
- Viajes
- Rendiciones

Siempre reutilizarlos.

---

# Entity Hooks

Existe una Hook Factory.

Debe reutilizarse.

Nunca crear Hooks CRUD manuales si la Factory los puede generar.

---

# React Query

Siempre utilizar:

useQuery()

useMutation()

queryClient.invalidateQueries()

No usar useEffect para cargar datos cuando exista un Hook.

---

# Multiempresa

Todos los Hooks utilizan CompanyContext.

Nunca solicitar empresa_id desde la UI.

Siempre obtenerlo del contexto.

---

# Regla

Un componente nunca conoce Supabase.

Solo conoce Hooks.