-- Allow admins and super_admins to insert into rrpp_sales directly
DROP POLICY IF EXISTS "admin insert sales" ON public.rrpp_sales;
CREATE POLICY "admin insert sales" ON public.rrpp_sales
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'super_admin')
    OR rrpp_id = auth.uid()
  );

-- RPC helper for admin to insert a sale for any team leader / rrpp
CREATE OR REPLACE FUNCTION public.admin_add_rrpp_sale(
  _event_id UUID,
  _rrpp_id UUID,
  _seller_name TEXT,
  _items JSONB,
  _quantity INTEGER,
  _amount NUMERIC,
  _delivered BOOLEAN DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.rrpp_sales (event_id, rrpp_id, seller_name, quantity, total_amount, items, delivered)
  VALUES (_event_id, _rrpp_id, trim(_seller_name), _quantity, _amount, coalesce(_items, '{}'::jsonb), coalesce(_delivered, false))
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_rrpp_sale(UUID, UUID, TEXT, JSONB, INTEGER, NUMERIC, BOOLEAN) TO authenticated;
