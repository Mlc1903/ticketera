-- Migración para añadir soporte de zonas de RRPP y límite de mesas por evento

-- 1. Añadimos el tipo de zona a los RRPP asignados
ALTER TABLE public.rrpp_assignments
ADD COLUMN zone_type TEXT CHECK (zone_type IN ('general', 'vip'));

-- 2. Añadimos contadores opcionales de mesas a los eventos
ALTER TABLE public.events
ADD COLUMN general_tables_count INTEGER DEFAULT 0,
ADD COLUMN vip_tables_count INTEGER DEFAULT 0;
