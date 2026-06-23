-- Agregar tipo_documento
ALTER TABLE items ADD COLUMN IF NOT EXISTS tipo_documento TEXT
  CHECK (tipo_documento IN ('MA', 'PR', 'IT', 'FO', 'RE'));

-- Hacer tipo nullable para no romper inserts sin tipo
ALTER TABLE items ALTER COLUMN tipo DROP NOT NULL;
ALTER TABLE items ALTER COLUMN tipo SET DEFAULT 'documento';

-- Reemplazar trigger de generación de código para usar tipo_documento
CREATE OR REPLACE FUNCTION fn_generar_codigo_item()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_prefijo TEXT;
  v_numero  INT;
  v_codigo  TEXT;
BEGIN
  -- Si ya viene con codigo, solo actualizar codigo_completo
  IF NEW.codigo IS NOT NULL AND NEW.codigo != '' THEN
    NEW.codigo_completo := NEW.clausula_iso || '-' || NEW.codigo;
    RETURN NEW;
  END IF;

  -- Prefijo desde tipo_documento
  v_prefijo := COALESCE(NEW.tipo_documento, 'DOC');

  -- Máximo correlativo para ese prefijo
  SELECT COALESCE(MAX(CAST(SPLIT_PART(codigo, '-', 2) AS INT)), 0) + 1
    INTO v_numero
    FROM items
   WHERE codigo ~ ('^' || v_prefijo || '-[0-9]+$');

  v_codigo := v_prefijo || '-' || LPAD(v_numero::TEXT, 2, '0');

  -- Garantizar unicidad
  WHILE EXISTS (SELECT 1 FROM items WHERE codigo = v_codigo) LOOP
    v_numero := v_numero + 1;
    v_codigo := v_prefijo || '-' || LPAD(v_numero::TEXT, 2, '0');
  END LOOP;

  NEW.codigo := v_codigo;
  NEW.codigo_completo := NEW.clausula_iso || '-' || v_codigo;
  RETURN NEW;
END;
$$;
