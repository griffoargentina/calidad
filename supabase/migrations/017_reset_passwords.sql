-- 017_reset_passwords.sql
-- Resetea la contraseña de todos los usuarios del sistema a GriffoQMS2025!
-- Correr una sola vez para sincronizar credenciales del equipo.

UPDATE auth.users
SET
  encrypted_password = crypt('GriffoQMS2025!', gen_salt('bf')),
  updated_at = now()
WHERE id IN (
  SELECT id FROM public.usuarios WHERE activo = true
);
