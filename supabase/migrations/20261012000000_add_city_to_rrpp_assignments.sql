-- Add city column to rrpp_assignments table
ALTER TABLE rrpp_assignments
  ADD COLUMN IF NOT EXISTS city text DEFAULT NULL;
