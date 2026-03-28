import { Label } from '@shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import {
  GlobalTableFilters,
  createDefaultGlobalFilters,
  type GlobalTableFilterState,
  type BranchKey,
} from '@shared/components/table/GlobalTableFilters';

export type EmployeeStatusFilter = 'all' | 'active' | 'inactive' | 'ended';

type EmployeeFiltersProps = Readonly<{
  branch: BranchKey;
  search: string;
  status: EmployeeStatusFilter;
  onStatusChange: (v: EmployeeStatusFilter) => void;
  onFiltersChange: (next: GlobalTableFilterState) => void;
}>;

export function EmployeeFilters({
  branch,
  search,
  status,
  onStatusChange,
  onFiltersChange,
}: EmployeeFiltersProps) {
  return (
    <div className="ds-card p-3 space-y-3">
      <GlobalTableFilters
        value={{
          ...createDefaultGlobalFilters(),
          branch,
          search,
          driverId: 'all',
          platformAppIds: [],
          dateFrom: '',
          dateTo: '',
        }}
        onChange={(next) =>
          onFiltersChange({ ...next, driverId: 'all', platformAppIds: [], dateFrom: '', dateTo: '' })
        }
        onReset={() => onFiltersChange(createDefaultGlobalFilters())}
        options={{
          enableBranch: true,
          enableDriver: false,
          enablePlatform: false,
          enableDateRange: false,
        }}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-xs">الحالة</Label>
        <Select value={status} onValueChange={(v) => onStatusChange(v as EmployeeStatusFilter)}>
          <SelectTrigger className="h-9 w-40 text-sm">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="inactive">غير نشط</SelectItem>
            <SelectItem value="ended">منتهي</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
