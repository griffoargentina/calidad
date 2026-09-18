-- ============================================================
-- MÓDULO SEGURIDAD E HIGIENE + MEDIO AMBIENTE (SEH)
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
CREATE TYPE seh_ambito AS ENUM ('seguridad_higiene', 'medio_ambiente');

CREATE TYPE seh_tipo_vencimiento AS ENUM (
  'fecha_fija',
  'anual',
  'periodico',
  'sin_vencimiento',
  'segun_plan'
);

CREATE TYPE seh_estado AS ENUM (
  'no_corresponde',
  'completado',
  'faltante',
  'vencido',
  'proximo_a_vencer',
  'en_fecha'
);

CREATE TYPE seh_tipo_notificacion AS ENUM (
  'por_vencer_30',
  'por_vencer_7',
  'informe_mensual'
);

-- ── Ubicaciones ────────────────────────────────────────────
CREATE TABLE seh_ubicaciones (
  id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  tipo   TEXT NOT NULL CHECK (tipo IN ('fabrica', 'deposito', 'empresa')),
  activo BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO seh_ubicaciones (nombre, tipo) VALUES
  ('Thompson',   'fabrica'),
  ('Cochabamba', 'deposito'),
  ('Empresa',    'empresa');

-- ── Requisitos (maestro de obligaciones) ───────────────────
CREATE TABLE seh_requisitos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre               TEXT NOT NULL,
  ambito               seh_ambito NOT NULL,
  ubicacion_id         UUID NOT NULL REFERENCES seh_ubicaciones(id),
  norma                TEXT,
  tipo_vencimiento     seh_tipo_vencimiento NOT NULL DEFAULT 'fecha_fija',
  periodicidad_meses   INTEGER CHECK (periodicidad_meses IS NULL OR periodicidad_meses > 0),
  aplica               BOOLEAN NOT NULL DEFAULT true,
  observacion_general  TEXT,
  activo               BOOLEAN NOT NULL DEFAULT true,
  orden                INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Cumplimientos (cada ciclo/instancia) ───────────────────
CREATE TABLE seh_cumplimientos (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisito_id       UUID NOT NULL REFERENCES seh_requisitos(id) ON DELETE CASCADE,
  fecha_vencimiento  DATE,
  fecha_planificada  DATE,
  fecha_realizada    DATE,
  observacion        TEXT,
  responsable_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seh_cumplimientos_requisito ON seh_cumplimientos(requisito_id);
CREATE INDEX idx_seh_cumplimientos_vencimiento ON seh_cumplimientos(fecha_vencimiento) WHERE fecha_vencimiento IS NOT NULL;

-- ── Archivos ───────────────────────────────────────────────
CREATE TABLE seh_archivos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cumplimiento_id  UUID NOT NULL REFERENCES seh_cumplimientos(id) ON DELETE CASCADE,
  nombre_archivo   TEXT NOT NULL,
  storage_path     TEXT NOT NULL,
  subido_por       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  subido_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Log de notificaciones ──────────────────────────────────
CREATE TABLE seh_notificaciones_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cumplimiento_id  UUID REFERENCES seh_cumplimientos(id) ON DELETE SET NULL,
  tipo             seh_tipo_notificacion NOT NULL,
  enviado_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  destinatarios    TEXT NOT NULL
);

-- ── Vista: estado calculado ────────────────────────────────
-- Orden de prioridad:
--   1. aplica = false  → no_corresponde
--   2. fecha_realizada no nula → completado
--   3. fecha_vencimiento nula y no realizada → faltante
--   4. fecha_vencimiento < hoy y no realizada → vencido
--   5. fecha_vencimiento entre hoy y hoy+30 → proximo_a_vencer
--   6. resto → en_fecha
CREATE OR REPLACE VIEW seh_v_estado AS
SELECT
  c.id,
  c.requisito_id,
  c.fecha_vencimiento,
  c.fecha_planificada,
  c.fecha_realizada,
  c.observacion,
  c.responsable_id,
  c.created_at,
  c.updated_at,
  r.nombre,
  r.ambito,
  r.ubicacion_id,
  r.norma,
  r.tipo_vencimiento,
  r.aplica,
  r.observacion_general,
  r.activo,
  r.orden,
  u.nombre AS ubicacion_nombre,
  u.tipo   AS ubicacion_tipo,
  CASE
    WHEN r.aplica = false                                                      THEN 'no_corresponde'::seh_estado
    WHEN c.fecha_realizada IS NOT NULL                                         THEN 'completado'::seh_estado
    WHEN c.fecha_vencimiento IS NULL                                           THEN 'faltante'::seh_estado
    WHEN c.fecha_vencimiento < CURRENT_DATE                                    THEN 'vencido'::seh_estado
    WHEN c.fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days'             THEN 'proximo_a_vencer'::seh_estado
    ELSE                                                                            'en_fecha'::seh_estado
  END AS estado,
  CASE
    WHEN c.fecha_vencimiento IS NOT NULL AND c.fecha_vencimiento < CURRENT_DATE
    THEN CURRENT_DATE - c.fecha_vencimiento
    ELSE NULL
  END AS dias_vencido,
  CASE
    WHEN c.fecha_vencimiento IS NOT NULL AND c.fecha_vencimiento >= CURRENT_DATE
    THEN c.fecha_vencimiento - CURRENT_DATE
    ELSE NULL
  END AS dias_hasta_vencimiento
FROM seh_cumplimientos c
JOIN seh_requisitos r ON r.id = c.requisito_id
JOIN seh_ubicaciones u ON u.id = r.ubicacion_id;

-- ── Trigger: updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_seh_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_seh_cumplimientos_updated_at
BEFORE UPDATE ON seh_cumplimientos
FOR EACH ROW EXECUTE FUNCTION fn_seh_updated_at();
