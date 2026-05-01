-- Fix: Ensure mesas scan correctly based on zone category,
-- handle missing/legacy zone_table_ids safely,
-- and return 'MESA VIP' to the scanner UI instead of 'Entrada Free Pass'.
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
  v_allowed TEXT[];
  v_ticket_category_to_check TEXT;
  v_zone_category TEXT;
  v_rrpp_zone TEXT;
  v_is_allowed BOOLEAN;
  v_allowed_type TEXT;
  v_display_ticket_name TEXT;
BEGIN
  -- Get current time in local timezone (America/La_Paz)
  v_now := now() AT TIME ZONE 'America/La_Paz';
  
  -- Find reservation
  SELECT r.id, r.status, r.guest_name, r.type as res_type, r.event_id, r.ticket_type_id, r.zone_table_id, r.rrpp_id
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

  v_display_ticket_name := COALESCE(v_ticket_type.name, coalesce(v_reservation.res_type::text, ''));

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

    -- Determine the ticket's "Effective Category" for scanning purposes
    v_ticket_category_to_check := upper(trim(v_ticket_type.type::text));
    
    -- If it's a mesa (table), check the zone category
    IF v_reservation.res_type = 'mesa_vip' THEN
      v_zone_category := 'general'; -- Default to general
      IF v_reservation.zone_table_id IS NOT NULL THEN
        BEGIN
          SELECT category::text INTO v_zone_category 
          FROM public.organization_zones 
          WHERE id = split_part(v_reservation.zone_table_id, ':', 1)::uuid;
        EXCEPTION WHEN OTHERS THEN
          v_zone_category := 'general';
        END;
      END IF;
      
      IF COALESCE(v_zone_category, 'general') = 'general' THEN
        v_ticket_category_to_check := 'GENERAL';
        v_display_ticket_name := 'MESA - GENERAL';
      ELSIF v_zone_category = 'vip' THEN
        v_ticket_category_to_check := 'VIP';
        v_display_ticket_name := 'MESA - VIP';
      END IF;

    -- If it has an RRPP, check the RRPP's zone assignment
    ELSIF v_reservation.rrpp_id IS NOT NULL THEN
      BEGIN
        SELECT zone_type::text INTO v_rrpp_zone
        FROM public.rrpp_assignments
        WHERE user_id = v_reservation.rrpp_id 
          AND organization_id = v_event.organization_id;
        
        IF v_rrpp_zone = 'vip' THEN
          v_ticket_category_to_check := 'VIP';
          IF v_reservation.res_type = 'rrpp_free' THEN v_display_ticket_name := 'Pase VIP (RRPP)'; END IF;
        ELSIF v_rrpp_zone = 'general' THEN
          v_ticket_category_to_check := 'GENERAL';
          IF v_reservation.res_type = 'rrpp_free' THEN v_display_ticket_name := 'Pase General (RRPP)'; END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- fallback silently
      END;
    END IF;

    -- Check if allowed
    IF v_scanner.allowed_ticket_types IS NOT NULL AND array_length(v_scanner.allowed_ticket_types, 1) > 0 THEN
      v_is_allowed := false;
      v_allowed := v_scanner.allowed_ticket_types;
      
      FOREACH v_allowed_type IN ARRAY v_allowed
      LOOP
        IF upper(trim(v_allowed_type)) = upper(trim(v_ticket_category_to_check)) OR
           upper(trim(v_allowed_type)) = upper(trim(v_ticket_type.name)) OR
           upper(trim(v_allowed_type)) = upper(trim(v_ticket_type.type::text)) THEN
           v_is_allowed := true;
           EXIT;
        END IF;
        
        -- If scanner allows 'GENERAL', also allow 'NORMAL' and public 'RRPP_FREE' type tickets
        IF upper(trim(v_allowed_type)) = 'GENERAL' AND v_ticket_category_to_check IN ('NORMAL', 'RRPP_FREE') THEN
          v_is_allowed := true;
          EXIT;
        END IF;
      END LOOP;

      IF NOT v_is_allowed THEN
        RETURN jsonb_build_object('status', 'ERROR', 'message', 'Entrada no permitida por este acceso (' || v_display_ticket_name || ')');
      END IF;
    END IF;
  END IF;
  
  -- Determine if it's a free ticket subject to early expiration
  -- ONLY client-generated free passes (no rrpp_id) should expire at the free_pass_until time
  -- RRPP-generated passes and mesa tickets should NOT expire early
  v_is_free_ticket := (
    (v_ticket_type.type = 'rrpp_free' OR v_reservation.res_type = 'rrpp_free')
    AND v_reservation.rrpp_id IS NULL
  );
  
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
      'ticketType', v_display_ticket_name
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
    'ticketType', v_display_ticket_name
  );
END;
$$;
