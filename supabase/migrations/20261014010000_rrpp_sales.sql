-- One row per sale registered by an RRPP / Team Leader at "Verificar Pago" time
-- (independent of admin approval)
CREATE TABLE IF NOT EXISTS public.rrpp_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rrpp_id UUID NOT NULL,
  seller_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rrpp_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rrpp insert own sales" ON public.rrpp_sales;
CREATE POLICY "rrpp insert own sales" ON public.rrpp_sales
  FOR INSERT TO authenticated WITH CHECK (rrpp_id = auth.uid());

DROP POLICY IF EXISTS "authenticated read sales" ON public.rrpp_sales;
CREATE POLICY "authenticated read sales" ON public.rrpp_sales
  FOR SELECT TO authenticated USING (true);
