-- Add only_admin_exclusive column to ticket_types
ALTER TABLE public.ticket_types ADD COLUMN only_admin_exclusive BOOLEAN NOT NULL DEFAULT false;
