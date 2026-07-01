-- ============================================================
-- MIGRACIÓN: Campos de viaje, anticipos, km ciudad, roles
-- ============================================================

-- 1. viajes: agregar origen (ciudad de origen del viaje)
ALTER TABLE viajes
  ADD COLUMN IF NOT EXISTS origen TEXT;

-- 2. rendiciones: agregar motivo, anticipo_efectivo, anticipo_credito
ALTER TABLE rendiciones
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS anticipo_efectivo NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS anticipo_credito  NUMERIC(12,2) DEFAULT 0;

-- 3. politicas: agregar km_ciudad_por_dia (km reconocidos/día por movilización urbana)
ALTER TABLE politicas
  ADD COLUMN IF NOT EXISTS km_ciudad_por_dia NUMERIC(10,2) DEFAULT 0;

-- 4. roles: seed admin y usuario si no existen
INSERT INTO roles (codigo, nombre, descripcion)
VALUES
  ('admin',   'Administrador', 'Acceso completo: gestión de empresa, usuarios y políticas'),
  ('usuario', 'Usuario',       'Acceso estándar: registro y envío de rendiciones')
ON CONFLICT (codigo) DO NOTHING;

-- índice único para búsqueda rápida por código de rol
CREATE UNIQUE INDEX IF NOT EXISTS roles_codigo_uq ON roles (codigo);

-- 5. Función/trigger: primer usuario registrado en empresa => admin automático
CREATE OR REPLACE FUNCTION fn_primer_usuario_es_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_rol_id UUID;
  v_count        INT;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM empresas_usuarios
   WHERE empresa_id = NEW.empresa_id
     AND id <> NEW.id;

  IF v_count = 0 THEN
    SELECT id INTO v_admin_rol_id FROM roles WHERE codigo = 'admin' LIMIT 1;
    IF v_admin_rol_id IS NOT NULL THEN
      NEW.rol_id := v_admin_rol_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_primer_usuario_es_admin ON empresas_usuarios;
CREATE TRIGGER trg_primer_usuario_es_admin
  BEFORE INSERT ON empresas_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION fn_primer_usuario_es_admin();

-- 6. Vista: miembros de empresa con usuario y rol
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
  u.estado,
  r.codigo  AS rol_codigo,
  r.nombre  AS rol_nombre
FROM empresas_usuarios eu
JOIN usuarios u ON u.id = eu.usuario_id
JOIN roles    r ON r.id = eu.rol_id;

-- 7. RPC: ¿es admin el usuario actual en esa empresa?
CREATE OR REPLACE FUNCTION es_admin_empresa(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM empresas_usuarios eu
    JOIN roles r ON r.id = eu.rol_id
    WHERE eu.empresa_id = p_empresa_id
      AND eu.usuario_id = auth.uid()
      AND eu.activo = true
      AND r.codigo = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION es_admin_empresa(UUID) TO authenticated;
