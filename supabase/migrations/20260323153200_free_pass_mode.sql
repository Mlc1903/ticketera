-- Migration to add Free Pass Mode to events and RPC for ticket validation

ALTER TABLE public.events 
ADD COLUMN is_free_pass BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN free_pass_until TIME;

-- Add checking logic RPC
CREATE OR REPLACE FUNCTION public.validate_ticket(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_event RECORD;
  v_ticket_type RECORD;
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
  SELECT e.date, e.is_free_pass, e.free_pass_until
  INTO v_event
  FROM public.events e
  WHERE e.id = v_reservation.event_id;
  
  -- Get ticket type details
  SELECT t.name, t.type
  INTO v_ticket_type
  FROM public.ticket_types t
  WHERE t.id = v_reservation.ticket_type_id;
  
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
      checked_in_at = now()
  WHERE id = v_reservation.id;
  
  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'message', 'Acceso Permitido',
    'guestName', COALESCE(v_reservation.guest_name, 'Cliente General'),
    'ticketType', COALESCE(v_ticket_type.name, coalesce(v_reservation.res_type::text, ''))
  );
END;
$$;
