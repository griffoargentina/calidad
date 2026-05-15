-- 008_procedimiento_na.sql
-- Agrega campo para marcar que un item no requiere procedimiento documentado.
-- Cuando es true, el semáforo de procedimiento muestra verde.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS procedimiento_na boolean NOT NULL DEFAULT false;
