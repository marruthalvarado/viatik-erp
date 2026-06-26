# ARQUITECTURA DE VIATIK

Versión: 1.0

---

# Objetivo

Este documento define la arquitectura oficial del proyecto.

Toda IA que modifique el código debe respetar esta arquitectura.

Nunca modificarla sin una razón técnica justificada.

---

# Arquitectura General

La aplicación sigue una arquitectura por capas.

```
Usuario
    │
    ▼
Pantallas (Routes)
    │
    ▼
Componentes
    │
    ▼
Hooks
    │
    ▼
Servicios
    │
    ▼
CRUD Factory
    │
    ▼
Supabase Client
    │
    ▼
Supabase
```

Nunca saltar capas.

---

# Estructura del proyecto

```
src/

components/
contexts/
hooks/
services/
routes/
integrations/
types/
lib/
utils/
```

Cada carpeta tiene una responsabilidad única.

---

# Components

Los componentes NO contienen lógica de negocio.

Su única responsabilidad es:

- Renderizar UI
- Capturar eventos
- Llamar Hooks

Nunca realizar consultas directas a Supabase.

---

# Hooks

Los Hooks contienen:

- React Query
- Estados
- Mutaciones
- Caché
- Invalidaciones

Nunca escribir SQL aquí.

Nunca acceder directamente a Supabase.

Siempre utilizar Services.

---

# Services

Toda comunicación con Supabase ocurre aquí.

Los Services:

- crean
- leen
- actualizan
- eliminan

Nunca renderizan UI.

Nunca contienen JSX.

---

# CRUD Factory

Existe una CRUD Factory reutilizable.

Debe utilizarse siempre.

Nunca crear otro CRUD.

Nunca duplicar lógica.

Toda nueva entidad debe reutilizar la Factory.

---

# CompanyContext

El sistema es multiempresa.

Toda consulta debe respetar:

empresa_id

Nunca devolver información de otra empresa.

Siempre utilizar CompanyContext.

---

# AuthContext

Toda autenticación utiliza Supabase Auth.

Nunca implementar autenticación propia.

Nunca guardar tokens manualmente.

Nunca almacenar credenciales.

---

# React Query

Todas las consultas utilizan TanStack Query.

Siempre utilizar:

useQuery()

useMutation()

invalidateQueries()

Nunca usar useEffect para cargar datos si ya existe un Hook.

---

# Routing

El proyecto utiliza TanStack Router.

Nunca crear navegación manual.

Siempre registrar nuevas rutas.

---

# Tipado

Todo el proyecto utiliza TypeScript estricto.

Está prohibido utilizar:

any

salvo que exista una justificación documentada.

---

# Formularios

Todos los formularios utilizan:

React Hook Form

+

Zod

No crear formularios con useState cuando ya exista EntityForm.

---

# Componentes reutilizables

Ya existen:

DataTable

EntityForm

Drawer

SearchBar

FiltersPanel

Pagination

DeleteDialog

ConfirmDialog

LoadingState

EmptyState

MetricCard

StatusBadge

Toast

PageHeader

Antes de crear un componente nuevo verificar si alguno de estos puede reutilizarse.

---

# Patrón de un módulo

Cada módulo debe seguir exactamente esta estructura.

```
Ruta

↓

PageHeader

↓

Toolbar

↓

SearchBar

↓

FiltersPanel

↓

DataTable

↓

Drawer

↓

EntityForm

↓

Dialogs

↓

Hook

↓

Service

↓

CRUD Factory

↓

Supabase
```

Nunca romper este patrón.

---

# Multiempresa

El flujo correcto es:

```
Usuario

↓

AuthContext

↓

CompanyContext

↓

empresa_id

↓

Hook

↓

Service

↓

Supabase
```

Toda consulta debe filtrar por empresa.

---

# Reglas

No crear componentes duplicados.

No crear Hooks duplicados.

No crear Services duplicados.

No crear CRUD nuevos.

No acceder a Supabase desde la UI.

No escribir SQL en componentes.

No romper el tipado.

No romper la arquitectura.

---

# Objetivo

Construir un ERP escalable, mantenible y reutilizable utilizando la infraestructura existente.

Toda nueva funcionalidad debe adaptarse a esta arquitectura y no al revés.