-- Agrega dirección a clientes y direccion_cliente a facturas_emitidas
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS direccion TEXT;

ALTER TABLE public.facturas_emitidas
  ADD COLUMN IF NOT EXISTS direccion_cliente TEXT;
