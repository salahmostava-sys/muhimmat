
-- Add custom_columns JSONB to apps table
-- Each element: { "key": "col_uuid", "label": "محفظة هنقرستيشن" }
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS custom_columns JSONB DEFAULT '[]'::jsonb;
