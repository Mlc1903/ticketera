-- Migración Fase 3: Toggles y Mejoras

-- Añadir control de invitados RRPP a eventos
ALTER TABLE public.events
ADD COLUMN allow_rrpp_guests BOOLEAN NOT NULL DEFAULT true;

-- Asegurarse de que reservations puede tener rrpp_id y user_id nulo de forma correcta
-- Ya que user_id y rrpp_id son opcionales en el schema original, no requieren alteración de constraint, 
-- pero confirmamos que RLS permita a RRPP insertar sus ventas.
-- El RLS original dice:
-- CREATE POLICY "Authenticated users can create reservations"
--  ON public.reservations FOR INSERT
--  TO authenticated
--  WITH CHECK (auth.uid() = user_id OR auth.uid() = rrpp_id OR public.has_role(auth.uid(), 'admin'));
-- Esto significa que un RRPP puede insertar enviando rrpp_id = auth.uid() y user_id = null.
