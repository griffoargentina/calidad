-- ============================================================
-- QMS Griffo — Simplificación diseño y datos iniciales
-- Ejecutar manualmente en Supabase SQL Editor
-- ============================================================

-- 1. Agregar codigo_formal
ALTER TABLE items ADD COLUMN IF NOT EXISTS codigo_formal text;

-- 2. Eliminar todo lo que depende del enum tipo_item
DROP VIEW IF EXISTS v_items_con_estado;
DROP POLICY IF EXISTS "items_insert" ON items;
DROP POLICY IF EXISTS "items_update" ON items;

-- 3. Quitar el DEFAULT de tipos_habilitados (depende del enum)
ALTER TABLE usuarios ALTER COLUMN tipos_habilitados DROP DEFAULT;

-- 4. Convertir columnas a text para poder borrar el enum
ALTER TABLE items ALTER COLUMN tipo TYPE text;
ALTER TABLE plantillas ALTER COLUMN tipo TYPE text;
ALTER TABLE usuarios ALTER COLUMN tipos_habilitados TYPE text[] USING tipos_habilitados::text[];

-- 5. Borrar y recrear el enum
DROP TYPE IF EXISTS tipo_item;
CREATE TYPE tipo_item AS ENUM (
  'analisis_contexto','partes_interesadas','alcance_sgc','mapa_procesos',
  'politica','roles_responsabilidades','riesgos_oportunidades','objetivo',
  'indicador','infraestructura','instrumento','competencia','capacitacion',
  'procedimiento','instructivo','formulario','registro','manual',
  'diseno_desarrollo',
  'evaluacion_proveedor','producto_no_conforme','satisfaccion_cliente',
  'auditoria_interna','revision_direccion','no_conformidad','accion_correctiva',
  'mejora'
);

-- 6. Restaurar columnas al nuevo enum y reponer el DEFAULT
ALTER TABLE items ALTER COLUMN tipo TYPE tipo_item USING tipo::tipo_item;
ALTER TABLE plantillas ALTER COLUMN tipo TYPE tipo_item USING tipo::tipo_item;
ALTER TABLE usuarios ALTER COLUMN tipos_habilitados TYPE tipo_item[] USING tipos_habilitados::tipo_item[];
ALTER TABLE usuarios ALTER COLUMN tipos_habilitados SET DEFAULT '{}'::tipo_item[];

-- 7. Recrear la vista
CREATE OR REPLACE VIEW v_items_con_estado AS
SELECT
  i.*,
  CASE
    WHEN i.es_borrador = true                                        THEN 'borrador'::estado_item
    WHEN i.estado IN ('obsoleto', 'pendiente_aprobacion')           THEN i.estado
    WHEN i.fecha_vencimiento IS NULL                                 THEN 'vigente'::estado_item
    WHEN i.fecha_vencimiento < CURRENT_DATE                         THEN 'vencido'::estado_item
    WHEN i.fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days'   THEN 'por_vencer'::estado_item
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

-- 8. Recrear las policies
CREATE POLICY "items_insert" ON items
  FOR INSERT
  WITH CHECK (
    is_admin()
    OR (
      is_editor_or_admin()
      AND (
        tipo = ANY(SELECT unnest(tipos_habilitados) FROM usuarios WHERE id = auth.uid())
        OR area_id = (SELECT area_id FROM usuarios WHERE id = auth.uid())
        OR responsable_id = auth.uid()
      )
    )
  );

CREATE POLICY "items_update" ON items
  FOR UPDATE
  USING (
    is_admin()
    OR (
      is_editor_or_admin()
      AND (
        responsable_id = auth.uid()
        OR area_id = (SELECT area_id FROM usuarios WHERE id = auth.uid())
        OR tipo = ANY(SELECT unnest(tipos_habilitados) FROM usuarios WHERE id = auth.uid())
      )
    )
  );

-- 9. Actualizar función fn_generar_codigo_item
CREATE OR REPLACE FUNCTION fn_generar_codigo_item()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_prefijo TEXT;
  v_numero  INTEGER;
  v_codigo  TEXT;
BEGIN
  v_prefijo := CASE NEW.tipo
    WHEN 'analisis_contexto'       THEN 'CTX'
    WHEN 'partes_interesadas'      THEN 'PAR'
    WHEN 'alcance_sgc'             THEN 'ALC'
    WHEN 'mapa_procesos'           THEN 'MAP'
    WHEN 'politica'                THEN 'POL'
    WHEN 'roles_responsabilidades' THEN 'ROL'
    WHEN 'riesgos_oportunidades'   THEN 'RYO'
    WHEN 'objetivo'                THEN 'OBJ'
    WHEN 'indicador'               THEN 'IND'
    WHEN 'infraestructura'         THEN 'INF'
    WHEN 'instrumento'             THEN 'INS'
    WHEN 'competencia'             THEN 'CMP'
    WHEN 'capacitacion'            THEN 'CAP'
    WHEN 'procedimiento'           THEN 'PRO'
    WHEN 'instructivo'             THEN 'INS'
    WHEN 'formulario'              THEN 'FOR'
    WHEN 'registro'                THEN 'REG'
    WHEN 'manual'                  THEN 'MAN'
    WHEN 'diseno_desarrollo'       THEN 'DSR'
    WHEN 'evaluacion_proveedor'    THEN 'EPR'
    WHEN 'producto_no_conforme'    THEN 'PNC'
    WHEN 'satisfaccion_cliente'    THEN 'SAT'
    WHEN 'auditoria_interna'       THEN 'AUD'
    WHEN 'revision_direccion'      THEN 'RDI'
    WHEN 'no_conformidad'          THEN 'NCR'
    WHEN 'accion_correctiva'       THEN 'ACC'
    WHEN 'mejora'                  THEN 'MEJ'
    ELSE 'GEN'
  END;

  IF NEW.codigo IS NOT NULL AND NEW.codigo != '' THEN
    NEW.codigo_completo := NEW.clausula_iso || '-' || NEW.codigo;
    RETURN NEW;
  END IF;

  SELECT COUNT(*) + 1 INTO v_numero FROM items WHERE codigo LIKE v_prefijo || '-%';
  v_codigo := v_prefijo || '-' || LPAD(v_numero::TEXT, 3, '0');

  WHILE EXISTS (SELECT 1 FROM items WHERE codigo = v_codigo) LOOP
    v_numero := v_numero + 1;
    v_codigo := v_prefijo || '-' || LPAD(v_numero::TEXT, 3, '0');
  END LOOP;

  NEW.codigo := v_codigo;
  NEW.codigo_completo := NEW.clausula_iso || '-' || v_codigo;
  RETURN NEW;
END;
$$;

-- 10. Sub-cláusulas ISO faltantes
INSERT INTO clausulas_iso (id, titulo, descripcion) VALUES
  ('5.1.2', 'Enfoque al cliente', 'Requisitos del cliente determinados y satisfacción medida.'),
  ('5.2.1', 'Establecimiento de la política de calidad', 'Política de calidad documentada y apropiada al propósito.'),
  ('5.2.2', 'Comunicación de la política de calidad', 'Política comunicada, entendida y disponible.'),
  ('7.2.1', 'Competencias requeridas', 'Identificación de competencias necesarias para el SGC.'),
  ('7.2.2', 'Plan de formación', 'Planificación de capacitación y desarrollo del personal.'),
  ('7.2.3', 'Registros de capacitación', 'Registros de formación realizadas por persona.'),
  ('7.2.4', 'Evaluación de eficacia de la formación', 'Verificación del resultado de las capacitaciones.'),
  ('7.2.5', 'Evidencias de competencia', 'Evidencia documental de competencias del personal.')
ON CONFLICT (id) DO NOTHING;

-- 11. Áreas base
INSERT INTO areas (nombre, activa)
SELECT nombre, true FROM (VALUES
  ('Dirección'),('Calidad'),('RRHH'),('Producción'),
  ('Comercial'),('Diseño'),('Compras'),('Ingeniería'),
  ('Consultor externo')
) AS v(nombre)
WHERE NOT EXISTS (SELECT 1 FROM areas WHERE areas.nombre = v.nombre);

-- 12. 28 ítems placeholder Grupo A
INSERT INTO items (tipo, clausula_iso, titulo, es_borrador) VALUES
  ('analisis_contexto',       '4.1',   'Análisis de contexto de la organización',        true),
  ('partes_interesadas',      '4.2',   'Partes interesadas y sus requisitos',             true),
  ('alcance_sgc',             '4.3',   'Alcance del SGC',                                 true),
  ('mapa_procesos',           '4.4',   'Mapa de procesos del SGC',                        true),
  ('politica',                '5.1.2', 'Política de calidad — Enfoque al cliente',        true),
  ('politica',                '5.2.1', 'Política de calidad',                             true),
  ('politica',                '5.2.2', 'Comunicación de la política de calidad',          true),
  ('roles_responsabilidades', '5.3',   'Roles, responsabilidades y autoridades',          true),
  ('riesgos_oportunidades',   '6.1',   'Matriz de riesgos y oportunidades',               true),
  ('objetivo',                '6.2',   'Objetivos de calidad',                            true),
  ('procedimiento',           '6.3',   'Control de cambios en el SGC',                    true),
  ('roles_responsabilidades', '7.1.2', 'Gestión de recursos humanos',                     true),
  ('infraestructura',         '7.1.3', 'Plan de infraestructura y mantenimiento',         true),
  ('procedimiento',           '7.1.4', 'Condiciones del ambiente de trabajo',             true),
  ('competencia',             '7.2.1', 'Perfil de competencias requeridas',               true),
  ('capacitacion',            '7.2.2', 'Plan de formación y desarrollo',                  true),
  ('registro',                '7.2.5', 'Evidencias de competencia del personal',          true),
  ('capacitacion',            '7.3',   'Toma de conciencia del SGC',                      true),
  ('procedimiento',           '7.4',   'Plan de comunicación interna y externa',          true),
  ('manual',                  '7.5',   'Manual del Sistema de Gestión de Calidad',        true),
  ('procedimiento',           '8.1',   'Control de planificación operacional',            true),
  ('procedimiento',           '8.2',   'Gestión de requisitos del cliente',               true),
  ('diseno_desarrollo',       '8.3',   'Diseño y desarrollo de productos',                true),
  ('procedimiento',           '8.5',   'Control de producción y prestación del servicio', true),
  ('registro',                '8.6',   'Liberación de productos y servicios',             true),
  ('satisfaccion_cliente',    '9.1.2', 'Medición de satisfacción del cliente',            true),
  ('auditoria_interna',       '9.2',   'Programa de auditorías internas',                 true),
  ('revision_direccion',      '9.3',   'Revisión por la dirección',                       true);
