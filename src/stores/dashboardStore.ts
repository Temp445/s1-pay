import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { validateAuth } from './utils/storeUtils';

interface DashboardStatistics {
  totalEmployees: number;
  activeEmployees: number;
  onLeave: number;
  pendingLeaveRequests: number;
  todayAttendanceRate: number;
  currentMonthAttendanceRate: number;
  upcomingHolidays: number;
  pendingPayroll: number;
}

interface DashboardStore {
  statistics: DashboardStatistics | null;
  loading: boolean;
  fetchStatistics: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  statistics: null,
  loading: false,
  fetchStatistics: async () => {
    const auth = await validateAuth();
    if (!auth.isAuthenticated || !auth.tenantId) {
      return;
    }

    set({ loading: true });

    try {
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const lastDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

      // Fetch all employees
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, status')
        .eq('tenant_id', auth.tenantId);

      if (employeesError) throw employeesError;

      const totalEmployees = employees?.length || 0;
      const activeEmployees = employees?.filter(e => e.status === 'Active').length || 0;
      const onLeave = employees?.filter(e => e.status === 'On Leave').length || 0;

      // Fetch pending leave requests
      const { data: leaveRequests, error: leaveError } = await supabase
        .from('leave_requests')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('status', 'Pending');

      if (leaveError) throw leaveError;

      const pendingLeaveRequests = leaveRequests?.length || 0;

      // Fetch today's attendance
      const { data: todayAttendance, error: todayAttendanceError } = await supabase
        .from('attendance_logs')
        .select('employee_id')
        .eq('tenant_id', auth.tenantId)
        .gte('clock_in', today)
        .lt('clock_in', new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0]);

      if (todayAttendanceError) throw todayAttendanceError;

      const todayAttendanceCount = todayAttendance?.length || 0;
      const todayAttendanceRate = activeEmployees > 0
        ? Math.round((todayAttendanceCount / activeEmployees) * 100)
        : 0;

      // Fetch current month's attendance
      const { data: monthAttendance, error: monthAttendanceError } = await supabase
        .from('attendance_logs')
        .select('employee_id, clock_in')
        .eq('tenant_id', auth.tenantId)
        .gte('clock_in', firstDayOfMonth)
        .lte('clock_in', lastDayOfMonth);

      if (monthAttendanceError) throw monthAttendanceError;

      // Calculate unique attendance days per employee
      const workingDaysInMonth = Math.ceil((new Date(lastDayOfMonth).getTime() - new Date(firstDayOfMonth).getTime()) / (1000 * 60 * 60 * 24));
      const expectedAttendance = activeEmployees * workingDaysInMonth;
      const actualAttendance = monthAttendance?.length || 0;
      const currentMonthAttendanceRate = expectedAttendance > 0
        ? Math.round((actualAttendance / expectedAttendance) * 100)
        : 0;

      set({
        statistics: {
          totalEmployees,
          activeEmployees,
          onLeave,
          pendingLeaveRequests,
          todayAttendanceRate,
          currentMonthAttendanceRate,
          upcomingHolidays: 0,
          pendingPayroll: 0,
        },
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching dashboard statistics:', error);
      set({ loading: false });
    }
  },
}));
