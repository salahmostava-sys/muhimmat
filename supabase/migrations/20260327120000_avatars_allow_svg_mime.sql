-- Allow SVG logos in public avatars bucket (matches UI accept + validation)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']::text[]
WHERE id = 'avatars';
