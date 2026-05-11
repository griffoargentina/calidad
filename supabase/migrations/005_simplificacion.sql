-- ============================================================
-- QMS Griffo — Simplificación diseño y datos iniciales
-- Ejecutar manualmente en Supabase SQL Editor
-- ============================================================

-- a) Agregar columna codigo_formal a items
ALTER TABLE items ADD COLUMN IF NOT EXISTS codigo_formal text;

-- b) Recrear tipo_item enum (5 subtipos diseño → diseno_desarrollo)
ALTER TABLE items ALTER COLUMN tipo TYPE text;
ALTER TABLE plantillas ALTER COLUMN tipo TYPE text;
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
ALTER TABLE items ALTER COLUMN tipo TYPE tipo_item USING tipo::tipo_item;
ALTER TABLE plantillas ALTER COLUMN tipo TYPE tipo_item USING tipo::tipo_item;

-- c) Actualizar función fn_generar_codigo_item
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
    WHEN 'diseno_desarrollo'     THEN 'DSR'
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

-- d) Agregar sub-cláusulas ISO faltantes
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

-- e) Insertar áreas base
INSERT INTO areas (nombre, activa) VALUES
  ('Dirección', true),
  ('Calidad', true),
  ('RRHH', true),
  ('Producción', true),
  ('Comercial', true),
  ('Diseño', true),
  ('Compras', true),
  ('Ingeniería', true),
  ('Consultor externo', true)
ON CONFLICT (nombre) DO NOTHING;

-- f) Insertar 28 ítems placeholder (Grupo A)
INSERT INTO items (tipo, clausula_iso, titulo, es_borrador) VALUES
  ('analisis_contexto',       '4.1',   'Análisis de contexto de la organización',        true),
  ('partes_interesadas',      '4.2',   'Partes interesadas y sus requisitos',             true),
  ('alcance_sgc',             '4.3',   'Alcance del SGC',                                 true),
  ('mapa_procesos',           '4.4',   'Mapa de procesos del SGC',                        true),
  ('politica',                '5.1.2', 'Enfoque al cliente',                              true),
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
