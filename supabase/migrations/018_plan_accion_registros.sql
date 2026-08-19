-- 018_plan_accion_registros.sql
-- Agrega columna plan_accion a indicador_registros

ALTER TABLE indicador_registros
  ADD COLUMN IF NOT EXISTS plan_accion TEXT;
