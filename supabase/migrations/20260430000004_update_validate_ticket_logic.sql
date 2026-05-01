-- SQL to update validate_ticket RPC
-- Path: d:\event-sphere-main\supabase\migrations\20260430000004_update_validate_ticket_logic.sql

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
    IF COALESCE(v_scanner.organization_id, '00000000-0000-0000-0000-000000000000'::uuid) != COALESCE(v_event.organization_id, '11111111-1111-1111-1111-111111111111'::uuid) THEN
      RETURN jsonb_build_object('status', 'ERROR', 'message', 'Este ticket no pertenece a este local');
    END IF;

    -- Check if ticket type (technical type or name) is allowed for this scanner
    IF v_scanner.allowed_ticket_types IS NOT NULL AND array_length(v_scanner.allowed_ticket_types, 1) > 0 THEN
      IF NOT (v_ticket_type.type::text = ANY(v_scanner.allowed_ticket_types) OR v_ticket_type.name = ANY(v_scanner.allowed_ticket_types)) THEN
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
