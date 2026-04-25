-- Update reservations foreign key to cascade on delete
ALTER TABLE public.reservations 
DROP CONSTRAINT IF EXISTS reservations_event_id_fkey,
ADD CONSTRAINT reservations_event_id_fkey 
  FOREIGN KEY (event_id) 
  REFERENCES public.events(id) 
  ON DELETE CASCADE;

-- Also update ticket_type_id just in case
ALTER TABLE public.reservations 
DROP CONSTRAINT IF EXISTS reservations_ticket_type_id_fkey,
ADD CONSTRAINT reservations_ticket_type_id_fkey 
  FOREIGN KEY (ticket_type_id) 
  REFERENCES public.ticket_types(id) 
  ON DELETE CASCADE;
