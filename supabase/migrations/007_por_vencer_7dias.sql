-- ============================================================
-- Cambio de criterio: "por vencer" = 7 días (antes 30 días)
-- Aplicar en Supabase SQL Editor
-- ============================================================

-- 1. Trigger: fn_actualizar_estado_item
CREATE OR REPLACE FUNCTION fn_actualizar_estado_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_hoy DATE := CURRENT_DATE;
BEGIN
  IF NEW.es_borrador = true THEN
    NEW.estado := 'borrador';
    RETURN NEW;
  END IF;

  IF NEW.estado IN ('obsoleto', 'pendiente_aprobacion') THEN
    RETURN NEW;
  END IF;

  IF NEW.fecha_vencimiento IS NULL THEN
    NEW.estado := 'vigente';
    RETURN NEW;
  END IF;

  IF NEW.fecha_vencimiento < v_hoy THEN
    NEW.estado := 'vencido';
  ELSIF NEW.fecha_vencimiento <= v_hoy + INTERVAL '7 days' THEN
    NEW.estado := 'por_vencer';
  ELSE
    NEW.estado := 'vigente';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Cron masivo: fn_actualizar_estados_masivo
CREATE OR REPLACE FUNCTION fn_actualizar_estados_masivo()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actualizados INTEGER;
  v_hoy DATE := CURRENT_DATE;
BEGIN
  UPDATE items
  SET estado = CASE
    WHEN fecha_vencimiento < v_hoy                         THEN 'vencido'::estado_item
    WHEN fecha_vencimiento <= v_hoy + INTERVAL '7 days'   THEN 'por_vencer'::estado_item
    ELSE 'vigente'::estado_item
  END
  WHERE
    fecha_vencimiento IS NOT NULL
    AND es_borrador = false
    AND estado NOT IN ('obsoleto', 'pendiente_aprobacion')
    AND estado != CASE
      WHEN fecha_vencimiento < v_hoy                       THEN 'vencido'::estado_item
      WHEN fecha_vencimiento <= v_hoy + INTERVAL '7 days' THEN 'por_vencer'::estado_item
      ELSE 'vigente'::estado_item
    END;

  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  RETURN v_actualizados;
END;
$$;

-- 3. Función renovar: fn_renovar_item
CREATE OR REPLACE FUNCTION fn_renovar_item(
  p_item_id UUID,
  p_archivo_url TEXT,
  p_nombre_archivo TEXT,
  p_tamaño_bytes BIGINT,
  p_comentario TEXT DEFAULT NULL
)
RETURNS items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item items%ROWTYPE;
  v_nueva_version INTEGER;
  v_nueva_emision DATE := CURRENT_DATE;
  v_nuevo_vencimiento DATE;
  v_nuevo_estado estado_item;
BEGIN
  SELECT * INTO v_item FROM items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item no encontrado: %', p_item_id;
  END IF;

  v_nueva_version := v_item.version_actual + 1;

  IF v_item.frecuencia_dias IS NOT NULL THEN
    v_nuevo_vencimiento := v_nueva_emision + (v_item.frecuencia_dias || ' days')::INTERVAL;
  ELSE
    v_nuevo_vencimiento := v_item.fecha_vencimiento;
  END IF;

  IF v_item.requiere_aprobacion THEN
    v_nuevo_estado := 'pendiente_aprobacion';
  ELSIF v_nuevo_vencimiento IS NULL THEN
    v_nuevo_estado := 'vigente';
  ELSIF v_nuevo_vencimiento < CURRENT_DATE THEN
    v_nuevo_estado := 'vencido';
  ELSIF v_nuevo_vencimiento <= CURRENT_DATE + INTERVAL '7 days' THEN
    v_nuevo_estado := 'por_vencer';
  ELSE
    v_nuevo_estado := 'vigente';
  END IF;

  UPDATE items SET
    version_actual    = v_nueva_version,
    fecha_emision     = v_nueva_emision,
    fecha_vencimiento = v_nuevo_vencimiento,
    estado            = v_nuevo_estado,
    updated_at        = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  INSERT INTO archivos (
    item_id, version, archivo_url, nombre_archivo, tamaño_bytes, subido_por, comentario
  ) VALUES (
    p_item_id, v_nueva_version, p_archivo_url, p_nombre_archivo,
    p_tamaño_bytes, auth.uid(), p_comentario
  );

  INSERT INTO historial (item_id, accion, usuario_id, detalle)
  VALUES (
    p_item_id,
    'renovacion',
    auth.uid(),
    jsonb_build_object(
      'version_anterior', v_nueva_version - 1,
      'version_nueva', v_nueva_version,
      'fecha_emision', v_nueva_emision,
      'fecha_vencimiento', v_nuevo_vencimiento,
      'estado_nuevo', v_nuevo_estado,
      'archivo', p_nombre_archivo
    )
  );

  RETURN v_item;
END;
$$;

-- 4. Función aprobar: fn_aprobar_item
CREATE OR REPLACE FUNCTION fn_aprobar_item(
  p_item_id UUID,
  p_aprobar BOOLEAN,
  p_comentario TEXT DEFAULT NULL
)
RETURNS items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item items%ROWTYPE;
  v_nuevo_estado estado_item;
  v_accion accion_historial;
  v_version_archivo INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Solo el administrador puede aprobar items';
  END IF;

  SELECT * INTO v_item FROM items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item no encontrado: %', p_item_id;
  END IF;

  IF v_item.estado != 'pendiente_aprobacion' THEN
    RAISE EXCEPTION 'El item no está pendiente de aprobación';
  END IF;

  IF p_aprobar THEN
    v_accion := 'aprobacion';
    IF v_item.fecha_vencimiento IS NULL THEN
      v_nuevo_estado := 'vigente';
    ELSIF v_item.fecha_vencimiento < CURRENT_DATE THEN
      v_nuevo_estado := 'vencido';
    ELSIF v_item.fecha_vencimiento <= CURRENT_DATE + INTERVAL '7 days' THEN
      v_nuevo_estado := 'por_vencer';
    ELSE
      v_nuevo_estado := 'vigente';
    END IF;

    UPDATE items SET
      estado = v_nuevo_estado,
      updated_at = NOW()
    WHERE id = p_item_id
    RETURNING * INTO v_item;

    SELECT version INTO v_version_archivo FROM archivos WHERE item_id = p_item_id ORDER BY version DESC LIMIT 1;
    UPDATE archivos SET
      aprobado_por = auth.uid(),
      aprobado_at = NOW()
    WHERE item_id = p_item_id AND version = v_version_archivo;
  ELSE
    v_accion := 'rechazo';
    v_nuevo_estado := 'vigente';
    UPDATE items SET
      estado = v_nuevo_estado,
      updated_at = NOW()
    WHERE id = p_item_id
    RETURNING * INTO v_item;
  END IF;

  INSERT INTO historial (item_id, accion, usuario_id, detalle)
  VALUES (
    p_item_id, v_accion, auth.uid(),
    jsonb_build_object(
      'estado_nuevo', v_nuevo_estado,
      'comentario', p_comentario,
      'aprobado', p_aprobar
    )
  );

  RETURN v_item;
END;
$$;

-- 5. Vista v_items_con_estado
CREATE OR REPLACE VIEW v_items_con_estado AS
SELECT
  i.*,
  CASE
    WHEN i.es_borrador = true                                       THEN 'borrador'::estado_item
    WHEN i.estado IN ('obsoleto', 'pendiente_aprobacion')          THEN i.estado
    WHEN i.fecha_vencimiento IS NULL                                THEN 'vigente'::estado_item
    WHEN i.fecha_vencimiento < CURRENT_DATE                        THEN 'vencido'::estado_item
    WHEN i.fecha_vencimiento <= CURRENT_DATE + INTERVAL '7 days'  THEN 'por_vencer'::estado_item
    ELSE 'vigente'::estado_item
  END AS estado_calculado,
  CASE
    WHEN i.fecha_vencimiento IS NOT NULL AND i.fecha_vencimiento < CURRENT_DATE
    THEN CURRENT_DATE - i.fecha_vencimiento
    ELSE NULL
  END AS dias_vencido,
  CASE
    WHEN i.fecha_vencimiento IS NOT NULL AND i.fecha_vencimiento >= CURRENT_DATE
    THEN i.fecha_vencimiento - CURRENT_DATE
    ELSE NULL
  END AS dias_hasta_vencimiento
FROM items i;

-- 6. Actualizar todos los estados ahora con el nuevo criterio
SELECT fn_actualizar_estados_masivo();
