import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AttendanceStats from './AttendanceStats';
import attendanceService from '@services/attendanceService';

vi.mock('@app/providers/LanguageContext', () => ({
  useLanguage: () => ({ isRTL: true }),
}));

vi.mock('@services/attendanceService', () => ({
  default: {
    getAttendanceStatusRange: vi.fn(),
    getActiveEmployeesCount: vi.fn(),
  },
}));

describe('AttendanceStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(attendanceService.getActiveEmployeesCount).mockResolvedValue(4);
  });

  it('shows empty state when there is no attendance data', async () => {
    vi.mocked(attendanceService.getAttendanceStatusRange).mockResolvedValue([]);

    render(<AttendanceStats selectedMonth={2} selectedYear={2026} />);

    await waitFor(() => expect(screen.getByText('لا توجد بيانات حضور لهذا الشهر')).toBeInTheDocument());
    expect(screen.getByText('4 مندوب نشط')).toBeInTheDocument();
  });

  it('renders aggregated summary values from attendance records', async () => {
    vi.mocked(attendanceService.getAttendanceStatusRange).mockResolvedValue([
      { date: '2026-03-01', status: 'present' },
      { date: '2026-03-01', status: 'present' },
      { date: '2026-03-01', status: 'late' },
      { date: '2026-03-02', status: 'absent' },
    ]);

    render(<AttendanceStats selectedMonth={2} selectedYear={2026} />);

    await waitFor(() => expect(screen.getByText('ملخص الحضور الشهري')).toBeInTheDocument());
    expect(screen.getByText('حاضر')).toBeInTheDocument();
    expect(screen.getByText('غائب')).toBeInTheDocument();
    expect(screen.getByText('متأخر')).toBeInTheDocument();

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });
});
