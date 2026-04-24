-- Agregar nuevos roles al ENUM 'app_role'
-- Nota: ALTER TYPE ... ADD VALUE no puede ejecutarse dentro de un bloque de transacción estándar en algunas versiones de Postgres, 
-- pero Supabase maneja esto en sus migraciones.

COMMIT;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guardia';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'puerta';
