-- ============================================================
-- QMS Griffo — Functions & Triggers
-- ============================================================

-- ============================================================
-- FUNCIÓN: actualizar estado automáticamente según fecha_vencimiento
-- Corre en INSERT y UPDATE de items
-- ============================================================

CREATE OR REPLACE FUNCTION fn_actualizar_estado_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_hoy DATE := CURRENT_DATE;
BEGIN
  -- No tocar borradores ni obsoletos ni pendiente_aprobacion
  IF NEW.es_borrador = true THEN
    NEW.estado := 'borrador';
    RETURN NEW;
  END IF;

  IF NEW.estado IN ('obsoleto', 'pendiente_aprobacion') THEN
    RETURN NEW;
  END IF;

  -- Sin fecha de vencimiento → vigente
  IF NEW.fecha_vencimiento IS NULL THEN
    NEW.estado := 'vigente';
    RETURN NEW;
  END IF;

  -- Con fecha de vencimiento
  IF NEW.fecha_vencimiento < v_hoy THEN
    NEW.estado := 'vencido';
  ELSIF NEW.fecha_vencimiento <= v_hoy + INTERVAL '30 days' THEN
    NEW.estado := 'por_vencer';
  ELSE
    NEW.estado := 'vigente';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_actualizar_estado_item
  BEFORE INSERT OR UPDATE OF fecha_vencimiento, es_borrador, estado
  ON items
  FOR EACH ROW
  EXECUTE FUNCTION fn_actualizar_estado_item();

-- ============================================================
-- FUNCIÓN: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- FUNCIÓN: generar codigo autogenerado para items
-- Formato: [PREFIJO]-[NRO con 3 dígitos]
-- ============================================================

CREATE OR REPLACE FUNCTION fn_generar_codigo_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefijo TEXT;
  v_numero  INTEGER;
  v_codigo  TEXT;
BEGIN
  -- Mapeo tipo → prefijo de 3 letras
  v_prefijo := CASE NEW.tipo
    WHEN 'analisis_contexto'     THEN 'CTX'
    WHEN 'partes_interesadas'    THEN 'PAR'
    WHEN 'alcance_sgc'           THEN 'ALC'
    WHEN 'mapa_procesos'         THEN 'MAP'
    WHEN 'politica'              THEN 'POL'
    WHEN 'roles_responsabilidades' THEN 'ROL'
    WHEN 'riesgos_oportunidades' THEN 'RYO'
    WHEN 'objetivo'              THEN 'OBJ'
    WHEN 'indicador'             THEN 'IND'
    WHEN 'infraestructura'       THEN 'INF'
    WHEN 'instrumento'           THEN 'INS'
    WHEN 'competencia'           THEN 'CMP'
    WHEN 'capacitacion'          THEN 'CAP'
    WHEN 'procedimiento'         THEN 'PRO'
    WHEN 'instructivo'           THEN 'INS'
    WHEN 'formulario'            THEN 'FOR'
    WHEN 'registro'              THEN 'REG'
    WHEN 'manual'                THEN 'MAN'
    WHEN 'diseno_plan'           THEN 'DPL'
    WHEN 'diseno_entrada'        THEN 'DEN'
    WHEN 'diseno_revision'       THEN 'DRV'
    WHEN 'diseno_salida'         THEN 'DSA'
    WHEN 'diseno_cambio'         THEN 'DCM'
    WHEN 'evaluacion_proveedor'  THEN 'EPR'
    WHEN 'producto_no_conforme'  THEN 'PNC'
    WHEN 'satisfaccion_cliente'  THEN 'SAT'
    WHEN 'auditoria_interna'     THEN 'AUD'
    WHEN 'revision_direccion'    THEN 'RDI'
    WHEN 'no_conformidad'        THEN 'NCR'
    WHEN 'accion_correctiva'     THEN 'ACC'
    WHEN 'mejora'                THEN 'MEJ'
    ELSE 'GEN'
  END;

  -- Si ya viene con codigo, no generar
  IF NEW.codigo IS NOT NULL AND NEW.codigo != '' THEN
    NEW.codigo_completo := NEW.clausula_iso || '-' || NEW.codigo;
    RETURN NEW;
  END IF;

  -- Calcular siguiente número para este prefijo
  SELECT COUNT(*) + 1
  INTO v_numero
  FROM items
  WHERE codigo LIKE v_prefijo || '-%';

  v_codigo := v_prefijo || '-' || LPAD(v_numero::TEXT, 3, '0');

  -- Asegurar unicidad (en caso de concurrencia)
  WHILE EXISTS (SELECT 1 FROM items WHERE codigo = v_codigo) LOOP
    v_numero := v_numero + 1;
    v_codigo := v_prefijo || '-' || LPAD(v_numero::TEXT, 3, '0');
  END LOOP;

  NEW.codigo := v_codigo;
  NEW.codigo_completo := NEW.clausula_iso || '-' || v_codigo;

  RETURN NEW;
END;
$$;

-- Nota: instrumento e instructivo comparten prefijo INS, esto es intencional
-- El codigo_completo los diferencia por cláusula ISO

CREATE TRIGGER trg_generar_codigo_item
  BEFORE INSERT ON items
  FOR EACH ROW
  EXECUTE FUNCTION fn_generar_codigo_item();

-- ============================================================
-- FUNCIÓN: actualizar codigo_completo cuando cambia clausula_iso
-- ============================================================

CREATE OR REPLACE FUNCTION fn_actualizar_codigo_completo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.clausula_iso IS DISTINCT FROM OLD.clausula_iso OR
     NEW.codigo IS DISTINCT FROM OLD.codigo THEN
    NEW.codigo_completo := NEW.clausula_iso || '-' || NEW.codigo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_actualizar_codigo_completo
  BEFORE UPDATE OF clausula_iso, codigo ON items
  FOR EACH ROW
  EXECUTE FUNCTION fn_actualizar_codigo_completo();

-- ============================================================
-- FUNCIÓN: registrar en historial automáticamente
-- ============================================================

CREATE OR REPLACE FUNCTION fn_registrar_historial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_accion accion_historial;
  v_detalle JSONB := '{}';
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_accion := 'alta';
    v_detalle := jsonb_build_object(
      'tipo', NEW.tipo,
      'titulo', NEW.titulo,
      'codigo', NEW.codigo
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_accion := 'edicion';
    v_detalle := jsonb_build_object(
      'campos_modificados', (
        SELECT jsonb_object_agg(key, jsonb_build_object('antes', old_val, 'despues', new_val))
        FROM (
          SELECT
            key,
            OLD_ROW.value AS old_val,
            NEW_ROW.value AS new_val
          FROM jsonb_each(to_jsonb(OLD)) AS OLD_ROW(key, value),
               jsonb_each(to_jsonb(NEW)) AS NEW_ROW(key, value)
          WHERE OLD_ROW.key = NEW_ROW.key
            AND OLD_ROW.value IS DISTINCT FROM NEW_ROW.value
            AND OLD_ROW.key NOT IN ('updated_at')
        ) changes
      )
    );
  END IF;

  INSERT INTO historial (item_id, accion, usuario_id, detalle)
  VALUES (NEW.id, v_accion, auth.uid(), v_detalle);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_historial_items
  AFTER INSERT OR UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION fn_registrar_historial();

-- ============================================================
-- FUNCIÓN: actualizar responsable_id en items cuando cambia
-- el responsable principal de un área (solo los que no tienen override)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_propagar_responsable_area()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo cuando cambia el responsable_id del área
  IF NEW.responsable_id IS DISTINCT FROM OLD.responsable_id THEN
    -- Actualizar items que usan el responsable anterior como default
    -- (Los que tienen override distinto al responsable del área no se tocan)
    UPDATE items
    SET responsable_id = NEW.responsable_id
    WHERE area_id = NEW.id
      AND responsable_id = OLD.responsable_id; -- Tenían el responsable del área (no override)
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_propagar_responsable_area
  AFTER UPDATE OF responsable_id ON areas
  FOR EACH ROW
  EXECUTE FUNCTION fn_propagar_responsable_area();

-- ============================================================
-- FUNCIÓN: cron diario para actualizar estados de items vencidos
-- Se llama también desde Edge Function diaria
-- ============================================================

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
    WHEN fecha_vencimiento < v_hoy                          THEN 'vencido'::estado_item
    WHEN fecha_vencimiento <= v_hoy + INTERVAL '30 days'    THEN 'por_vencer'::estado_item
    ELSE 'vigente'::estado_item
  END
  WHERE
    fecha_vencimiento IS NOT NULL
    AND es_borrador = false
    AND estado NOT IN ('obsoleto', 'pendiente_aprobacion')
    AND estado != CASE
      WHEN fecha_vencimiento < v_hoy                        THEN 'vencido'::estado_item
      WHEN fecha_vencimiento <= v_hoy + INTERVAL '30 days'  THEN 'por_vencer'::estado_item
      ELSE 'vigente'::estado_item
    END;

  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  RETURN v_actualizados;
END;
$$;

-- ============================================================
-- FUNCIÓN: renovar item (Botón "Renovar")
-- Bumps versión, actualiza fechas, maneja aprobación
-- ============================================================

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
  -- Obtener item actual con lock
  SELECT * INTO v_item FROM items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item no encontrado: %', p_item_id;
  END IF;

  v_nueva_version := v_item.version_actual + 1;

  -- Calcular nuevo vencimiento
  IF v_item.frecuencia_dias IS NOT NULL THEN
    v_nuevo_vencimiento := v_nueva_emision + (v_item.frecuencia_dias || ' days')::INTERVAL;
  ELSE
    v_nuevo_vencimiento := v_item.fecha_vencimiento; -- Sin frecuencia, mantiene vencimiento
  END IF;

  -- Determinar nuevo estado
  IF v_item.requiere_aprobacion THEN
    v_nuevo_estado := 'pendiente_aprobacion';
  ELSIF v_nuevo_vencimiento IS NULL THEN
    v_nuevo_estado := 'vigente';
  ELSIF v_nuevo_vencimiento < CURRENT_DATE THEN
    v_nuevo_estado := 'vencido';
  ELSIF v_nuevo_vencimiento <= CURRENT_DATE + INTERVAL '30 days' THEN
    v_nuevo_estado := 'por_vencer';
  ELSE
    v_nuevo_estado := 'vigente';
  END IF;

  -- Actualizar item
  UPDATE items SET
    version_actual    = v_nueva_version,
    fecha_emision     = v_nueva_emision,
    fecha_vencimiento = v_nuevo_vencimiento,
    estado            = v_nuevo_estado,
    updated_at        = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  -- Registrar nuevo archivo
  INSERT INTO archivos (
    item_id, version, archivo_url, nombre_archivo, tamaño_bytes, subido_por, comentario
  ) VALUES (
    p_item_id, v_nueva_version, p_archivo_url, p_nombre_archivo,
    p_tamaño_bytes, auth.uid(), p_comentario
  );

  -- Registrar en historial
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

-- ============================================================
-- FUNCIÓN: aprobar item (Admin)
-- ============================================================

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
  -- Solo admin puede aprobar
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
    -- Calcular estado post-aprobación
    IF v_item.fecha_vencimiento IS NULL THEN
      v_nuevo_estado := 'vigente';
    ELSIF v_item.fecha_vencimiento < CURRENT_DATE THEN
      v_nuevo_estado := 'vencido';
    ELSIF v_item.fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days' THEN
      v_nuevo_estado := 'por_vencer';
    ELSE
      v_nuevo_estado := 'vigente';
    END IF;

    UPDATE items SET
      estado = v_nuevo_estado,
      updated_at = NOW()
    WHERE id = p_item_id
    RETURNING * INTO v_item;

    -- Marcar archivo como aprobado
    SELECT version INTO v_version_archivo FROM archivos WHERE item_id = p_item_id ORDER BY version DESC LIMIT 1;
    UPDATE archivos SET
      aprobado_por = auth.uid(),
      aprobado_at = NOW()
    WHERE item_id = p_item_id AND version = v_version_archivo;

  ELSE
    v_accion := 'rechazo';
    v_nuevo_estado := 'vigente';
    -- Revertir versión: la versión rechazada se descarta
    UPDATE items SET
      version_actual = version_actual - 1,
      estado = v_nuevo_estado,
      updated_at = NOW()
    WHERE id = p_item_id
    RETURNING * INTO v_item;
  END IF;

  -- Registrar en historial
  INSERT INTO historial (item_id, accion, usuario_id, detalle)
  VALUES (
    p_item_id,
    v_accion,
    auth.uid(),
    jsonb_build_object(
      'aprobado', p_aprobar,
      'comentario', p_comentario,
      'estado_nuevo', v_nuevo_estado
    )
  );

  RETURN v_item;
END;
$$;

-- ============================================================
-- VISTA: items con estado actualizado al día
-- ============================================================

CREATE OR REPLACE VIEW v_items_con_estado AS
SELECT
  i.*,
  CASE
    WHEN i.es_borrador = true                                          THEN 'borrador'::estado_item
    WHEN i.estado IN ('obsoleto', 'pendiente_aprobacion')             THEN i.estado
    WHEN i.fecha_vencimiento IS NULL                                   THEN 'vigente'::estado_item
    WHEN i.fecha_vencimiento < CURRENT_DATE                           THEN 'vencido'::estado_item
    WHEN i.fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days'     THEN 'por_vencer'::estado_item
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
  END AS dias_para_vencer
FROM items i;
