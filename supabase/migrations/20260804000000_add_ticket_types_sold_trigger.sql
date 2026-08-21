-- Migration: Add trigger to automatically update ticket_types.sold when reservations are added, updated, or deleted
CREATE OR REPLACE FUNCTION public.update_ticket_type_sold()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle Insert
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.ticket_types
    SET sold = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM public.reservations
      WHERE ticket_type_id = NEW.ticket_type_id
        AND (status = 'active' OR status = 'used')
    )
    WHERE id = NEW.ticket_type_id;
    
  -- Handle Update
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Update new/current ticket type
    UPDATE public.ticket_types
    SET sold = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM public.reservations
      WHERE ticket_type_id = NEW.ticket_type_id
        AND (status = 'active' OR status = 'used')
    )
    WHERE id = NEW.ticket_type_id;

    -- If ticket_type_id changed, update the old one as well
    IF (OLD.ticket_type_id <> NEW.ticket_type_id) THEN
      UPDATE public.ticket_types
      SET sold = (
        SELECT COALESCE(SUM(quantity), 0)
        FROM public.reservations
        WHERE ticket_type_id = OLD.ticket_type_id
          AND (status = 'active' OR status = 'used')
      )
      WHERE id = OLD.ticket_type_id;
    END IF;
    
  -- Handle Delete
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.ticket_types
    SET sold = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM public.reservations
      WHERE ticket_type_id = OLD.ticket_type_id
        AND (status = 'active' OR status = 'used')
    )
    WHERE id = OLD.ticket_type_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_update_ticket_type_sold ON public.reservations;
CREATE TRIGGER trg_update_ticket_type_sold
  AFTER INSERT OR UPDATE OR DELETE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ticket_type_sold();

-- Initial backfill for existing ticket types
UPDATE public.ticket_types tt
SET sold = (
  SELECT COALESCE(SUM(r.quantity), 0)
  FROM public.reservations r
  WHERE r.ticket_type_id = tt.id
    AND (r.status = 'active' OR r.status = 'used')
);
