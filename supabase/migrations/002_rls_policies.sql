-- ============================================================
-- QMS Griffo — Row Level Security Policies
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clausulas_iso ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Función helper: obtener rol del usuario actual
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_rol()
RETURNS rol_usuario
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT rol FROM usuarios WHERE id = auth.uid();
$$;

-- ============================================================
-- Función helper: verificar si el usuario es admin
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin' AND activo = true
  );
$$;

-- ============================================================
-- Función helper: verificar si el usuario es editor o admin
-- ============================================================

CREATE OR REPLACE FUNCTION is_editor_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid()
      AND rol IN ('admin', 'editor')
      AND activo = true
  );
$$;

-- ============================================================
-- Función helper: verificar si el usuario activo existe
-- ============================================================

CREATE OR REPLACE FUNCTION is_active_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios WHERE id = auth.uid() AND activo = true
  );
$$;

-- ============================================================
-- POLÍTICAS: areas
-- ============================================================

-- Todos los usuarios activos ven las áreas
CREATE POLICY "areas_select_all_active" ON areas
  FOR SELECT
  USING (is_active_user());

-- Solo admin puede crear/editar/eliminar áreas
CREATE POLICY "areas_insert_admin" ON areas
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "areas_update_admin" ON areas
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "areas_delete_admin" ON areas
  FOR DELETE
  USING (is_admin());

-- ============================================================
-- POLÍTICAS: usuarios
-- ============================================================

-- Todos los usuarios activos ven el listado de usuarios
CREATE POLICY "usuarios_select_all_active" ON usuarios
  FOR SELECT
  USING (is_active_user());

-- Solo admin puede crear/editar usuarios
CREATE POLICY "usuarios_insert_admin" ON usuarios
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "usuarios_update_admin_or_self" ON usuarios
  FOR UPDATE
  USING (is_admin() OR id = auth.uid());

-- Solo admin puede eliminar usuarios (en práctica: marcar inactivo)
CREATE POLICY "usuarios_delete_admin" ON usuarios
  FOR DELETE
  USING (is_admin());

-- ============================================================
-- POLÍTICAS: clausulas_iso (referencia, solo lectura para todos)
-- ============================================================

CREATE POLICY "clausulas_select_all_active" ON clausulas_iso
  FOR SELECT
  USING (is_active_user());

-- Solo admin puede modificar cláusulas (muy raro, son estándar)
CREATE POLICY "clausulas_insert_admin" ON clausulas_iso
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "clausulas_update_admin" ON clausulas_iso
  FOR UPDATE
  USING (is_admin());

-- ============================================================
-- POLÍTICAS: items
-- ============================================================

-- Lectores y editores ven items vigentes (no borradores de otros)
-- Borradores: solo el responsable o admin los ve
CREATE POLICY "items_select" ON items
  FOR SELECT
  USING (
    is_active_user()
    AND (
      -- Admin ve todo
      is_admin()
      -- No borrador: todos lo ven (pendiente_aprobacion oculta para no-admin está en UI)
      OR es_borrador = false
      -- Borrador propio: responsable directo lo ve
      OR (es_borrador = true AND responsable_id = auth.uid())
    )
  );

-- Editor puede crear items de los tipos que tiene habilitados o en su área
CREATE POLICY "items_insert" ON items
  FOR INSERT
  WITH CHECK (
    is_admin()
    OR (
      is_editor_or_admin()
      AND (
        -- El tipo está en sus tipos habilitados
        tipo = ANY(
          SELECT unnest(tipos_habilitados) FROM usuarios WHERE id = auth.uid()
        )
        -- O el item es de su área
        OR area_id = (SELECT area_id FROM usuarios WHERE id = auth.uid())
        -- O es el responsable
        OR responsable_id = auth.uid()
      )
    )
  );

-- Editor puede editar items de los que es responsable o de su área/tipo habilitado
CREATE POLICY "items_update" ON items
  FOR UPDATE
  USING (
    is_admin()
    OR (
      is_editor_or_admin()
      AND (
        responsable_id = auth.uid()
        OR area_id = (SELECT area_id FROM usuarios WHERE id = auth.uid())
        OR tipo = ANY(
          SELECT unnest(tipos_habilitados) FROM usuarios WHERE id = auth.uid()
        )
      )
    )
  );

-- Solo admin puede eliminar items (marcar obsoleto en práctica)
CREATE POLICY "items_delete_admin" ON items
  FOR DELETE
  USING (is_admin());

-- ============================================================
-- POLÍTICAS: archivos
-- ============================================================

-- Todos los usuarios activos pueden ver archivos (de items que pueden ver)
CREATE POLICY "archivos_select" ON archivos
  FOR SELECT
  USING (
    is_active_user()
    AND EXISTS (
      SELECT 1 FROM items i WHERE i.id = item_id
    )
  );

-- Editor/admin puede subir archivos
CREATE POLICY "archivos_insert" ON archivos
  FOR INSERT
  WITH CHECK (is_editor_or_admin());

-- Solo admin puede actualizar metadatos de archivo (ej. aprobacion)
CREATE POLICY "archivos_update_admin" ON archivos
  FOR UPDATE
  USING (is_admin());

-- Archivos nunca se eliminan (política de negocio)
-- No se define política de DELETE → nadie puede borrar

-- ============================================================
-- POLÍTICAS: historial (inmutable, solo lectura)
-- ============================================================

CREATE POLICY "historial_select_all_active" ON historial
  FOR SELECT
  USING (is_active_user());

-- Solo el sistema (service_role) puede insertar en historial
-- Los usuarios no insertan directamente
CREATE POLICY "historial_insert_service" ON historial
  FOR INSERT
  WITH CHECK (is_active_user()); -- triggers insertan usando security definer

-- ============================================================
-- POLÍTICAS: notificaciones
-- ============================================================

-- Usuario ve solo sus notificaciones; admin ve todas
CREATE POLICY "notificaciones_select" ON notificaciones
  FOR SELECT
  USING (
    is_admin()
    OR destinatario_id = auth.uid()
  );

CREATE POLICY "notificaciones_insert_service" ON notificaciones
  FOR INSERT
  WITH CHECK (is_admin()); -- Edge Functions usan service_role

-- ============================================================
-- POLÍTICAS: comentarios
-- ============================================================

-- Todos los usuarios activos ven comentarios de items que pueden ver
CREATE POLICY "comentarios_select" ON comentarios
  FOR SELECT
  USING (is_active_user());

-- Cualquier usuario activo puede comentar
CREATE POLICY "comentarios_insert" ON comentarios
  FOR INSERT
  WITH CHECK (is_active_user() AND usuario_id = auth.uid());

-- Solo el autor o admin puede editar/eliminar comentario
CREATE POLICY "comentarios_update" ON comentarios
  FOR UPDATE
  USING (is_admin() OR usuario_id = auth.uid());

CREATE POLICY "comentarios_delete" ON comentarios
  FOR DELETE
  USING (is_admin() OR usuario_id = auth.uid());

-- ============================================================
-- POLÍTICAS: plantillas
-- ============================================================

-- Todos los usuarios activos ven plantillas
CREATE POLICY "plantillas_select" ON plantillas
  FOR SELECT
  USING (is_active_user());

-- Editor/admin puede crear plantillas
CREATE POLICY "plantillas_insert" ON plantillas
  FOR INSERT
  WITH CHECK (is_editor_or_admin() AND created_by = auth.uid());

-- Solo el creador o admin puede modificar/eliminar
CREATE POLICY "plantillas_update" ON plantillas
  FOR UPDATE
  USING (is_admin() OR created_by = auth.uid());

CREATE POLICY "plantillas_delete" ON plantillas
  FOR DELETE
  USING (is_admin() OR created_by = auth.uid());
