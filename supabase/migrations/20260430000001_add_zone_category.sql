-- Migration to add category to organization zones
-- Path: d:\event-sphere-main\supabase\migrations\20260430000001_add_zone_category.sql

-- 1. Create zone_category enum
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zone_category') THEN
        CREATE TYPE public.zone_category AS ENUM ('general', 'vip');
    END IF;
END $$;

-- 2. Add category to organization_zones
ALTER TABLE public.organization_zones
ADD COLUMN IF NOT EXISTS category public.zone_category DEFAULT 'general';
