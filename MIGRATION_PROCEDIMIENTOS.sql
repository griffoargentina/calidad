-- ============================================================
-- MIGRACIÓN: Módulo Procedimientos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Sectores
CREATE TABLE proc_sectores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  orden INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE proc_sectores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated" ON proc_sectores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Procedimientos
CREATE TABLE proc_procedimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES proc_sectores(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  responsable_id UUID REFERENCES usuarios(id),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE proc_procedimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated" ON proc_procedimientos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Revisiones
CREATE TABLE proc_revisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedimiento_id UUID NOT NULL REFERENCES proc_procedimientos(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  fecha_revision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  archivo_url TEXT,
  archivo_nombre TEXT,
  observaciones TEXT,
  revisado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE proc_revisiones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated" ON proc_revisiones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Sectores por defecto
INSERT INTO proc_sectores (nombre, orden) VALUES
  ('Comercial',    1),
  ('Calidad',      2),
  ('Compras',      3),
  ('Producción',   4),
  ('Logística',    5),
  ('RRHH',         6),
  ('Diseño',       7),
  ('Mantenimiento',8),
  ('Sistemas',     9);
