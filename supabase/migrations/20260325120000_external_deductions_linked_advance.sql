-- ربط خصم خارجي (مخالفة) بسلفة عند التحويل — بدل الاعتماد على نص الملاحظة فقط
ALTER TABLE public.external_deductions
  ADD COLUMN IF NOT EXISTS linked_advance_id UUID REFERENCES public.advances(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.external_deductions.linked_advance_id IS 'عند تحويل المخالفة لسلفة: معرّف السلفة المنشأة';

CREATE INDEX IF NOT EXISTS idx_external_deductions_linked_advance_id
  ON public.external_deductions(linked_advance_id)
  WHERE linked_advance_id IS NOT NULL;
