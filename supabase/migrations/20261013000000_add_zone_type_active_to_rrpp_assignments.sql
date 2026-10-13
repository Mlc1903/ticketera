-- Add zone_type_active column to rrpp_assignments table
-- This allows super admins to deactivate a RRPP's zone/rank without removing them
ALTER TABLE rrpp_assignments
  ADD COLUMN IF NOT EXISTS zone_type_active boolean NOT NULL DEFAULT true;
