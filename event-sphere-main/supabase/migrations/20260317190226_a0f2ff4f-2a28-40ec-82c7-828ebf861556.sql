
-- 1. Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Create org_members table
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'staff');

CREATE TABLE public.org_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role org_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- 3. Add organization_id to events and rrpp_assignments
ALTER TABLE public.events ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.rrpp_assignments ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 4. Security definer functions
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = _user_id AND organization_id = _org_id)
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role org_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = _user_id AND organization_id = _org_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.org_members WHERE user_id = _user_id
$$;

-- 5. RLS for organizations
CREATE POLICY "Org members can view their organization"
ON public.organizations FOR SELECT TO authenticated
USING (id IN (SELECT public.get_user_org_ids(auth.uid())) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert organizations"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Org owners and super admins can update organizations"
ON public.organizations FOR UPDATE TO authenticated
USING (public.has_org_role(auth.uid(), id, 'owner') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete organizations"
ON public.organizations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- 6. RLS for org_members
CREATE POLICY "Org members can view members of their org"
ON public.org_members FOR SELECT TO authenticated
USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Org admins can manage members"
ON public.org_members FOR INSERT TO authenticated
WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Org admins can update members"
ON public.org_members FOR UPDATE TO authenticated
USING (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Org admins can remove members"
ON public.org_members FOR DELETE TO authenticated
USING (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_role(auth.uid(), 'super_admin'));

-- 7. Update events RLS for org-based access
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

CREATE POLICY "Org admins can insert events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (
  (organization_id IS NOT NULL AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin')))
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Org admins can update events"
ON public.events FOR UPDATE TO authenticated
USING (
  (organization_id IS NOT NULL AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin')))
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Org admins can delete events"
ON public.events FOR DELETE TO authenticated
USING (
  (organization_id IS NOT NULL AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin')))
  OR public.has_role(auth.uid(), 'super_admin')
);

-- 8. Trigger & indexes
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_org_members_user ON public.org_members(user_id);
CREATE INDEX idx_org_members_org ON public.org_members(organization_id);
CREATE INDEX idx_events_org ON public.events(organization_id);
CREATE INDEX idx_rrpp_assignments_org ON public.rrpp_assignments(organization_id);
