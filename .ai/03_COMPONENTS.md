# COMPONENTES REUTILIZABLES

Versión: 1.0

---

# Objetivo

Este documento describe todos los componentes reutilizables existentes.

Antes de crear cualquier componente nuevo, revisar esta lista.

La prioridad siempre es reutilizar.

---

# Principio General

Está prohibido crear componentes duplicados.

Si un componente existente puede extenderse mediante props, debe reutilizarse.

---

# Componentes Base

## DataTable

Responsabilidad

- Mostrar listas
- Ordenamiento
- Paginación
- Acciones
- Estados vacíos
- Loading

Usar para:

- Clientes
- Proveedores
- Proyectos
- Usuarios
- Gastos
- Viajes
- Documentos
- Rendiciones

Nunca crear otra tabla.

---

## EntityForm

Responsabilidad

Formulario genérico para CRUD.

Debe utilizar:

- React Hook Form
- Zod
- Tipado fuerte

No crear formularios manuales cuando EntityForm pueda reutilizarse.

---

## Drawer

Responsabilidad

Abrir formularios laterales.

Se utiliza para:

- Crear
- Editar
- Ver detalle

Nunca abrir formularios en páginas independientes salvo justificación.

---

## SearchBar

Responsabilidad

Búsqueda rápida.

Debe conectarse con React Query.

---

## FiltersPanel

Responsabilidad

Filtros avanzados.

Permite combinar:

- Estado
- Fecha
- Empresa
- Categoría
- Usuario
- Cliente
- Proyecto

Debe ser reutilizable.

---

## Pagination

Responsabilidad

Paginación de tablas.

Nunca implementar otra paginación.

---

## ConfirmDialog

Responsabilidad

Confirmaciones.

Ejemplos:

Eliminar

Aprobar

Cancelar

---

## DeleteDialog

Responsabilidad

Confirmar eliminación lógica.

Nunca eliminar registros sin confirmación.

---

## LoadingState

Responsabilidad

Mostrar carga.

Nunca usar texto "Loading..."

Utilizar este componente.

---

## EmptyState

Responsabilidad

Mostrar listas vacías.

Debe reutilizarse en todos los módulos.

---

## MetricCard

Responsabilidad

Indicadores del Dashboard.

No crear tarjetas nuevas.

---

## StatusBadge

Responsabilidad

Mostrar estados.

Ejemplos

Activo

Inactivo

Pendiente

Aprobado

Rechazado

Finalizado

Debe centralizar colores y estilos.

---

## Toast

Responsabilidad

Notificaciones.

Utilizar para:

- éxito
- error
- advertencia
- información

Nunca utilizar alert().

---

## PageHeader

Responsabilidad

Título de cada módulo.

Debe mostrar:

Título

Descripción

Breadcrumb

Botones principales

---

# Layout

El Layout ya existe.

Incluye:

AppShell

Sidebar

Topbar

CompanySwitcher

UserMenu

Notifications

Nunca crear layouts nuevos.

---

# Módulos

Todos los módulos deberán construirse utilizando únicamente estos componentes.

Clientes

Proveedores

Proyectos

Usuarios

Empresas

Presupuestos

Gastos

Viajes

Documentos

Rendiciones

Dashboard

Reportes

Configuración

Administración

---

# Regla de Oro

Si un componente existente cubre el 80% de la necesidad, extenderlo.

No reemplazarlo.

No duplicarlo.

Mantener una única fuente de verdad.