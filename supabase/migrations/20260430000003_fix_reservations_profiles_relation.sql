-- Migration to fix relationship between reservations and profiles
-- Path: d:\event-sphere-main\supabase\migrations\20260430000003_fix_reservations_profiles_relation.sql

-- Add a foreign key constraint from reservations to profiles to enable PostgREST joins
ALTER TABLE public.reservations 
ADD CONSTRAINT reservations_rrpp_id_fkey_profiles 
FOREIGN KEY (rrpp_id) REFERENCES public.profiles(user_id);
