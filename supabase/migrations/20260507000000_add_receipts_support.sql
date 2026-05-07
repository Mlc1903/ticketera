-- Agregar columna receipt_url a la tabla purchase_requests
ALTER TABLE public.purchase_requests
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Insertar bucket "receipts" en supabase storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Crear politicas para el bucket receipts (subir imagenes)
-- Permitir a usuarios autenticados insertar objetos
CREATE POLICY "Users can upload receipts" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'receipts');

-- Permitir a los usuarios leer cualquier receipt (ya que el bucket es public, pero es buena practica)
CREATE POLICY "Users can view receipts" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'receipts');

-- Permitir a admins eliminar receipts
CREATE POLICY "Admins can delete receipts" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'super_admin'));
