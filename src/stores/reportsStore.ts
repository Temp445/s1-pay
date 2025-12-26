import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import {
  validateAuth,
  createAuthError,
  createTenantError,
} from './utils/storeUtils';

// Export types from lib for backward compatibility
export type {
  EmployeeBasicReport,
  EmployeeSalaryReport,
  EmployeeTaxReport,
  DepartmentReport,
  MonthlySalaryReport,
  AttendanceReport,
  LeaveReport,
  OvertimeReport,
  TaxDeductionReport,
  ProvidentFundReport,
  InsuranceReport,
  ProfessionalTaxReport,
} from '../lib/reports';

import type {
  EmployeeBasicReport,
  EmployeeSalaryReport,
  EmployeeTaxReport,
  DepartmentReport,
} from '../lib/reports';

interface ReportData {
  data: any[];
  summary?: Record<string, any>;
}

interface ReportsStore {
  employeeMasterReports: Record<string, ReportData>;
  transactionReports: Record<string, ReportData>;
  statutoryReports: Record<string, ReportData>;
  loading: boolean;
  error: string | null;

  // Employee Master Report methods
  fetchEmployeeMasterReport: (subtype: string, filters: any) => Promise<void>;
  getEmployeeBasicReport: (department?: string, employeeId?: string) => Promise<EmployeeBasicReport[]>;
  getEmployeeSalaryReport: (department?: string, employeeId?: string) => Promise<EmployeeSalaryReport[]>;
  getEmployeeTaxReport: (department?: string, employeeId?: string) => Promise<EmployeeTaxReport[]>;
  getDepartmentReport: (departmentFilter?: string) => Promise<DepartmentReport[]>;

  // Transaction Report methods
  fetchTransactionReport: (subtype: string, filters: any) => Promise<void>;

  // Statutory Report methods
  fetchStatutoryReport: (subtype: string, filters: any) => Promise<void>;

  // Utility methods
  reset: () => void;
}

export const useReportsStore = create<ReportsStore>()(
  persist(
    (set, get) => ({
      employeeMasterReports: {},
      transactionReports: {},
      statutoryReports: {},
      loading: false,
      error: null,

      // Employee Master Reports
      fetchEmployeeMasterReport: async (subtype, filters) => {
        set({ loading: true, error: null });

        const auth = await validateAuth();
        if (!auth.isAuthenticated || !auth.tenantId) {
          set({ error: 'Authentication required', loading: false });
          return;
        }

        try {
          const { department, employee } = filters;
          let data: any[] = [];

          switch (subtype) {
            case 'basic':
              data = await get().getEmployeeBasicReport(department, employee);
              break;
            case 'salary':
              data = await get().getEmployeeSalaryReport(department, employee);
              break;
            case 'tax':
              data = await get().getEmployeeTaxReport(department, employee);
              break;
            case 'department':
              data = await get().getDepartmentReport(department);
              break;
            default:
              data = [];
          }

          set(state => ({
            employeeMasterReports: {
              ...state.employeeMasterReports,
              [subtype]: { data, summary: {} }
            },
            loading: false,
            error: null
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch report',
            loading: false
          });
        }
      },

      getEmployeeBasicReport: async (department, employeeId) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated || !auth.tenantId) {
          throw createAuthError();
        }

        let query = supabase
          .from('employees')
          .select('*')
          .eq('tenant_id', auth.tenantId);

        if (department) {
          query = query.eq('department', department);
        }

        if (employeeId) {
          query = query.eq('id', employeeId);
        }

        const { data, error } = await query;

        if (error) {
          throw new Error(error.message);
        }

        return data.map(employee => ({
          employeeId: employee.id,
          employeeCode: employee.employee_code || '-',
          name: employee.name,
          email: employee.email,
          department: employee.department,
          role: employee.role,
          status: employee.status,
          startDate: employee.start_date,
          address: employee.address || '-',
          dateOfBirth: employee.date_of_birth || '-'
        }));
      },

      getEmployeeSalaryReport: async (department, employeeId) => {
        try {
          const auth = await validateAuth();
          if (!auth.isAuthenticated || !auth.tenantId) {
            throw createAuthError();
          }

          let employeeQuery = supabase
            .from('employees')
            .select('id, name, department, employee_code')
            .eq('tenant_id', auth.tenantId);

          if (department) employeeQuery = employeeQuery.eq('department', department);
          if (employeeId) employeeQuery = employeeQuery.eq('id', employeeId);

          const { data: employees, error: employeeError } = await employeeQuery;
          if (employeeError) throw new Error(employeeError.message);

          if (!employees || employees.length === 0) {
            console.warn('No employees found for given filters');
            return [];
          }

          const result: EmployeeSalaryReport[] = [];

          for (const employee of employees) {
            try {
              const { data: salaryStructures, error: structureError } = await supabase
                .from('employee_salary_structures')
                .select(`
              id,
              effective_from,
              effective_to,
              structure:payroll_structures (
                id,
                name
              )
            `)
                .eq('employee_id', employee.id)
                .eq('tenant_id', auth.tenantId)
                .order('effective_from', { ascending: false });

              if (structureError) {
                console.error(`Error fetching salary structure for employee ${employee.id}:`, structureError);
                continue;
              }

              if (!salaryStructures || salaryStructures.length === 0) {
                result.push({
                  employeeId: employee.id,
                  employeeCode: employee.employee_code || '-',
                  name: employee.name,
                  department: employee.department,
                  structureName: 'No Salary Structure',
                  effectiveFrom: '-',
                  effectiveTo: '-',
                  basicSalary: 0,
                  totalEarnings: 0,
                  totalDeductions: 0,
                  netSalary: 0
                });
                continue;
              }

              for (const structure of salaryStructures) {
                try {
                  const { data: payrollData, error: payrollError } = await supabase
                    .from('payroll')
                    .select('*')
                    .eq('employee_id', employee.id)
                    .eq('tenant_id', auth.tenantId)
                    .order('created_at', { ascending: false })
                    .limit(1);

                  if (payrollError) {
                    console.error(`Error fetching payroll for employee ${employee.id}:`, payrollError);
                    continue;
                  }

                  const latestPayroll = payrollData?.[0] || null;

                  result.push({
                    employeeId: employee.id,
                    employeeCode: employee.employee_code || '-',
                    name: employee.name,
                    department: employee.department,
                    structureName: structure.structure?.name || 'Unknown Structure',
                    effectiveFrom: structure.effective_from,
                    effectiveTo: structure.effective_to || 'Current',
                    basicSalary: latestPayroll?.base_salary || 0,
                    totalEarnings: latestPayroll?.base_salary || 0,
                    totalDeductions: latestPayroll?.deductions || 0,
                    netSalary: latestPayroll?.total_amount || 0
                  });
                } catch (innerPayrollErr) {
                  console.error(`Unexpected error in payroll loop for employee ${employee.id}:`, innerPayrollErr);
                }
              }
            } catch (innerStructureErr) {
              console.error(`Unexpected error processing employee ${employee.id}:`, innerStructureErr);
            }
          }

          return result;
        } catch (err) {
          console.error('Error in getEmployeeSalaryReport:', err);
          return [];
        }
      },

      getEmployeeTaxReport: async (department, employeeId) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated || !auth.tenantId) {
          throw createAuthError();
        }

        let employeeQuery = supabase
          .from('employees')
          .select('id, name, department, employee_code')
          .eq('tenant_id', auth.tenantId);

        if (department) {
          employeeQuery = employeeQuery.eq('department', department);
        }

        if (employeeId) {
          employeeQuery = employeeQuery.eq('id', employeeId);
        }

        const { data: employees, error: employeeError } = await employeeQuery;

        if (employeeError) {
          throw new Error(employeeError.message);
        }

        const result: EmployeeTaxReport[] = [];

        for (const employee of employees) {
          const { data: payrollData, error: payrollError } = await supabase
            .from('payroll')
            .select('*')
            .eq('employee_id', employee.id)
            .eq('tenant_id', auth.tenantId)
            .order('created_at', { ascending: false })
            .limit(1);

          if (payrollError) {
            console.error(`Error fetching payroll for employee ${employee.id}:`, payrollError);
            continue;
          }

          const latestPayroll = payrollData && payrollData.length > 0 ? payrollData[0] : null;
          const annualSalary = (latestPayroll?.base_salary || 0) * 12;
          const estimatedTax = annualSalary * 0.2;

          result.push({
            employeeId: employee.id,
            employeeCode: employee.employee_code || '-',
            name: employee.name,
            department: employee.department,
            taxId: `TX${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
            taxCategory: 'Standard',
            taxableIncome: annualSalary,
            exemptions: annualSalary * 0.1,
            deductions: annualSalary * 0.05,
            taxPayable: estimatedTax
          });
        }

        return result;
      },

      getDepartmentReport: async (departmentFilter) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated || !auth.tenantId) {
          throw createAuthError();
        }

        let departmentQuery = supabase
          .from('departments')
          .select('id, name')
          .eq('tenant_id', auth.tenantId);

        if (departmentFilter) {
          departmentQuery = departmentQuery.eq('name', departmentFilter);
        }

        const { data: departments, error: departmentError } = await departmentQuery;

        if (departmentError) {
          throw new Error(departmentError.message);
        }

        const result: DepartmentReport[] = [];

        for (const department of departments) {
          const { data: employees, error: employeeError } = await supabase
            .from('employees')
            .select('id, role')
            .eq('department', department.name)
            .eq('tenant_id', auth.tenantId);

          if (employeeError) {
            console.error(`Error fetching employees for department ${department.name}:`, employeeError);
            continue;
          }

          const employeeIds = employees.map(e => e.id);
          const roles = [...new Set(employees.map(e => e.role))];

          let totalSalary = 0;
          if (employeeIds.length > 0) {
            const { data: payrollData } = await supabase
              .from('payroll')
              .select('employee_id, total_amount')
              .in('employee_id', employeeIds)
              .eq('tenant_id', auth.tenantId);

            if (payrollData && payrollData.length > 0) {
              const latestPayrollPerEmployee = new Map();
              payrollData.forEach(p => {
                if (!latestPayrollPerEmployee.has(p.employee_id)) {
                  latestPayrollPerEmployee.set(p.employee_id, p.total_amount);
                }
              });
              totalSalary = Array.from(latestPayrollPerEmployee.values()).reduce((sum, amt) => sum + (amt || 0), 0);
            }
          }

          result.push({
            departmentId: department.id,
            departmentName: department.name,
            employeeCount: employees.length,
            averageSalary: employees.length > 0 ? totalSalary / employees.length : 0,
            totalSalary: totalSalary,
            roles: roles
          });
        }

        return result;
      },

      // Transaction Reports
      fetchTransactionReport: async (subtype, filters) => {
        set({ loading: true, error: null });

        const auth = await validateAuth();
        if (!auth.isAuthenticated || !auth.tenantId) {
          set({ error: 'Authentication required', loading: false });
          return;
        }

        try {
          const { startDate, endDate, department, employee } = filters;
          let data: any[] = [];
          let summary: Record<string, any> = {};

          switch (subtype) {
            case 'monthly': {
              const result = await get().getMonthlySalaryReport(startDate, endDate, department, employee, auth.tenantId);
              data = result.data;
              summary = result.summary;
              break;
            }
            case 'attendance': {
              const result = await get().getAttendanceReport(startDate, endDate, department, employee, auth.tenantId);
              data = result.data;
              summary = result.summary;
              break;
            }
            case 'leave': {
              const result = await get().getLeaveReport(startDate, endDate, department, employee, auth.tenantId);
              data = result.data;
              summary = result.summary;
              break;
            }
            case 'overtime': {
              const result = await get().getOvertimeReport(startDate, endDate, department, employee, auth.tenantId);
              data = result.data;
              summary = result.summary;
              break;
            }
            case 'bonus': {
              const result = await get().getBonusReport(startDate, endDate, department, employee, auth.tenantId);
              data = result.data;
              summary = result.summary;
              break;
            }
            default:
              data = [];
              summary = {};
          }

          set(state => ({
            transactionReports: {
              ...state.transactionReports,
              [subtype]: { data, summary }
            },
            loading: false,
            error: null
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch transaction report',
            loading: false
          });
        }
      },

      // Helper methods for Transaction Reports
      getMonthlySalaryReport: async (startDate: string, endDate: string, department: string, employeeId: string, tenantId: string) => {
        let query = supabase
          .from('payroll')
          .select(`
        *,
        employee:employees (
          id,
          name,
          department,
          employee_code
        )
      `)
          .eq('tenant_id', tenantId);

        if (startDate && endDate) {
          query = query.gte('period_start', startDate).lte('period_end', endDate);
        }
        if (employeeId) {
          query = query.eq('employee_id', employeeId);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        let filteredData = data;
        if (department) {
          filteredData = data.filter(entry => entry.employee?.department === department);
        }

        const reportData = filteredData.map(entry => ({
          employeeId: entry.employee_id,
          employeeCode: entry.employee?.employee_code || '-',
          name: entry.employee?.name || 'Unknown',
          department: entry.employee?.department || 'Unknown',
          payPeriod: `${new Date(entry.period_start).toLocaleDateString()} - ${new Date(entry.period_end).toLocaleDateString()}`,
          basicSalary: entry.base_salary,
          earnings: entry.base_salary + (entry.bonus || 0),
          deductions: entry.deductions || 0,
          overtimeAmount: (entry.overtime_hours || 0) * (entry.overtime_rate || 0),
          bonus: entry.bonus || 0,
          netAmount: entry.total_amount,
          paymentDate: entry.payment_date ? new Date(entry.payment_date).toLocaleDateString() : '-',
          status: entry.status,
          salary_components: entry.salary_components || [],
          deduction_components: entry.deduction_components || []
        }));

        const summary = {
          totalEmployees: new Set(reportData.map(item => item.employeeId)).size,
          totalSalary: reportData.reduce((sum, item) => sum + item.basicSalary, 0),
          totalEarnings: reportData.reduce((sum, item) => sum + item.earnings, 0),
          totalDeductions: reportData.reduce((sum, item) => sum + item.deductions, 0),
          totalOvertime: reportData.reduce((sum, item) => sum + item.overtimeAmount, 0),
          totalBonus: reportData.reduce((sum, item) => sum + item.bonus, 0),
          totalNetAmount: reportData.reduce((sum, item) => sum + item.netAmount, 0)
        };

        return { data: reportData, summary };
      },

      getAttendanceReport: async (startDate: string, endDate: string, department: string, employeeId: string, tenantId: string) => {
        let employeeQuery = supabase
          .from('employees')
          .select('id, name, department, employee_code')
          .eq('tenant_id', tenantId);

        if (department) employeeQuery = employeeQuery.eq('department', department);
        if (employeeId) employeeQuery = employeeQuery.eq('id', employeeId);

        const { data: employees, error: employeeError } = await employeeQuery;
        if (employeeError) throw new Error(employeeError.message);

        const reportData: any[] = [];

        for (const employee of employees) {
          let attendanceQuery = supabase
            .from('attendance_logs')
            .select('*')
            .eq('employee_id', employee.id)
            .eq('tenant_id', tenantId);

          if (startDate && endDate) {
            attendanceQuery = attendanceQuery.gte('date', startDate).lte('date', endDate);
          }

          const { data: attendanceLogs, error: attendanceError } = await attendanceQuery;
          if (attendanceError) {
            console.error(`Error fetching attendance for employee ${employee.id}:`, attendanceError);
            continue;
          }

          for (const log of attendanceLogs) {
            const clockIn = log.clock_in ? new Date(log.clock_in) : null;
            const clockOut = log.clock_out ? new Date(log.clock_out) : null;
            const workingHours = clockIn && clockOut ? (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) : 0;

            reportData.push({
              employeeId: employee.id,
              employeeCode: employee.employee_code || '-',
              name: employee.name,
              department: employee.department,
              date: log.date,
              status: log.status,
              clockIn: clockIn ? clockIn.toLocaleTimeString() : '-',
              clockOut: clockOut ? clockOut.toLocaleTimeString() : '-',
              workingHours: parseFloat(workingHours.toFixed(2)),
              lateMinutes: 0,
              earlyDepartureMinutes: 0,
              overtimeMinutes: 0
            });
          }
        }

        const summary = {
          totalEmployees: new Set(reportData.map(item => item.employeeId)).size,
          totalAttendanceRecords: reportData.length,
          totalWorkingHours: parseFloat(reportData.reduce((sum, item) => sum + item.workingHours, 0).toFixed(2)),
          averageWorkingHours: parseFloat((reportData.reduce((sum, item) => sum + item.workingHours, 0) / (reportData.length || 1)).toFixed(2))
        };

        return { data: reportData, summary };
      },

      getLeaveReport: async (startDate: string, endDate: string, department: string, employeeId: string, tenantId: string) => {
        let employeeQuery = supabase
          .from('employees')
          .select('id, name, department, employee_code')
          .eq('tenant_id', tenantId);

        if (department) employeeQuery = employeeQuery.eq('department', department);
        if (employeeId) employeeQuery = employeeQuery.eq('id', employeeId);

        const { data: employees, error: employeeError } = await employeeQuery;
        if (employeeError) throw new Error(employeeError.message);

        const reportData: any[] = [];

        for (const employee of employees) {
          const { data: leaveBalances, error: balancesError } = await supabase
            .from('leave_balances')
            .select(`
          *,
          leave_types (
            name
          )
        `)
            .eq('employee_id', employee.id)
            .eq('tenant_id', tenantId)
            .eq('year', new Date().getFullYear());

          if (balancesError) {
            console.error(`Error fetching leave balances for employee ${employee.id}:`, balancesError);
            continue;
          }

          const { data: pendingRequests } = await supabase
            .from('leave_requests')
            .select('leave_type_id, status')
            .eq('employee_id', employee.id)
            .eq('tenant_id', tenantId)
            .eq('status', 'Pending');

          const pendingByType = (pendingRequests || []).reduce((acc, req) => {
            acc[req.leave_type_id] = (acc[req.leave_type_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          for (const balance of leaveBalances) {
            reportData.push({
              employeeId: employee.id,
              employeeCode: employee.employee_code || '-',
              name: employee.name,
              department: employee.department,
              leaveType: balance.leave_types?.name || 'Unknown',
              totalDays: balance.total_days,
              usedDays: balance.used_days,
              remainingDays: balance.total_days - balance.used_days,
              pendingRequests: pendingByType[balance.leave_type_id] || 0
            });
          }
        }

        const summary = {
          totalEmployees: new Set(reportData.map(item => item.employeeId)).size,
          totalLeaveTypes: new Set(reportData.map(item => item.leaveType)).size,
          totalAllocatedDays: reportData.reduce((sum, item) => sum + item.totalDays, 0),
          totalUsedDays: reportData.reduce((sum, item) => sum + item.usedDays, 0),
          totalRemainingDays: reportData.reduce((sum, item) => sum + item.remainingDays, 0),
          totalPendingRequests: reportData.reduce((sum, item) => sum + item.pendingRequests, 0)
        };

        return { data: reportData, summary };
      },

      getOvertimeReport: async (startDate: string, endDate: string, department: string, employeeId: string, tenantId: string) => {
        let query = supabase
          .from('shift_assignments')
          .select(`
        *,
        employee:employees (
          id,
          name,
          department,
          employee_code
        )
      `)
          .eq('tenant_id', tenantId)
          .gt('overtime_minutes', 0);

        if (startDate && endDate) {
          query = query.gte('schedule_date', startDate).lte('schedule_date', endDate);
        }
        if (employeeId) {
          query = query.eq('employee_id', employeeId);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        let filteredData = data;
        if (department) {
          filteredData = data.filter(assignment => assignment.employee?.department === department);
        }

        const { data: payrollData } = await supabase
          .from('payroll')
          .select('employee_id, overtime_rate')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        const overtimeRates = (payrollData || []).reduce((acc, entry) => {
          if (!acc[entry.employee_id]) {
            acc[entry.employee_id] = entry.overtime_rate;
          }
          return acc;
        }, {} as Record<string, number>);

        const reportData = filteredData.map(assignment => {
          const overtimeHours = (assignment.overtime_minutes || 0) / 60;
          const rate = overtimeRates[assignment.employee_id] || 15;
          const amount = overtimeHours * rate;

          return {
            employeeId: assignment.employee_id,
            employeeCode: assignment.employee?.employee_code || '-',
            name: assignment.employee?.name || 'Unknown',
            department: assignment.employee?.department || 'Unknown',
            date: assignment.schedule_date,
            hours: parseFloat(overtimeHours.toFixed(2)),
            rate,
            amount: parseFloat(amount.toFixed(2)),
            status: assignment.status,
            approvedBy: 'System'
          };
        });

        const summary = {
          totalEmployees: new Set(reportData.map(item => item.employeeId)).size,
          totalOvertimeHours: parseFloat(reportData.reduce((sum, item) => sum + item.hours, 0).toFixed(2)),
          totalOvertimeAmount: parseFloat(reportData.reduce((sum, item) => sum + item.amount, 0).toFixed(2)),
          averageOvertimeRate: parseFloat((reportData.reduce((sum, item) => sum + item.rate, 0) / (reportData.length || 1)).toFixed(2))
        };

        return { data: reportData, summary };
      },

      getBonusReport: async (startDate: string, endDate: string, department: string, employeeId: string, tenantId: string) => {
        let query = supabase
          .from('payroll')
          .select(`
        *,
        employee:employees (
          id,
          name,
          department,
          employee_code
        )
      `)
          .eq('tenant_id', tenantId)
          .gt('bonus', 0);

        if (startDate && endDate) {
          query = query.gte('period_start', startDate).lte('period_end', endDate);
        }
        if (employeeId) {
          query = query.eq('employee_id', employeeId);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        let filteredData = data;
        if (department) {
          filteredData = data.filter(entry => entry.employee?.department === department);
        }

        const reportData = filteredData.map(entry => ({
          employeeId: entry.employee_id,
          employeeCode: entry.employee?.employee_code || '-',
          name: entry.employee?.name || 'Unknown',
          department: entry.employee?.department || 'Unknown',
          payPeriod: `${new Date(entry.period_start).toLocaleDateString()} - ${new Date(entry.period_end).toLocaleDateString()}`,
          bonusAmount: entry.bonus,
          bonusType: 'Performance',
          baseSalary: entry.base_salary,
          bonusPercentage: parseFloat(((entry.bonus / entry.base_salary) * 100).toFixed(2)),
          paymentDate: entry.payment_date ? new Date(entry.payment_date).toLocaleDateString() : '-'
        }));

        const summary = {
          totalEmployees: new Set(reportData.map(item => item.employeeId)).size,
          totalBonusAmount: reportData.reduce((sum, item) => sum + item.bonusAmount, 0),
          averageBonusAmount: parseFloat((reportData.reduce((sum, item) => sum + item.bonusAmount, 0) / (reportData.length || 1)).toFixed(2)),
          averageBonusPercentage: parseFloat((reportData.reduce((sum, item) => sum + item.bonusPercentage, 0) / (reportData.length || 1)).toFixed(2))
        };

        return { data: reportData, summary };
      },

      // Statutory Reports
      fetchStatutoryReport: async (subtype, filters) => {
        set({ loading: true, error: null });

        const auth = await validateAuth();
        if (!auth.isAuthenticated || !auth.tenantId) {
          set({ error: 'Authentication required', loading: false });
          return;
        }

        try {
          const { startDate, endDate, department, employee } = filters;
          let data: any[] = [];
          let summary: Record<string, any> = {};

          switch (subtype) {
            case 'taxDeduction': {
              const result = await get().getTaxDeductionReport(startDate, endDate, department, employee, auth.tenantId);
              data = result.data;
              summary = result.summary;
              break;
            }
            case 'providentFund': {
              const result = await get().getProvidentFundReport(startDate, endDate, department, employee, auth.tenantId);
              data = result.data;
              summary = result.summary;
              break;
            }
            case 'insurance': {
              const result = await get().getInsuranceReport(startDate, endDate, department, employee, auth.tenantId);
              data = result.data;
              summary = result.summary;
              break;
            }
            case 'professionalTax': {
              const result = await get().getProfessionalTaxReport(startDate, endDate, department, employee, auth.tenantId);
              data = result.data;
              summary = result.summary;
              break;
            }
            default:
              data = [];
              summary = {};
          }

          set(state => ({
            statutoryReports: {
              ...state.statutoryReports,
              [subtype]: { data, summary }
            },
            loading: false,
            error: null
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch statutory report',
            loading: false
          });
        }
      },

      // Helper methods for Statutory Reports
      getTaxDeductionReport: async (startDate: string, endDate: string, department: string, employeeId: string, tenantId: string) => {
        let employeeQuery = supabase
          .from('employees')
          .select('id, name, department, employee_code')
          .eq('tenant_id', tenantId);

        if (department) employeeQuery = employeeQuery.eq('department', department);
        if (employeeId) employeeQuery = employeeQuery.eq('id', employeeId);

        const { data: employees, error: employeeError } = await employeeQuery;
        if (employeeError) throw new Error(employeeError.message);

        const reportData: any[] = [];

        for (const employee of employees) {
          let payrollQuery = supabase
            .from('payroll')
            .select('*')
            .eq('employee_id', employee.id)
            .eq('tenant_id', tenantId)
            .order('period_start', { ascending: true });

          if (startDate && endDate) {
            payrollQuery = payrollQuery.gte('period_start', startDate).lte('period_end', endDate);
          }

          const { data: payrollEntries, error: payrollError } = await payrollQuery;
          if (payrollError) {
            console.error(`Error fetching payroll for employee ${employee.id}:`, payrollError);
            continue;
          }

          const extractTDSAmount = (deductionComponents: any[]): number => {
            if (!Array.isArray(deductionComponents)) return 0;

            const tdsComponent = deductionComponents.find((comp: any) => {
              const componentName = (comp.name || '').toLowerCase();
              return (
                componentName.includes('tds') ||
                componentName.includes('tax deducted at source') ||
                componentName.includes('income tax') ||
                componentName.includes('tax deduction')
              );
            });

            return tdsComponent?.amount || 0;
          };

          const taxPeriods = payrollEntries.reduce((acc, entry) => {
            const periodStart = new Date(entry.period_start);
            const period = `${periodStart.getFullYear()}-${(periodStart.getMonth() + 1).toString().padStart(2, '0')}`;

            if (!acc[period]) {
              acc[period] = { taxableIncome: 0, taxDeducted: 0 };
            }

            const tdsAmount = extractTDSAmount(entry.deduction_components);

            const totalEarnings = Array.isArray(entry.salary_components)
              ? entry.salary_components.reduce((sum: number, comp: any) => sum + (comp.amount || 0), 0)
              : entry.base_salary || 0;

            acc[period].taxableIncome += totalEarnings;
            acc[period].taxDeducted += tdsAmount;

            return acc;
          }, {} as Record<string, { taxableIncome: number, taxDeducted: number }>);

          let cumulativeTax = 0;

          for (const [period, data] of Object.entries(taxPeriods)) {
            cumulativeTax += data.taxDeducted;

            reportData.push({
              employeeId: employee.id,
              employeeCode: employee.employee_code || '-',
              name: employee.name,
              department: employee.department,
              taxPeriod: period,
              taxableIncome: parseFloat(data.taxableIncome.toFixed(2)),
              taxDeducted: parseFloat(data.taxDeducted.toFixed(2)),
              cumulativeTax: parseFloat(cumulativeTax.toFixed(2))
            });
          }
        }

        const summary = {
          totalEmployees: new Set(reportData.map(item => item.employeeId)).size,
          totalTaxableIncome: parseFloat(reportData.reduce((sum, item) => sum + item.taxableIncome, 0).toFixed(2)),
          totalTaxDeducted: parseFloat(reportData.reduce((sum, item) => sum + item.taxDeducted, 0).toFixed(2)),
          averageTaxRate: reportData.reduce((sum, item) => sum + item.taxableIncome, 0) > 0
            ? parseFloat(((reportData.reduce((sum, item) => sum + item.taxDeducted, 0) / reportData.reduce((sum, item) => sum + item.taxableIncome, 0)) * 100).toFixed(2))
            : 0
        };

        return { data: reportData, summary };
      },

      getProvidentFundReport: async (startDate: string, endDate: string, department: string, employeeId: string, tenantId: string) => {
        let employeeQuery = supabase
          .from('employees')
          .select('id, name, department, employee_code')
          .eq('tenant_id', tenantId);

        if (department) employeeQuery = employeeQuery.eq('department', department);
        if (employeeId) employeeQuery = employeeQuery.eq('id', employeeId);

        const { data: employees, error: employeeError } = await employeeQuery;
        if (employeeError) throw new Error(employeeError.message);

        const reportData: any[] = [];

        const extractPFContributions = (deductionComponents: any[]): { employee: number; employer: number } => {
          if (!Array.isArray(deductionComponents)) return { employee: 0, employer: 0 };

          const employeePFComponent = deductionComponents.find((comp: any) => {
            const componentName = (comp.name || '').toLowerCase();
            return (
              (componentName.includes('pf') || componentName.includes('provident fund')) &&
              (componentName.includes('employee') || componentName.includes('emp'))
            );
          });

          const employerPFComponent = deductionComponents.find((comp: any) => {
            const componentName = (comp.name || '').toLowerCase();
            return (
              (componentName.includes('pf') || componentName.includes('provident fund')) &&
              (componentName.includes('employer') || componentName.includes('company'))
            );
          });

          const singlePFComponent = deductionComponents.find((comp: any) => {
            const componentName = (comp.name || '').toLowerCase();
            return (
              (componentName.includes('pf') || componentName.includes('provident fund')) &&
              !componentName.includes('employee') &&
              !componentName.includes('employer') &&
              !componentName.includes('emp') &&
              !componentName.includes('company')
            );
          });

          let employeeContribution = employeePFComponent?.amount || 0;
          let employerContribution = employerPFComponent?.amount || 0;

          if (!employeeContribution && !employerContribution && singlePFComponent) {
            employeeContribution = singlePFComponent.amount || 0;
            employerContribution = singlePFComponent.amount || 0;
          }

          return { employee: employeeContribution, employer: employerContribution };
        };

        for (const employee of employees) {
          let payrollQuery = supabase
            .from('payroll')
            .select('*')
            .eq('employee_id', employee.id)
            .eq('tenant_id', tenantId)
            .order('period_start', { ascending: true });

          if (startDate && endDate) {
            payrollQuery = payrollQuery.gte('period_start', startDate).lte('period_end', endDate);
          }

          const { data: payrollEntries, error: payrollError } = await payrollQuery;
          if (payrollError) {
            console.error(`Error fetching payroll for employee ${employee.id}:`, payrollError);
            continue;
          }

          const contributionPeriods = payrollEntries.reduce((acc, entry) => {
            const periodStart = new Date(entry.period_start);
            const period = `${periodStart.getFullYear()}-${(periodStart.getMonth() + 1).toString().padStart(2, '0')}`;

            if (!acc[period]) {
              acc[period] = { employeeContribution: 0, employerContribution: 0 };
            }

            const pfContributions = extractPFContributions(entry.deduction_components);
            acc[period].employeeContribution += pfContributions.employee;
            acc[period].employerContribution += pfContributions.employer;

            return acc;
          }, {} as Record<string, { employeeContribution: number; employerContribution: number }>);

          let cumulativeBalance = 0;

          for (const [period, data] of Object.entries(contributionPeriods)) {
            const employeeContribution = data.employeeContribution;
            const employerContribution = data.employerContribution;
            const totalContribution = employeeContribution + employerContribution;

            cumulativeBalance += totalContribution;

            reportData.push({
              employeeId: employee.id,
              employeeCode: employee.employee_code || '-',
              name: employee.name,
              department: employee.department,
              contributionPeriod: period,
              employeeContribution: parseFloat(employeeContribution.toFixed(2)),
              employerContribution: parseFloat(employerContribution.toFixed(2)),
              totalContribution: parseFloat(totalContribution.toFixed(2)),
              cumulativeBalance: parseFloat(cumulativeBalance.toFixed(2))
            });
          }
        }

        const summary = {
          totalEmployees: new Set(reportData.map(item => item.employeeId)).size,
          totalEmployeeContribution: parseFloat(reportData.reduce((sum, item) => sum + item.employeeContribution, 0).toFixed(2)),
          totalEmployerContribution: parseFloat(reportData.reduce((sum, item) => sum + item.employerContribution, 0).toFixed(2)),
          totalContribution: parseFloat(reportData.reduce((sum, item) => sum + item.totalContribution, 0).toFixed(2)),
          totalCumulativeBalance: parseFloat(reportData.reduce((sum, item) => Math.max(sum, item.cumulativeBalance), 0).toFixed(2))
        };

        return { data: reportData, summary };
      },

      getInsuranceReport: async (startDate: string, endDate: string, department: string, employeeId: string, tenantId: string) => {
        let employeeQuery = supabase
          .from('employees')
          .select('id, name, department, employee_code')
          .eq('tenant_id', tenantId);

        if (department) employeeQuery = employeeQuery.eq('department', department);
        if (employeeId) employeeQuery = employeeQuery.eq('id', employeeId);

        const { data: employees, error: employeeError } = await employeeQuery;
        if (employeeError) throw new Error(employeeError.message);

        const reportData: any[] = [];

        for (const employee of employees) {
          const { data: payrollData } = await supabase
            .from('payroll')
            .select('base_salary')
            .eq('employee_id', employee.id)
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(1);

          const baseSalary = payrollData && payrollData.length > 0 ? payrollData[0].base_salary : 50000;

          reportData.push({
            employeeId: employee.id,
            employeeCode: employee.employee_code || '-',
            name: employee.name,
            department: employee.department,
            insuranceType: 'Health Insurance',
            coverageAmount: baseSalary * 10,
            premiumAmount: baseSalary * 0.05,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            beneficiaries: 'Self + Family'
          });
        }

        const summary = {
          totalEmployees: reportData.length,
          totalCoverageAmount: reportData.reduce((sum, item) => sum + item.coverageAmount, 0),
          totalPremiumAmount: reportData.reduce((sum, item) => sum + item.premiumAmount, 0),
          averageCoverageAmount: parseFloat((reportData.reduce((sum, item) => sum + item.coverageAmount, 0) / (reportData.length || 1)).toFixed(2))
        };

        return { data: reportData, summary };
      },

      getProfessionalTaxReport: async (startDate: string, endDate: string, department: string, employeeId: string, tenantId: string) => {
        let employeeQuery = supabase
          .from('employees')
          .select('id, name, department, employee_code')
          .eq('tenant_id', tenantId);

        if (department) employeeQuery = employeeQuery.eq('department', department);
        if (employeeId) employeeQuery = employeeQuery.eq('id', employeeId);

        const { data: employees, error: employeeError } = await employeeQuery;
        if (employeeError) throw new Error(employeeError.message);

        const reportData: any[] = [];

        const extractProfessionalTaxAmount = (deductionComponents: any[]): number => {
          if (!Array.isArray(deductionComponents)) return 0;

          const ptComponent = deductionComponents.find((comp: any) => {
            const componentName = (comp.name || '').toLowerCase();
            return (
              componentName.includes('professional tax') ||
              componentName.includes('pt') ||
              componentName.includes('prof tax') ||
              componentName.includes('p tax') ||
              componentName.includes('p.tax')
            );
          });

          return ptComponent?.amount || 0;
        };

        for (const employee of employees) {
          let payrollQuery = supabase
            .from('payroll')
            .select('*')
            .eq('employee_id', employee.id)
            .eq('tenant_id', tenantId);

          if (startDate && endDate) {
            payrollQuery = payrollQuery.gte('period_start', startDate).lte('period_end', endDate);
          }

          const { data: payrollEntries, error: payrollError } = await payrollQuery;
          if (payrollError) {
            console.error(`Error fetching payroll for employee ${employee.id}:`, payrollError);
            continue;
          }

          for (const entry of payrollEntries) {
            const taxPeriod = new Date(entry.period_start).toISOString().split('T')[0].substring(0, 7);

            const professionalTaxAmount = extractProfessionalTaxAmount(entry.deduction_components);

            const totalEarnings = Array.isArray(entry.salary_components)
              ? entry.salary_components.reduce((sum: number, comp: any) => sum + (comp.amount || 0), 0)
              : entry.base_salary || 0;

            reportData.push({
              employeeId: employee.id,
              employeeCode: employee.employee_code || '-',
              name: employee.name,
              department: employee.department,
              taxPeriod,
              taxableIncome: parseFloat(totalEarnings.toFixed(2)),
              taxAmount: parseFloat(professionalTaxAmount.toFixed(2)),
              paymentDate: entry.payment_date ? new Date(entry.payment_date).toLocaleDateString() : '-',
              receiptNumber: `PT${employee.id.substring(0, 8)}-${taxPeriod}`
            });
          }
        }

        const summary = {
          totalEmployees: new Set(reportData.map(item => item.employeeId)).size,
          totalTaxableIncome: parseFloat(reportData.reduce((sum, item) => sum + item.taxableIncome, 0).toFixed(2)),
          totalTaxAmount: parseFloat(reportData.reduce((sum, item) => sum + item.taxAmount, 0).toFixed(2)),
          averageTaxAmount: parseFloat((reportData.reduce((sum, item) => sum + item.taxAmount, 0) / (reportData.length || 1)).toFixed(2))
        };

        return { data: reportData, summary };
      },

      reset: () => {
        set({
          employeeMasterReports: {},
          transactionReports: {},
          statutoryReports: {},
          loading: false,
          error: null,
        });
      },
    }),
    {
      name: 'reports-store', // Key name in localStorage
      storage: createJSONStorage(() => localStorage), // Persist using localStorage
      partialize: (state) => ({
        // Save only data, not loading/error
        employeeMasterReports: state.employeeMasterReports,
        transactionReports: state.transactionReports,
        statutoryReports: state.statutoryReports,
      }),
    }
  )
);
