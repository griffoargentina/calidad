-- Vencimiento separado para procedimientos
ALTER TABLE items ADD COLUMN IF NOT EXISTS proc_fecha_vencimiento DATE;

-- Agregar DS al CHECK de tipo_documento
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_tipo_documento_check;
ALTER TABLE items ADD CONSTRAINT items_tipo_documento_check
  CHECK (tipo_documento IN ('MA', 'PR', 'IT', 'FO', 'RE', 'DS'));
