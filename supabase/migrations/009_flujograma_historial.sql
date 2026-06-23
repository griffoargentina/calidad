-- Historial de versiones del canvas de un flujograma
CREATE TABLE IF NOT EXISTS proc_flujograma_historial (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flujograma_id UUID NOT NULL REFERENCES proc_flujogramas(id) ON DELETE CASCADE,
  guardado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha         TIMESTAMPTZ NOT NULL DEFAULT now(),
  flow_data     JSONB NOT NULL,
  resumen       TEXT
);

ALTER TABLE proc_flujograma_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flujo_hist_select" ON proc_flujograma_historial
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "flujo_hist_insert" ON proc_flujograma_historial
  FOR INSERT TO authenticated WITH CHECK (is_editor_or_admin());

-- Index for fast lookup by flujograma + date
CREATE INDEX ON proc_flujograma_historial (flujograma_id, fecha DESC);
