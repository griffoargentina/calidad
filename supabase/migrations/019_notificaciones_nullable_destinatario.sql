-- Permite destinatario_id NULL para notificaciones de sistema
-- (ej: resumen_semanal que se envía a destinatarios fijos, no a un usuario específico)
ALTER TABLE notificaciones
  ALTER COLUMN destinatario_id DROP NOT NULL;
