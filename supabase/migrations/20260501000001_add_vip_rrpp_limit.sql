-- Add separate VIP guest limit for RRPP
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS rrpp_vip_guests_per_promoter INTEGER DEFAULT 0;
