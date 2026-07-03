-- Agregar tipo PR (Procedimiento) a la tabla de tipos de documento
INSERT INTO proc_tipos_documento (prefijo, nombre, aplica_a, sectores_validos, orden)
VALUES ('PR', 'Procedimiento', ARRAY['flujograma','instructivo'], NULL, 0)
ON CONFLICT (prefijo) DO NOTHING;
