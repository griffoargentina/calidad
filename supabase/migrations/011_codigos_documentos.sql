-- Document type catalog
CREATE TABLE IF NOT EXISTS proc_tipos_documento (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefijo  TEXT NOT NULL UNIQUE,   -- IT, HI, FO, DS, PGC, ES
  nombre   TEXT NOT NULL,
  aplica_a TEXT[] NOT NULL DEFAULT '{}',  -- ['instructivo'], ['flujograma'], ['instructivo','flujograma']
  sectores_validos TEXT[],               -- NULL = any; array of abreviaturas
  activo   BOOLEAN NOT NULL DEFAULT true,
  orden    INT NOT NULL DEFAULT 0
);

ALTER TABLE proc_tipos_documento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tipos_doc_select" ON proc_tipos_documento FOR SELECT TO authenticated USING (true);
CREATE POLICY "tipos_doc_admin"  ON proc_tipos_documento FOR ALL    TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Add abreviatura to sectors (to be filled by admin)
ALTER TABLE proc_sectores ADD COLUMN IF NOT EXISTS abreviatura TEXT;

-- Add coding fields to proc_instructivos
ALTER TABLE proc_instructivos
  ADD COLUMN IF NOT EXISTS tipo_doc_id UUID REFERENCES proc_tipos_documento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS codigo      TEXT UNIQUE;

-- Add coding fields to proc_flujogramas
ALTER TABLE proc_flujogramas
  ADD COLUMN IF NOT EXISTS tipo_doc_id UUID REFERENCES proc_tipos_documento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS codigo      TEXT UNIQUE;

-- Seed document types
INSERT INTO proc_tipos_documento (prefijo, nombre, aplica_a, sectores_validos, orden) VALUES
  ('PGC', 'Procedimiento de Gestión de Calidad', ARRAY['flujograma'],                        ARRAY['GEN','PRO','ADM','CAL'], 1),
  ('DS',  'Documento de Sistema',                ARRAY['flujograma','instructivo'],            ARRAY['GEN','PRO','ADM','CAL'], 2),
  ('FO',  'Formulario',                          ARRAY['instructivo'],                         ARRAY['GEN','DEP','MOL','MEZ','EMP','EMB','ARM','ADM','CAL'], 3),
  ('IT',  'Hoja de Instrucción IT',              ARRAY['instructivo'],                         ARRAY['DEP','MOL','MEZ','EMP','EMB','ARM','ADM','CAL'], 4),
  ('HI',  'Hoja de Instrucción',                 ARRAY['instructivo'],                         ARRAY['DEP','MOL','MEZ','EMP','EMB','ARM','ADM'], 5),
  ('ES',  'Especificación',                      ARRAY['instructivo'],                         NULL, 6)
ON CONFLICT (prefijo) DO NOTHING;
