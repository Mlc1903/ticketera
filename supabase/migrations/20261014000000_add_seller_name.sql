-- Name of the RRPP who made the sale (typed manually at sale time)
ALTER TABLE public.purchase_requests ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS seller_name TEXT;
