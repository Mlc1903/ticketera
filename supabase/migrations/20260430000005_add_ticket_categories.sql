-- Migration to add independent ticket categories for scanners
-- Path: d:\event-sphere-main\supabase\migrations\20260430000005_add_ticket_categories.sql

-- 1. Create ticket categories table
CREATE TABLE public.organization_ticket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE public.organization_ticket_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view categories"
  ON public.organization_ticket_categories FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Org admins can manage categories"
  ON public.organization_ticket_categories FOR ALL TO authenticated
  USING (
    (organization_id IS NOT NULL AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin')))
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 2. Insert some default categories for existing organizations
INSERT INTO public.organization_ticket_categories (organization_id, name)
SELECT id, unnest(ARRAY['GENERAL', 'VIP', 'FREE PASS', 'MESA VIP', 'INVITADO'])
FROM public.organizations
ON CONFLICT DO NOTHING;
