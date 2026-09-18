-- Agregar tipo_documento y codigo a archivos
ALTER TABLE archivos ADD COLUMN IF NOT EXISTS tipo_documento TEXT
  CHECK (tipo_documento IN ('MA', 'PR', 'IT', 'FO', 'RE', 'DS'));
ALTER TABLE archivos ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE;
