-- Storage bucket documentos + policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Cualquier usuario autenticado puede subir
CREATE POLICY "documentos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos');

-- Cualquier usuario autenticado puede leer
CREATE POLICY "documentos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos');

-- Cualquier usuario autenticado puede actualizar (upsert)
CREATE POLICY "documentos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos');
