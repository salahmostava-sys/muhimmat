import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { GlobalTableFilters, createDefaultGlobalFilters, type GlobalTableFilterState, type BranchKey } from '@shared/components/table/GlobalTableFilters';
import type { FastApprovedFilter } from '@modules/salaries/model/salaryUtils';

export function SalaryFilters(props: Readonly<{
  branch: BranchKey;
  search: string;
  approved: FastApprovedFilter;
  onApprovedChange: (v: FastApprovedFilter) => void;
  onFiltersChange: (next: GlobalTableFilterState) => void;
}>) {
  const { branch, search, approved, onApprovedChange, onFiltersChange } = props;
  return (
    <div className="ds-card p-3 space-y-3">
      <GlobalTableFilters
        value={{
          ...createDefaultGlobalFilters(),
          branch,
          search,
          driverId: 'all',
          platformAppId: 'all',
          dateFrom: '',
          dateTo: '',
        }}
        onChange={(next) => onFiltersChange({ ...next, driverId: 'all', platformAppId: 'all', dateFrom: '', dateTo: '' })}
        onReset={() => onFiltersChange(createDefaultGlobalFilters())}
        options={{
          enableBranch: true,
          enableDriver: false,
          enablePlatform: false,
          enableDateRange: false,
        }}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">الاعتماد</span>
        <Select value={approved} onValueChange={(v) => onApprovedChange(v as FastApprovedFilter)}>
          <SelectTrigger className="h-9 w-44 text-sm">
            <SelectValue placeholder="الكل" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="approved">معتمد</SelectItem>
            <SelectItem value="pending">غير معتمد</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
