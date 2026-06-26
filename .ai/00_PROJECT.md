# VIATIK ERP

Version: 1.0

---

# Objetivo

Viatik es un ERP SaaS multiempresa para la gestión integral de viajes corporativos, gastos, anticipos, presupuestos, documentos, rendiciones y procesos administrativos.

La aplicación está construida sobre React + TypeScript + Supabase y debe mantener una arquitectura limpia, reutilizable y escalable.

El objetivo NO es crear un MVP temporal.

El objetivo es construir un producto comercial listo para producción.

---

# Stack Tecnológico

Frontend

- React 18
- TypeScript
- Vite

UI

- shadcn/ui
- TailwindCSS
- Lucide Icons

Backend

- Supabase

Base de datos

- PostgreSQL

Autenticación

- Supabase Auth

Estado

- TanStack Query

Routing

- TanStack Router

Validaciones

- React Hook Form
- Zod

---

# Arquitectura

La aplicación utiliza una arquitectura por capas.

UI

↓

Hooks

↓

Services

↓

CRUD Factory

↓

Supabase

↓

PostgreSQL

Nunca romper esta arquitectura.

Nunca acceder directamente a Supabase desde un componente visual.

Toda interacción con la base de datos debe realizarse mediante Services y Hooks.

---

# Estado actual

La arquitectura ya existe.

La mayoría de la infraestructura fue generada por Lovable y posteriormente auditada.

Actualmente existen:

- CRUD Factory
- Hooks Factory
- AuthContext
- CompanyContext
- DataTable
- EntityForm
- Drawer
- SearchBar
- FiltersPanel
- Pagination
- ConfirmDialog
- DeleteDialog
- LoadingState
- EmptyState
- MetricCard

Estos componentes deben reutilizarse.

No crear duplicados.

---

# Objetivo del desarrollo

Completar todos los módulos funcionales reutilizando la infraestructura existente.

No reemplazar componentes existentes.

No modificar la arquitectura salvo que sea estrictamente necesario.

---

# Principios

Priorizar reutilización.

Priorizar simplicidad.

Priorizar tipado fuerte.

Priorizar componentes reutilizables.

Priorizar mantenibilidad.

Nunca crear código duplicado.

---

# Módulos

Los módulos del sistema son:

- Dashboard
- Empresas
- Usuarios
- Clientes
- Proveedores
- Proyectos
- Presupuestos
- Gastos
- Viajes
- Documentos
- Rendiciones
- Reportes
- Configuración
- Administración

Todos deben utilizar el mismo patrón arquitectónico.

---

# Regla Principal

Antes de crear cualquier componente nuevo, revisar si ya existe uno reutilizable.

Si existe, reutilizarlo.

Si no existe, proponer su creación explicando por qué es necesario.

Nunca crear componentes redundantes.