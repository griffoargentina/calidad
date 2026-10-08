-- ============================================================
-- Módulo Mejora Continua (Kaizen)
-- ============================================================

CREATE TABLE mejoras (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              TEXT        NOT NULL UNIQUE, -- MC-2025-001
  titulo              TEXT        NOT NULL,
  sector              TEXT        NOT NULL,
  maquina_equipo      TEXT,
  area_oportunidad    TEXT,
  situacion_antes     TEXT,
  situacion_despues   TEXT,
  accion_tomada       TEXT,
  causa_descripcion   TEXT,
  resultado_cambio    TEXT,
  responsable_nombre  TEXT,
  fecha_implementacion DATE,
  estado              TEXT        NOT NULL DEFAULT 'en_proceso'
                        CHECK (estado IN ('en_proceso', 'implementada')),
  created_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mejoras_fotos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mejora_id      UUID        NOT NULL REFERENCES mejoras(id) ON DELETE CASCADE,
  tipo           TEXT        NOT NULL CHECK (tipo IN ('antes', 'despues')),
  storage_path   TEXT        NOT NULL,
  nombre_archivo TEXT        NOT NULL,
  url            TEXT        NOT NULL,
  subido_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subido_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Auto-generar número correlativo por año
CREATE OR REPLACE FUNCTION generar_numero_mejora()
RETURNS TRIGGER AS $$
DECLARE
  anio      INT;
  siguiente INT;
BEGIN
  anio := EXTRACT(YEAR FROM NOW());
  SELECT COUNT(*) + 1 INTO siguiente
  FROM mejoras
  WHERE numero LIKE 'MC-' || anio || '-%';
  NEW.numero := 'MC-' || anio || '-' || LPAD(siguiente::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mejoras_numero
  BEFORE INSERT ON mejoras
  FOR EACH ROW
  WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION generar_numero_mejora();

-- updated_at automático
CREATE OR REPLACE FUNCTION update_mejoras_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mejoras_updated_at
  BEFORE UPDATE ON mejoras
  FOR EACH ROW EXECUTE FUNCTION update_mejoras_updated_at();

-- Índices
CREATE INDEX idx_mejoras_sector ON mejoras(sector);
CREATE INDEX idx_mejoras_created_by ON mejoras(created_by);
CREATE INDEX idx_mejoras_estado ON mejoras(estado);
CREATE INDEX idx_mejoras_fotos_mejora_id ON mejoras_fotos(mejora_id);

-- RLS (usamos admin client en las APIs, pero habilitamos por buena práctica)
ALTER TABLE mejoras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mejoras_fotos ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden leer
CREATE POLICY "mejoras_select" ON mejoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "mejoras_fotos_select" ON mejoras_fotos FOR SELECT TO authenticated USING (true);

-- Cualquiera puede insertar (el código verifica created_by)
CREATE POLICY "mejoras_insert" ON mejoras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mejoras_fotos_insert" ON mejoras_fotos FOR INSERT TO authenticated WITH CHECK (true);

-- Solo el creador puede actualizar/eliminar (el código también lo verifica)
CREATE POLICY "mejoras_update" ON mejoras FOR UPDATE TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "mejoras_delete" ON mejoras FOR DELETE TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "mejoras_fotos_delete" ON mejoras_fotos FOR DELETE TO authenticated
  USING (subido_by = auth.uid());
