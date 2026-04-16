-- Tabla de solicitudes de compra
CREATE TABLE public.purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  rrpp_id UUID REFERENCES auth.users(id),
  ticket_types JSONB NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', 
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

-- Politicas para Usuarios (pueden crear y ver si el id es de ellos)
CREATE POLICY "Users can create their own purchase requests"
  ON public.purchase_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR auth.uid() = rrpp_id);

CREATE POLICY "Users can view their own purchase requests"
  ON public.purchase_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = rrpp_id);

-- Politica para Administradores
CREATE POLICY "Admins can view and manage all purchase requests"
  ON public.purchase_requests
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
