import type { FilterConfig, FilterOption } from '@shared/hooks/useAdvancedFilter';

/** تكوين فلتر اختيار متعدد (شبكة خانات + «الكل» في الواجهة). */
export function multiSelectFilter(
  key: string,
  label: string,
  options: FilterOption[],
  defaultValues: string[] = []
): FilterConfig {
  return { key, label, type: 'multi_select', options, defaultValues };
}

export function singleSelectFilter(
  key: string,
  label: string,
  options: FilterOption[],
  defaultValues: string[] = []
): FilterConfig {
  return { key, label, type: 'single_select', options, defaultValues };
}

export function dateRangeFilter(key: string, label: string, defaultValues: string[] = ['', '']): FilterConfig {
  return { key, label, type: 'date_range', defaultValues };
}

export function numberRangeFilter(key: string, label: string, defaultValues: string[] = ['', '']): FilterConfig {
  return { key, label, type: 'number_range', defaultValues };
}
