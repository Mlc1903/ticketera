-- Drop the legacy policy that only checks for the admin role
DROP POLICY IF EXISTS "Admins can view and manage all purchase requests" ON public.purchase_requests;

-- Create an updated policy that checks for either admin or super_admin roles
CREATE POLICY "Admins and Superadmins can view and manage all purchase requests"
  ON public.purchase_requests
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
