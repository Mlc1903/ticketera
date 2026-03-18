-- =============================================
-- NitePass Database Schema
-- =============================================

-- Enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'rrpp', 'user');
CREATE TYPE public.ticket_status AS ENUM ('pending', 'active', 'used', 'cancelled');
CREATE TYPE public.ticket_type AS ENUM ('normal', 'vip', 'mesa_vip', 'rrpp_free', 'rrpp_paid');

-- =============================================
-- Profiles table
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- User roles table (separate from profiles for security)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- Events table
-- =============================================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone"
  ON public.events FOR SELECT USING (true);

CREATE POLICY "Admins can insert events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- Ticket types table
-- =============================================
CREATE TABLE public.ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type ticket_type NOT NULL DEFAULT 'normal',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  sold INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ticket types are viewable by everyone"
  ON public.ticket_types FOR SELECT USING (true);

CREATE POLICY "Admins can insert ticket types"
  ON public.ticket_types FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update ticket types"
  ON public.ticket_types FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ticket types"
  ON public.ticket_types FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RRPP assignments
-- =============================================
CREATE TABLE public.rrpp_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  unique_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

ALTER TABLE public.rrpp_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RRPP can see their own assignments"
  ON public.rrpp_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert RRPP assignments"
  ON public.rrpp_assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update RRPP assignments"
  ON public.rrpp_assignments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete RRPP assignments"
  ON public.rrpp_assignments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- Reservations table
-- =============================================
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  status ticket_status NOT NULL DEFAULT 'active',
  user_id UUID REFERENCES auth.users(id),
  rrpp_id UUID REFERENCES auth.users(id),
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id),
  event_id UUID NOT NULL REFERENCES public.events(id),
  guest_name TEXT,
  type ticket_type NOT NULL DEFAULT 'normal',
  quantity INTEGER NOT NULL DEFAULT 1,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reservations for check-in"
  ON public.reservations FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create reservations"
  ON public.reservations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR auth.uid() = rrpp_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins and RRPP can update reservations"
  ON public.reservations FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = rrpp_id);

-- =============================================
-- Auto-create profile and default role on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Updated_at trigger
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Generate unique ticket code function
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_ticket_code(prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN prefix || '-' || result;
END;
$$;
CREATE OR REPLACE FUNCTION public.generate_ticket_code(prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN prefix || '-' || result;
END;
$$;

-- Step 1: Add super_admin to app_role enum (must be committed separately)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

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
