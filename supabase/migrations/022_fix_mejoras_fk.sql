-- Fix: FK de mejoras.created_by y mejoras_fotos.subido_by
-- deben referenciar public.usuarios, no auth.users

ALTER TABLE mejoras
  DROP CONSTRAINT IF EXISTS mejoras_created_by_fkey,
  ADD CONSTRAINT mejoras_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE mejoras_fotos
  DROP CONSTRAINT IF EXISTS mejoras_fotos_subido_by_fkey,
  ADD CONSTRAINT mejoras_fotos_subido_by_fkey
    FOREIGN KEY (subido_by) REFERENCES usuarios(id) ON DELETE SET NULL;
