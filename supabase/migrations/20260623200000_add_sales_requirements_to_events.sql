-- Migration: Add sales goals to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS sales_general_requirement INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_vip_requirement INTEGER DEFAULT 0;
