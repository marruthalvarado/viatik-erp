-- Agregar roles_adicionales_codigos text[] a vw_empresa_usuarios.
-- roles_adicionales es uuid[] (IDs de roles); se necesitan los códigos para filtrar en el frontend.
DROP VIEW IF EXISTS vw_empresa_usuarios;
CREATE VIEW vw_empresa_usuarios AS
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
  u.estado,
  r.codigo              AS rol_codigo,
  r.nombre              AS rol_nombre,
  eu.roles_adicionales,
  au.email,
  COALESCE(
    ARRAY(
      SELECT r2.codigo
      FROM roles r2
      WHERE r2.id = ANY(COALESCE(eu.roles_adicionales, ARRAY[]::uuid[]))
    ),
    ARRAY[]::text[]
  )                     AS roles_adicionales_codigos
FROM empresas_usuarios eu
JOIN usuarios        u  ON u.id  = eu.usuario_id
JOIN auth.users      au ON au.id = eu.usuario_id
JOIN roles           r  ON r.id  = eu.rol_id;
