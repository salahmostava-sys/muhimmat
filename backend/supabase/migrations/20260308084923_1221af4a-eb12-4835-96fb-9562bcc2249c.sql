
-- Add brand_color and text_color columns to apps table
ALTER TABLE public.apps 
  ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS text_color TEXT NOT NULL DEFAULT '#ffffff';
