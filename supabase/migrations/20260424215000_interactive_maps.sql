-- 1. Create organization_zones table
CREATE TABLE public.organization_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  tables_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_zones ENABLE ROW LEVEL SECURITY;

-- Make zones viewable by everyone so users can select tables
CREATE POLICY "Organization zones are viewable by everyone"
ON public.organization_zones FOR SELECT USING (true);

-- Super admins and org admins/owners can manage zones
CREATE POLICY "Admins can manage organization zones"
ON public.organization_zones FOR ALL TO authenticated
USING (
  public.has_org_role(auth.uid(), organization_id, 'owner') OR 
  public.has_org_role(auth.uid(), organization_id, 'admin') OR 
  public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  public.has_org_role(auth.uid(), organization_id, 'owner') OR 
  public.has_org_role(auth.uid(), organization_id, 'admin') OR 
  public.has_role(auth.uid(), 'super_admin')
);

-- Trigger for updated_at
CREATE TRIGGER update_organization_zones_updated_at 
BEFORE UPDATE ON public.organization_zones 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add zone_table_id to reservations
ALTER TABLE public.reservations 
ADD COLUMN zone_table_id TEXT;
