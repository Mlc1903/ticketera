-- Migration to add scanners management and detailed access control
-- Path: d:\event-sphere-main\supabase\migrations\20260430000000_add_scanners.sql

-- 1. Create scanners table
CREATE TABLE public.organization_scanners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  allowed_ticket_types TEXT[], -- NULL or empty means all allowed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_scanners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their scanners"
  ON public.organization_scanners FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Org admins can manage scanners"
  ON public.organization_scanners FOR ALL TO authenticated
  USING (
    (organization_id IS NOT NULL AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin')))
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 2. Add scanner info to reservations
ALTER TABLE public.reservations 
ADD COLUMN validated_by_scanner_id UUID REFERENCES public.organization_scanners(id) ON DELETE SET NULL;

-- 3. Update validate_ticket function
CREATE OR REPLACE FUNCTION public.validate_ticket(p_code TEXT, p_scanner_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_event RECORD;
  v_ticket_type RECORD;
  v_scanner RECORD;
  v_now TIMESTAMP;
  v_expiration TIMESTAMP;
  v_is_free_ticket BOOLEAN;
BEGIN
  -- Get current time in local timezone (America/La_Paz)
  v_now := now() AT TIME ZONE 'America/La_Paz';
  
  -- Find reservation
  SELECT r.id, r.status, r.guest_name, r.type as res_type, r.event_id, r.ticket_type_id
  INTO v_reservation
  FROM public.reservations r
  WHERE r.code = p_code;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'ERROR', 'message', 'Código no encontrado o inválido');
  END IF;
  
  IF v_reservation.status = 'used' THEN
    RETURN jsonb_build_object('status', 'ALREADY_USED', 'message', 'Ticket ya usado');
  END IF;
  
  -- Get event details
  SELECT e.date, e.is_free_pass, e.free_pass_until, e.organization_id
  INTO v_event
  FROM public.events e
  WHERE e.id = v_reservation.event_id;
  
  -- Get ticket type details
  SELECT t.name, t.type
  INTO v_ticket_type
  FROM public.ticket_types t
  WHERE t.id = v_reservation.ticket_type_id;

  -- Validate Scanner if provided
  IF p_scanner_id IS NOT NULL THEN
    SELECT * INTO v_scanner FROM public.organization_scanners WHERE id = p_scanner_id;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object('status', 'ERROR', 'message', 'Escáner no válido');
    END IF;

    -- Check if scanner belongs to the same organization as the event
    IF v_scanner.organization_id != v_event.organization_id THEN
      RETURN jsonb_build_object('status', 'ERROR', 'message', 'Este ticket no pertenece a este local');
    END IF;

    -- Check if ticket type is allowed for this scanner
    IF v_scanner.allowed_ticket_types IS NOT NULL AND array_length(v_scanner.allowed_ticket_types, 1) > 0 THEN
      IF NOT (v_ticket_type.type::text = ANY(v_scanner.allowed_ticket_types)) THEN
        RETURN jsonb_build_object('status', 'ERROR', 'message', 'Entrada no permitida por este acceso');
      END IF;
    END IF;
  END IF;
  
  -- Determine if it's a free ticket
  v_is_free_ticket := (v_ticket_type.type = 'rrpp_free' OR v_reservation.res_type = 'rrpp_free');
  
  -- Calculate expiration in local wall-clock time
  IF v_event.is_free_pass AND v_is_free_ticket AND v_event.free_pass_until IS NOT NULL THEN
    v_expiration := v_event.date + v_event.free_pass_until;
  ELSE
    v_expiration := v_event.date + interval '1 day' + interval '3 hours';
  END IF;
  
  IF v_now > v_expiration THEN
    RETURN jsonb_build_object(
      'status', 'EXPIRED', 
      'message', 'Ticket vencido (Fuera de horario)',
      'guestName', COALESCE(v_reservation.guest_name, 'Cliente General'),
      'ticketType', COALESCE(v_ticket_type.name, coalesce(v_reservation.res_type::text, ''))
    );
  END IF;
  
  -- Mark as used
  UPDATE public.reservations
  SET status = 'used',
      checked_in_at = now(),
      validated_by_scanner_id = p_scanner_id
  WHERE id = v_reservation.id;
  
  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'message', 'Acceso Permitido',
    'guestName', COALESCE(v_reservation.guest_name, 'Cliente General'),
    'ticketType', COALESCE(v_ticket_type.name, coalesce(v_reservation.res_type::text, ''))
  );
END;
$$;
