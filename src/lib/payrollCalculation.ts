import { supabase } from './supabase';
import { getTenantId } from './tenantDb';
import { format, differenceInDays, isWeekend, isWithinInterval, parseISO } from 'date-fns';
import { AttendanceLog } from './attendance';
import { LeaveRequest } from './leave';
import { Holiday } from './holidays';
import { useEffect } from 'react';

export interface PayrollPeriod {
  startDate: string;
  endDate: string;
  employeeId: string;
}

export interface PayableDay {
  date: string;
  isWorkingDay: boolean;
  isHoliday: boolean;
  isWeekend: boolean;
  isLeave: boolean;
  leaveType?: string;
  isPaidLeave: boolean;
  isPresent: boolean;
  attendanceStatus?: string;
  payFactor: number; // 1 for full day, 0.5 for half day, 0 for unpaid
}

export interface PayrollCalculationResult {
  totalCalendarDays: number;
  totalWorkingDays: number;
  totalWeekendDays: number;
  totalHolidays: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalLeaveDays: number;
  totalPaidLeaveDays: number;
  totalUnpaidLeaveDays: number;
  totalPayableDays: number;
  payableDaysFactor: number; // Between 0 and 1
  payableDaysBreakdown: PayableDay[];
  validationErrors: string[];
  validationWarnings: string[];
}

/**
 * Validates attendance and leave records for a payroll period
 */
export async function validatePayrollPeriod(period: PayrollPeriod): Promise<PayrollCalculationResult> {
  const { startDate, endDate, employeeId } = period;
  
  // Initialize result
  const result: PayrollCalculationResult = {
    totalCalendarDays: differenceInDays(parseISO(endDate), parseISO(startDate)) + 1,
    totalWorkingDays: 0,
    totalWeekendDays: 0,
    totalHolidays: 0,
    totalPresentDays: 0,
    totalAbsentDays: 0,
    totalLeaveDays: 0,
    totalPaidLeaveDays: 0,
    totalUnpaidLeaveDays: 0,
    totalPayableDays: 0,
    payableDaysFactor: 0,
    payableDaysBreakdown: [],
    validationErrors: [],
    validationWarnings: []
  };

  try {
    // Fetch attendance records
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (attendanceError) {
      result.validationErrors.push(`Failed to fetch attendance records: ${attendanceError.message}`);
      return result;
    }

    // Fetch leave records - get ALL leave requests (not just approved)
    const tenantId = await getTenantId();
    const { data: allLeaveData, error: leaveError } = await supabase
      .from('leave_requests')
      .select(`
        *,
        leave_type:leave_types(*),
        total_days,
        is_half_day_start,
        is_half_day_end
      `)
      .eq('employee_id', employeeId)
      .eq('tenant_id', tenantId)
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (leaveError) {
      result.validationErrors.push(`Failed to fetch leave records: ${leaveError.message}`);
      return result;
    }

    // Fetch weekly off records
    const { data: weeklyOffData, error: weeklyOffError } = await supabase.rpc('get_weekly_off_list', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_tenant_id: tenantId,
    });

    if (weeklyOffError) {
      result.validationErrors.push(`Failed to fetch weekly off list: ${weeklyOffError.message}`);
      return result;
    }

    // Fetch holidays
    const { data: holidayData, error: holidayError } = await supabase.rpc('get_holiday_list', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_tenant_id: tenantId,
    });

    if (holidayError) {
      result.validationErrors.push(`Failed to fetch holidays: ${holidayError.message}`);
      return result;
    }

    // Calculate total working days (excluding weekends and holidays)
    // const startDateObj = new Date(startDate);
    // const endDateObj = new Date(endDate);
    // const totalDays = differenceInBusinessDays(endDateObj, startDateObj) + 1;
    
    // Process each day in the period
    const payableDaysBreakdown: PayableDay[] = [];
    let currentDate = new Date(startDate);
    const endDateParsed = new Date(endDate);
    
    while (currentDate <= endDateParsed) {

      const dateStr = format(currentDate, 'yyyy-MM-dd');
      //const isWeekendDay = isWeekend(currentDate);
      
      // Check if it's a weekly off day
      const weeklyOff = weeklyOffData.find((w: { date: string; }) => w.date === dateStr);
      const isWeekendDay = !!weeklyOff;

      // Check if it's a holiday
      const holiday = holidayData.find((h: { date: string; }) => h.date === dateStr);
      const isHolidayDay = !!holiday;
      
      // Check attendance
      const attendance = attendanceData.find(a => a.date === dateStr);

      // Check leave - find ANY leave request for this day (approved or not)
      const leave = allLeaveData?.find((l: any) =>
        new Date(l.start_date) <= currentDate &&
        new Date(l.end_date) >= currentDate
      );

      // Determine if it's a working day
      const isWorkingDay = !isWeekendDay && !isHolidayDay;

      // Calculate pay factor
      let payFactor = 0;

      if (isWorkingDay) {
        result.totalWorkingDays++;

        // RULE 2: Unapproved Leave = LOP
        // RULE 3: Approved Leave with LOP type = LOP
        if (leave) {
          const isApproved = leave.status === 'Approved';
          const leaveTypeName = leave.leave_type?.name || '';
          const isLOPLeaveType = leaveTypeName.toUpperCase().includes('LOP') ||
                                  leaveTypeName.toUpperCase().includes('LOSS OF PAY') ||
                                  leaveTypeName.toUpperCase() === 'LOP';
          const isPaidLeave = leave.leave_type?.is_paid || false;

          // Calculate fractional leave factor for current day
          const leaveTotalDays = leave.total_days || 1;
          const leaveStartDate = new Date(leave.start_date);
          const leaveEndDate = new Date(leave.end_date);
          const isMultiDayLeave = leaveStartDate.getTime() !== leaveEndDate.getTime();

          let currentDayLeaveFactor = 1;

          // Handle 0.5 day single-day leave
          if (leaveTotalDays === 0.5 && !isMultiDayLeave) {
            currentDayLeaveFactor = 0.5;
          }
          // Handle multi-day leave with fractional days (e.g., 2.5 days)
          else if (isMultiDayLeave && leaveTotalDays % 1 !== 0) {
            const isStartDate = currentDate.getTime() === leaveStartDate.getTime();
            const isEndDate = currentDate.getTime() === leaveEndDate.getTime();

            if (isStartDate && leave.is_half_day_start) {
              currentDayLeaveFactor = 0.5;
            } else if (isEndDate && leave.is_half_day_end) {
              currentDayLeaveFactor = 0.5;
            }
          }

          // Unapproved leave OR Approved LOP leave = treat as LOP
          if (!isApproved || (isApproved && isLOPLeaveType)) {
            result.totalLeaveDays += currentDayLeaveFactor;
            result.totalUnpaidLeaveDays += currentDayLeaveFactor;
            payFactor = 1 - currentDayLeaveFactor;

            payableDaysBreakdown.push({
              date: dateStr,
              isWorkingDay: true,
              isHoliday: false,
              isWeekend: false,
              isLeave: true,
              leaveType: leaveTypeName || 'LOP',
              isPaidLeave: false,
              isPresent: false,
              payFactor: payFactor
            });
          } else if (isApproved) {
            // Approved leave that is NOT LOP type
            result.totalLeaveDays += currentDayLeaveFactor;

            if (isPaidLeave) {
              result.totalPaidLeaveDays += currentDayLeaveFactor;
              payFactor = 1;
            } else {
              result.totalUnpaidLeaveDays += currentDayLeaveFactor;
              payFactor = 1 - currentDayLeaveFactor;
            }

            payableDaysBreakdown.push({
              date: dateStr,
              isWorkingDay: true,
              isHoliday: false,
              isWeekend: false,
              isLeave: true,
              leaveType: leaveTypeName,
              isPaidLeave: isPaidLeave,
              isPresent: false,
              payFactor
            });
          }
        } else if (attendance) {
          // RULE 4: Attendance Only Scenario - preserve existing logic
          if (attendance.status === 'Present') {
            result.totalPresentDays++;
            payFactor = 1;
          } else if (attendance.status === 'Half Day') {
            result.totalPresentDays += 0.5;
            payFactor = 0.5;
          } else if (attendance.status === 'Late') {
            result.totalPresentDays++;
            payFactor = 1;
          } else {
            result.totalAbsentDays++;
            payFactor = 0;
          }

          payableDaysBreakdown.push({
            date: dateStr,
            isWorkingDay: true,
            isHoliday: false,
            isWeekend: false,
            isLeave: false,
            isPaidLeave: false,
            isPresent: attendance.status !== 'Absent',
            attendanceStatus: attendance.status,
            payFactor
          });
        } else {
          // RULE 1: Missing Data Scenario - No attendance AND no leave = Full Day Present
          result.totalPresentDays++;
          payFactor = 1;

          payableDaysBreakdown.push({
            date: dateStr,
            isWorkingDay: true,
            isHoliday: false,
            isWeekend: false,
            isLeave: false,
            isPaidLeave: false,
            isPresent: true,
            attendanceStatus: 'Present',
            payFactor: 1
          });
        }
      } else if (isHolidayDay) {
        result.totalHolidays++;
        
        payableDaysBreakdown.push({
          date: dateStr,
          isWorkingDay: false,
          isHoliday: true,
          isWeekend: isWeekendDay,
          isLeave: false,
          isPaidLeave: false,
          isPresent: false,
          payFactor: 1 // Holidays are paid
        });
      } else if (isWeekendDay) {
        result.totalWeekendDays++;
        
        payableDaysBreakdown.push({
          date: dateStr,
          isWorkingDay: false,
          isHoliday: false,
          isWeekend: true,
          isLeave: false,
          isPaidLeave: false,
          isPresent: false,
          payFactor: 1 // Weekends are paid
        });
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Calculate total payable days
    result.totalPayableDays = payableDaysBreakdown.reduce((sum, day) => sum + day.payFactor, 0);
    
    // Calculate payable days factor (proportion of working days that are payable)
    result.payableDaysFactor = result.totalWorkingDays > 0 
      ? result.totalPayableDays / result.totalCalendarDays 
      : 0;
   
    result.payableDaysBreakdown = payableDaysBreakdown;
    
    // Validation checks
    if (result.totalWorkingDays === 0) {
      result.validationWarnings.push('No working days in the selected period');
    }
    
    if (result.totalAbsentDays > 0) {
      result.validationWarnings.push(`Employee has ${result.totalAbsentDays} absent days`);
    }
    
    if (attendanceData.length === 0) {
      result.validationWarnings.push('No attendance records found for the period');
    }
    
    return result;
  } catch (error) {
    result.validationErrors.push(`Calculation error: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

/**
 * Calculates the proportional amount based on payable days
 */
export function calculateProportionalAmount(
  baseAmount: number,
  payableDaysFactor: number
): number {
  return baseAmount * payableDaysFactor;
}

/**
 * Calculates the final payroll amount with all components
 */
export function calculateFinalPayrollAmount(
  directAmount: number,
  payableDaysFactor: number,
  overtimeAmount: number,
  deductionsAmount: number,
  bonusAmount: number
): number {
  const proportionalDirectAmount = calculateProportionalAmount(directAmount, payableDaysFactor);
  return proportionalDirectAmount + overtimeAmount - deductionsAmount + bonusAmount;
}