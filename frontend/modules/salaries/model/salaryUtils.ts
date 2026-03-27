export const toCityArabicLabel = (city?: string | null) => {
  if (city === 'makkah') return 'مكة';
  if (city === 'jeddah') return 'جدة';
  return '—';
};

export type FastApprovedFilter = 'all' | 'approved' | 'pending';
