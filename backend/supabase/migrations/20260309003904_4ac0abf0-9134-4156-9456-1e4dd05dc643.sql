
-- Fix storage: make employee-documents private and fix UPDATE policy
UPDATE storage.buckets SET public = false WHERE id = 'employee-documents';

DROP POLICY IF EXISTS "HR/admin can update employee documents" ON storage.objects;
DROP POLICY IF EXISTS "HR/admin/finance can view employee documents" ON storage.objects;
DROP POLICY IF EXISTS "HR/admin can upload employee documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete employee documents" ON storage.objects;

CREATE POLICY "HR/admin/finance can view employee documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'employee-documents' AND
    auth.uid() IS NOT NULL AND
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );

CREATE POLICY "HR/admin can upload employee documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'employee-documents' AND
    auth.uid() IS NOT NULL AND
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

CREATE POLICY "HR/admin can update employee documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'employee-documents' AND
    auth.uid() IS NOT NULL AND
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

CREATE POLICY "Admins can delete employee documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'employee-documents' AND
    auth.uid() IS NOT NULL AND
    is_active_user(auth.uid()) AND
    has_role(auth.uid(), 'admin'::app_role)
  );
