-- Hacer item_id nullable y agregar modulo + referencia_id
ALTER TABLE archivos ALTER COLUMN item_id DROP NOT NULL;

ALTER TABLE archivos ADD COLUMN IF NOT EXISTS modulo TEXT;
ALTER TABLE archivos ADD COLUMN IF NOT EXISTS referencia_id UUID;

-- Migrar registros existentes
UPDATE archivos
SET modulo = 'items', referencia_id = item_id
WHERE item_id IS NOT NULL AND modulo IS NULL;

-- Default para nuevos registros
ALTER TABLE archivos ALTER COLUMN modulo SET DEFAULT 'items';
