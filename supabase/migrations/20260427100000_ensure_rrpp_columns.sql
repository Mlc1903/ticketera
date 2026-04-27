-- Asegurar que las columnas existan en rrpp_assignments
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rrpp_assignments' AND column_name='is_team_leader') THEN
        ALTER TABLE public.rrpp_assignments ADD COLUMN is_team_leader BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rrpp_assignments' AND column_name='created_by') THEN
        ALTER TABLE public.rrpp_assignments ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;

    -- zone_type ya debería existir por la migración 20260323213100_rrpp_zones.sql
    -- pero nos aseguramos de que tenga el constraint correcto si es necesario.
END $$;
