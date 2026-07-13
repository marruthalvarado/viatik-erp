-- =============================================================================
-- Permisos de módulos por rol
-- Agrega la columna modulos_permitidos (text[]) a la tabla roles.
-- NULL = sin restricción (ve todo). Aplica a todos los roles excepto admin,
-- que siempre ve todos los módulos independientemente del valor.
-- =============================================================================

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS modulos_permitidos text[] DEFAULT NULL;

COMMENT ON COLUMN roles.modulos_permitidos IS
  'Lista de módulos accesibles para este rol. NULL = acceso total. '
  'Valores posibles: dashboard, rendiciones, workflow, documentos, '
  'clientes, proyectos, proveedores, presupuestos, gastos, reportes, '
  'configuracion, administracion';
