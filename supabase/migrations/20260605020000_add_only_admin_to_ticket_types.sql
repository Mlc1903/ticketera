-- Add only_admin column to ticket_types
ALTER TABLE public.ticket_types ADD COLUMN only_admin BOOLEAN NOT NULL DEFAULT false;
