-- Añadir columna de límite de invitados por RRPP
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS rrpp_guests_per_promoter INTEGER DEFAULT 0;
