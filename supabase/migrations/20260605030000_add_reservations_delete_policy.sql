-- Create policy to allow admins and superadmins to delete reservations
CREATE POLICY "Admins and Superadmins can delete reservations"
  ON public.reservations
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
