-- Migration: Add buyer_name to purchase_requests table
ALTER TABLE public.purchase_requests ADD COLUMN buyer_name TEXT;
