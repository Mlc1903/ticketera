-- Remove the strict dependency on event_id
ALTER TABLE public.rrpp_assignments ALTER COLUMN event_id DROP NOT NULL;

-- Remove the old unique constraint (one RRPP per event)
ALTER TABLE public.rrpp_assignments DROP CONSTRAINT IF EXISTS rrpp_assignments_user_id_event_id_key;

-- Add a new unique constraint (one RRPP per organization)
ALTER TABLE public.rrpp_assignments ADD CONSTRAINT rrpp_assignments_user_id_organization_id_key UNIQUE (user_id, organization_id);
