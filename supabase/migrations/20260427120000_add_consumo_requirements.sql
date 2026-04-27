-- Añadir columnas de requisitos de consumo por rango
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS consumo_general_requirement INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS consumo_vip_requirement INTEGER DEFAULT 0;
