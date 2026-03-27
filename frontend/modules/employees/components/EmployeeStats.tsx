type EmployeeStatsProps = Readonly<{
  total: number;
  loading: boolean;
}>;

export function EmployeeStats({ total, loading }: EmployeeStatsProps) {
  return (
    <div>
      <h1 className="page-title">الموظفين — قائمة (سريعة)</h1>
      <p className="page-subtitle">{loading ? 'جارٍ التحميل...' : `${total.toLocaleString()} نتيجة`}</p>
    </div>
  );
}
