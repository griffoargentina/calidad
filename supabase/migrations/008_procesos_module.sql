-- Drop existing proc_* tables (cascade)
DROP TABLE IF EXISTS proc_revisiones CASCADE;
DROP TABLE IF EXISTS proc_procedimientos CASCADE;
DROP TABLE IF EXISTS proc_sectores CASCADE;

-- Sectores
CREATE TABLE proc_sectores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  privado BOOLEAN NOT NULL DEFAULT false,
  orden INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Many-to-many: sector responsables (editors assigned to sectors)
CREATE TABLE proc_sector_responsables (
  sector_id UUID NOT NULL REFERENCES proc_sectores(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (sector_id, usuario_id)
);

-- Flujogramas (the process diagram — ordered list of steps)
CREATE TABLE proc_flujogramas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES proc_sectores(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  version INT NOT NULL DEFAULT 1,
  estado TEXT NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'historico', 'borrador')),
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Steps (pasos) within a flujograma — ordered list
CREATE TABLE proc_pasos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flujograma_id UUID NOT NULL REFERENCES proc_flujogramas(id) ON DELETE CASCADE,
  orden INT NOT NULL DEFAULT 0,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'proceso' CHECK (tipo IN ('inicio', 'proceso', 'decision', 'fin')),
  descripcion TEXT,
  rama_si INT,   -- orden of the "Sí" branch target for decision steps
  rama_no INT,   -- orden of the "No" branch target for decision steps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sectors that participate in each step
CREATE TABLE proc_paso_sectores (
  paso_id UUID NOT NULL REFERENCES proc_pasos(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES proc_sectores(id) ON DELETE CASCADE,
  PRIMARY KEY (paso_id, sector_id)
);

-- Instructivos (the how-to documents)
CREATE TABLE proc_instructivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES proc_sectores(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  estado TEXT NOT NULL DEFAULT 'pendiente_aprobacion' CHECK (estado IN ('vigente', 'historico', 'pendiente_aprobacion', 'rechazado')),
  responsable_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  url_archivo TEXT,
  nombre_archivo TEXT,
  es_publico BOOLEAN NOT NULL DEFAULT false,
  ultima_revision TIMESTAMPTZ,
  proxima_revision TIMESTAMPTZ,
  aprobado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  aprobado_at TIMESTAMPTZ,
  observaciones_rechazo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Link between pasos and instructivos (1 instructivo per paso max)
CREATE TABLE proc_paso_instructivos (
  paso_id UUID NOT NULL REFERENCES proc_pasos(id) ON DELETE CASCADE,
  instructivo_id UUID NOT NULL REFERENCES proc_instructivos(id) ON DELETE CASCADE,
  PRIMARY KEY (paso_id)  -- only 1 instructivo per paso
);

-- Revision log for instructivos
CREATE TABLE proc_revisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructivo_id UUID NOT NULL REFERENCES proc_instructivos(id) ON DELETE CASCADE,
  revisado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ DEFAULT now(),
  hubo_cambio BOOLEAN NOT NULL DEFAULT false,
  url_archivo TEXT,
  nombre_archivo TEXT,
  observaciones TEXT
);

-- Approval log
CREATE TABLE proc_aprobaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructivo_id UUID NOT NULL REFERENCES proc_instructivos(id) ON DELETE CASCADE,
  version INT NOT NULL,
  aprobado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ DEFAULT now(),
  estado TEXT NOT NULL CHECK (estado IN ('aprobado', 'rechazado')),
  observaciones TEXT
);

-- RLS
ALTER TABLE proc_sectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_sector_responsables ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_flujogramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_pasos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_paso_sectores ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_instructivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_paso_instructivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_revisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE proc_aprobaciones ENABLE ROW LEVEL SECURITY;

-- Sectors: public ones visible to all authenticated; private only to admin + their responsables
CREATE POLICY "proc_sectores_select" ON proc_sectores FOR SELECT TO authenticated
  USING (
    privado = false
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM proc_sector_responsables
      WHERE sector_id = proc_sectores.id AND usuario_id = auth.uid()
    )
  );
CREATE POLICY "proc_sectores_write" ON proc_sectores FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- All other proc tables: authenticated can read, editors/admins can write
CREATE POLICY "proc_sr_select" ON proc_sector_responsables FOR SELECT TO authenticated USING (true);
CREATE POLICY "proc_sr_write" ON proc_sector_responsables FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "proc_fluj_select" ON proc_flujogramas FOR SELECT TO authenticated USING (true);
CREATE POLICY "proc_fluj_write" ON proc_flujogramas FOR ALL TO authenticated USING (is_editor_or_admin()) WITH CHECK (is_editor_or_admin());

CREATE POLICY "proc_pasos_select" ON proc_pasos FOR SELECT TO authenticated USING (true);
CREATE POLICY "proc_pasos_write" ON proc_pasos FOR ALL TO authenticated USING (is_editor_or_admin()) WITH CHECK (is_editor_or_admin());

CREATE POLICY "proc_paso_sectores_select" ON proc_paso_sectores FOR SELECT TO authenticated USING (true);
CREATE POLICY "proc_paso_sectores_write" ON proc_paso_sectores FOR ALL TO authenticated USING (is_editor_or_admin()) WITH CHECK (is_editor_or_admin());

CREATE POLICY "proc_inst_select" ON proc_instructivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "proc_inst_write" ON proc_instructivos FOR ALL TO authenticated USING (is_editor_or_admin()) WITH CHECK (is_editor_or_admin());

CREATE POLICY "proc_paso_inst_select" ON proc_paso_instructivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "proc_paso_inst_write" ON proc_paso_instructivos FOR ALL TO authenticated USING (is_editor_or_admin()) WITH CHECK (is_editor_or_admin());

CREATE POLICY "proc_rev_select" ON proc_revisiones FOR SELECT TO authenticated USING (true);
CREATE POLICY "proc_rev_write" ON proc_revisiones FOR ALL TO authenticated USING (is_editor_or_admin()) WITH CHECK (is_editor_or_admin());

CREATE POLICY "proc_apro_select" ON proc_aprobaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "proc_apro_write" ON proc_aprobaciones FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Seed sectors
INSERT INTO proc_sectores (nombre, privado, orden) VALUES
  ('Dirección', false, 1),
  ('Comercial', false, 2),
  ('Compras', false, 3),
  ('Sistemas', false, 4),
  ('Producción', false, 5),
  ('Logística', false, 6),
  ('Calidad', false, 7),
  ('RRHH', true, 8),
  ('Mantenimiento', false, 9),
  ('Cobranzas', false, 10),
  ('Finanzas', true, 11),
  ('Administración', false, 12),
  ('Costos y precios', false, 13),
  ('Diseño', false, 14)
ON CONFLICT (nombre) DO UPDATE SET orden = EXCLUDED.orden, privado = EXCLUDED.privado;
