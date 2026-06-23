-- Migration: Drop CHECK constraint on rrpp_assignments.zone_type
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints tc 
        JOIN information_schema.constraint_column_usage ccu 
          ON tc.constraint_name = ccu.constraint_name 
         AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'CHECK' 
          AND tc.table_name = 'rrpp_assignments' 
          AND ccu.column_name = 'zone_type'
    LOOP
        EXECUTE 'ALTER TABLE public.rrpp_assignments DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;
