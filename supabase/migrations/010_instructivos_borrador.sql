-- Agregar "borrador" al CHECK constraint de proc_instructivos
ALTER TABLE proc_instructivos DROP CONSTRAINT IF EXISTS proc_instructivos_estado_check;
ALTER TABLE proc_instructivos
  ADD CONSTRAINT proc_instructivos_estado_check
  CHECK (estado IN ('borrador', 'vigente', 'historico', 'pendiente_aprobacion', 'rechazado'));
