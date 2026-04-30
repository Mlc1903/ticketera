-- Migration to add automated_free_pass to organizations
-- Path: d:\event-sphere-main\supabase\migrations\20260430000002_add_automated_free_pass.sql

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS automated_free_pass BOOLEAN DEFAULT false;
