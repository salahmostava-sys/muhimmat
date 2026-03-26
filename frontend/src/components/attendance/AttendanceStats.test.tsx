import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AttendanceStats from './AttendanceStats';
import attendanceService from '@services/attendanceService';

vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ isRTL: true }),
}));

vi.mock('recharts', () => {
  const Mock = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Mock,
    BarChart: Mock,
    Bar: Mock,
    XAxis: Mock,
    YAxis: Mock,
    CartesianGrid: Mock,
    Tooltip: Mock,
    Legend: Mock,
    Cell: Mock,
  };
});

vi.mock('@services/attendanceService', () => ({
  default: {
    getAttendanceStatusRange: vi.fn(),
    getActiveEmployeesCount: vi.fn(),
  },
}));

describe('AttendanceStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(attendanceService.getActiveEmployeesCount).mockResolvedValue({
      count: 4,
      error: null,
    } as never);
  });

  it('shows empty state when there is no attendance data', async () => {
    vi.mocked(attendanceService.getAttendanceStatusRange).mockResolvedValue({
      data: [],
      error: null,
    } as never);

    render(<AttendanceStats selectedMonth={2} selectedYear={2026} />);

    await waitFor(() => expect(screen.getByText('لا توجد بيانات حضور لهذا الشهر')).toBeInTheDocument());
    expect(screen.getByText('4 مندوب نشط')).toBeInTheDocument();
  });

  it('renders aggregated summary values from attendance records', async () => {
    vi.mocked(attendanceService.getAttendanceStatusRange).mockResolvedValue({
      data: [
        { date: '2026-03-01', status: 'present' },
        { date: '2026-03-01', status: 'present' },
        { date: '2026-03-01', status: 'late' },
        { date: '2026-03-02', status: 'absent' },
      ],
      error: null,
    } as never);

    render(<AttendanceStats selectedMonth={2} selectedYear={2026} />);

    await waitFor(() => expect(screen.getByText('توزيع الحضور يومياً')).toBeInTheDocument());
    expect(screen.getByText('حاضر')).toBeInTheDocument();
    expect(screen.getByText('غائب')).toBeInTheDocument();
    expect(screen.getByText('متأخر')).toBeInTheDocument();

    // Totals from provided dataset: present=2, absent=1, late=1
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('handles null attendance payload without crashing', async () => {
    vi.mocked(attendanceService.getAttendanceStatusRange).mockResolvedValue({
      data: null,
      error: null,
    } as never);

    render(<AttendanceStats selectedMonth={2} selectedYear={2026} />);

    await waitFor(() => expect(screen.getByText('لا توجد بيانات حضور لهذا الشهر')).toBeInTheDocument());
  });
});
