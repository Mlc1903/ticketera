-- Per ticket type quantities: { "<ticket_type_id>": qty, ... }
ALTER TABLE public.rrpp_sales ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.rrpp_sales ADD COLUMN IF NOT EXISTS delivered BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.rrpp_sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Admins can edit / delete
DROP POLICY IF EXISTS "admin update sales" ON public.rrpp_sales;
CREATE POLICY "admin update sales" ON public.rrpp_sales
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "admin delete sales" ON public.rrpp_sales;
CREATE POLICY "admin delete sales" ON public.rrpp_sales
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Register a sale: if the same RRPP name already exists for this TL + event, add to that row
CREATE OR REPLACE FUNCTION public.register_rrpp_sale(
  _event_id UUID,
  _seller_name TEXT,
  _items JSONB,
  _quantity INTEGER,
  _amount NUMERIC
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id UUID;
  _merged JSONB;
  _k TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT id, items INTO _id, _merged FROM public.rrpp_sales
  WHERE event_id = _event_id AND rrpp_id = auth.uid()
    AND lower(trim(coalesce(seller_name, ''))) = lower(trim(coalesce(_seller_name, '')))
  ORDER BY created_at LIMIT 1;

  IF _id IS NULL THEN
    INSERT INTO public.rrpp_sales (event_id, rrpp_id, seller_name, quantity, total_amount, items)
    VALUES (_event_id, auth.uid(), trim(_seller_name), _quantity, _amount, coalesce(_items, '{}'::jsonb))
    RETURNING id INTO _id;
  ELSE
    _merged := coalesce(_merged, '{}'::jsonb);
    FOR _k IN SELECT jsonb_object_keys(coalesce(_items, '{}'::jsonb)) LOOP
      _merged := jsonb_set(_merged, ARRAY[_k],
        to_jsonb(coalesce((_merged->>_k)::int, 0) + (_items->>_k)::int));
    END LOOP;
    UPDATE public.rrpp_sales
      SET quantity = quantity + _quantity,
          total_amount = total_amount + _amount,
          items = _merged,
          delivered = false,
          updated_at = now()
      WHERE id = _id;
  END IF;
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_rrpp_sale(UUID, TEXT, JSONB, INTEGER, NUMERIC) TO authenticated;
