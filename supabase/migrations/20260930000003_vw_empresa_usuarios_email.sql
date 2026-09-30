-- Agregar email a vw_empresa_usuarios para permitir edición de correo desde la UI de Administración.
-- El email vive en auth.users, no en public.usuarios.
CREATE OR REPLACE VIEW vw_empresa_usuarios AS
SELECT
  eu.id,
  eu.empresa_id,
  eu.usuario_id,
  eu.rol_id,
  eu.activo,
  eu.fecha_inicio,
  eu.fecha_fin,
  u.nombres,
  u.apellidos,
  u.cargo,
  au.email,
  u.estado,
  r.codigo              AS rol_codigo,
  r.nombre              AS rol_nombre,
  eu.roles_adicionales
FROM empresas_usuarios eu
JOIN usuarios        u  ON u.id  = eu.usuario_id
JOIN auth.users      au ON au.id = eu.usuario_id
JOIN roles           r  ON r.id  = eu.rol_id;
