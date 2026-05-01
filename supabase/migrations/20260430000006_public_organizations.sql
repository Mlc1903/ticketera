-- Make organizations publicly viewable so that clients can see automated_free_pass setting and org details

DROP POLICY IF EXISTS "Org members can view their organization" ON public.organizations;

CREATE POLICY "Organizations are viewable by everyone" 
ON public.organizations FOR SELECT 
USING (true);
