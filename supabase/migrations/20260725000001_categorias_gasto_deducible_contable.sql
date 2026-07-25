-- ─── P1: es_deducible — diferencia gastos deducibles de IR vs no deducibles ────
-- ─── P5: codigo_contable — vincula la categoría al Plan de Cuentas ────────────

ALTER TABLE categorias_gasto
  ADD COLUMN IF NOT EXISTS es_deducible   BOOLEAN      NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS codigo_contable VARCHAR(20)  NULL;

-- ─── Seed: códigos contables del Plan de Cuentas de Protonmedical S.A.S. ──────
-- Actualiza por nombre (ILIKE para tolerancia a mayúsculas / variantes).
-- Si una categoría no hace match, queda con NULL / es_deducible = TRUE (seguro).

UPDATE categorias_gasto SET codigo_contable = '6.1.1.001' WHERE nombre ILIKE '%sueldo%' OR nombre ILIKE '%salario%';
UPDATE categorias_gasto SET codigo_contable = '6.1.1.002' WHERE nombre ILIKE '%aporte patronal%' OR nombre ILIKE '%iess patronal%';
UPDATE categorias_gasto SET codigo_contable = '6.1.1.004' WHERE nombre ILIKE '%décimo tercer%' OR nombre ILIKE '%decimo tercer%';
UPDATE categorias_gasto SET codigo_contable = '6.1.1.005' WHERE nombre ILIKE '%décimo cuarto%' OR nombre ILIKE '%decimo cuarto%';
UPDATE categorias_gasto SET codigo_contable = '6.1.1.006' WHERE nombre ILIKE '%vacacion%';
UPDATE categorias_gasto SET codigo_contable = '6.1.1.007' WHERE nombre ILIKE '%fondo de reserva%';
UPDATE categorias_gasto SET codigo_contable = '6.1.1.008' WHERE nombre ILIKE '%servicio%profesional%' OR nombre ILIKE '%honorario%';
UPDATE categorias_gasto SET codigo_contable = '6.1.1.009' WHERE nombre ILIKE '%envio%' OR nombre ILIKE '%encomienda%' OR nombre ILIKE '%courier%';
UPDATE categorias_gasto SET codigo_contable = '6.1.1.010' WHERE nombre ILIKE '%servicio%básico%' OR nombre ILIKE '%servicio%basico%' OR nombre ILIKE '%internet%' OR nombre ILIKE '%teléfono%' OR nombre ILIKE '%telefono%' OR nombre ILIKE '%agua%' OR nombre ILIKE '%luz%' OR nombre ILIKE '%electricidad%';
UPDATE categorias_gasto SET codigo_contable = '6.1.2.001' WHERE nombre ILIKE '%alimentaci%' OR nombre ILIKE '%comida%' OR nombre ILIKE '%restaurant%';
UPDATE categorias_gasto SET codigo_contable = '6.1.2.002' WHERE nombre ILIKE '%peaje%';
UPDATE categorias_gasto SET codigo_contable = '6.1.2.003' WHERE nombre ILIKE '%boleto%aéreo%' OR nombre ILIKE '%boleto%aereo%' OR nombre ILIKE '%pasaje%aéreo%' OR nombre ILIKE '%pasaje%aereo%' OR nombre ILIKE '%vuelo%' OR nombre ILIKE '%aéreo%' OR nombre ILIKE '%aereo%';
UPDATE categorias_gasto SET codigo_contable = '6.1.2.004' WHERE nombre ILIKE '%terrestre%' OR nombre ILIKE '%bus%' OR nombre ILIKE '%buseta%';
UPDATE categorias_gasto SET codigo_contable = '6.1.2.005' WHERE nombre ILIKE '%viaje%' OR nombre ILIKE '%hospedaje%' OR nombre ILIKE '%hotel%' OR nombre ILIKE '%alojamiento%';
UPDATE categorias_gasto SET codigo_contable = '6.1.3.001' WHERE nombre ILIKE '%comisión%bancaria%' OR nombre ILIKE '%comision%bancaria%';
UPDATE categorias_gasto SET codigo_contable = '6.1.3.002' WHERE nombre ILIKE '%interés%bancario%' OR nombre ILIKE '%interes%bancario%';
UPDATE categorias_gasto SET codigo_contable = '6.1.3.003' WHERE nombre ILIKE '%servicio%bancario%';
UPDATE categorias_gasto SET codigo_contable = '6.1.3.004' WHERE nombre ILIKE '%isd%' OR nombre ILIKE '%salida de divisa%';
UPDATE categorias_gasto SET codigo_contable = '6.1.4.001' WHERE nombre ILIKE '%taxi%' OR nombre ILIKE '%uber%' OR nombre ILIKE '%movilizaci%';
UPDATE categorias_gasto SET codigo_contable = '6.1.4.002' WHERE nombre ILIKE '%limpieza%' OR nombre ILIKE '%aseo%';
UPDATE categorias_gasto SET codigo_contable = '6.1.4.003' WHERE nombre ILIKE '%reembolso sin sustento%' OR nombre ILIKE '%sin comprobante%';
UPDATE categorias_gasto SET codigo_contable = '6.1.4.004' WHERE nombre ILIKE '%otros.*sin sustento%' OR nombre ILIKE '%gasto no sustentado%';
UPDATE categorias_gasto SET codigo_contable = '6.1.4.005' WHERE nombre ILIKE '%multa%' OR nombre ILIKE '%contribuci%';
UPDATE categorias_gasto SET codigo_contable = '6.1.4.006' WHERE nombre ILIKE '%plataforma%internacional%' OR nombre ILIKE '%suscripci%' OR nombre ILIKE '%software%' OR nombre ILIKE '%dominio%' OR nombre ILIKE '%hosting%';

-- ─── Seed: marcar NO DEDUCIBLES (sección 6.1.4 del Plan de Cuentas) ───────────
UPDATE categorias_gasto
  SET es_deducible = FALSE
  WHERE codigo_contable IN (
    '6.1.4.001',  -- Movilización Taxis / Uber
    '6.1.4.002',  -- Limpieza
    '6.1.4.003',  -- Reembolso Sin Sustento
    '6.1.4.004',  -- Otros Sin Sustento
    '6.1.4.005',  -- Multas y Contribuciones
    '6.1.4.006'   -- Plataformas Internacionales
  );
