import { supabase } from './supabase';
import { getTenantId } from './tenantDb';

export interface Shift {
  id: string;
  name: string;
  description: string | null;
  start_time: string;
  end_time: string;
  break_duration: string;
  shift_type: 'morning' | 'afternoon' | 'night';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ShiftAssignment {
  id: string;
  shift_id: string;
  employee_id: string;
  schedule_date: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  clock_in: string | null;
  clock_out: string | null;
  actual_break_duration: string | null;
  overtime_minutes: number;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  shift?: Shift;
  employee?: {
    name: string;
    email: string;
    department: string;
  };
}

export interface RotationPattern {
  type: 'none' | 'daily' | 'weekly' | 'monthly';
  interval?: number;
  startDate: string;
  endDate?: string;
}

export interface BulkAssignmentRequest {
  shift_id: string;
  employee_ids: string[];
  rotation: RotationPattern;
  department?: string;
}

interface ValidationError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export async function createBulkAssignments(
  request: BulkAssignmentRequest
): Promise<{
  success: boolean;
  assignments?: ShiftAssignment[];
  errors?: ValidationError[];
}> {
  try {
    const tenantId = await getTenantId();
    const { data, error } = await supabase.rpc('create_bulk_assignments', {
      p_shift_id: request.shift_id,
      p_employee_ids: request.employee_ids,
      p_start_date: request.rotation.startDate,
      p_end_date: request.rotation.endDate || request.rotation.startDate,
      p_department: request.department,
      p_tenant_id: tenantId,
    });

    if (error) {
      console.error('Bulk assignment error:', error);
      return {
        success: false,
        errors: [
          {
            code: error.code,
            message: error.message,
            details: { hint: error.hint, details: error.details },
          },
        ],
      };
    }

    if (!data[0].success) {
      return {
        success: false,
        errors: data.errors,
      };
    }

    return {
      success: true,
      assignments: data.assignments,
    };
  } catch (error) {
    console.error('Bulk assignment failed:', error);
    return {
      success: false,
      errors: [
        {
          code: 'UNEXPECTED_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred',
        },
      ],
    };
  }
}

export async function getShifts() {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createShift(
  shift: Omit<Shift, 'id' | 'created_at' | 'updated_at'>
) {
  const { data, error } = await supabase
    .from('shifts')
    .insert([shift])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getShiftAssignments(
  start_date: string,
  end_date: string,
  employee_id?: string
): Promise<ShiftAssignment[]> {
  const tenantId = await getTenantId();
  const { data, error } = await supabase.rpc('get_shift_assignments_secure', {
    p_start_date: start_date,
    p_end_date: end_date,
    p_employee_id: employee_id,
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createShiftAssignment(
  assignment: Omit<ShiftAssignment, 'id' | 'created_at' | 'updated_at'>
) {
  const { data, error } = await supabase
    .from('shift_assignments')
    .insert([
      {
        ...assignment,
        status: assignment.status || 'scheduled',
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateShiftAssignment(
  id: string,
  updates: Partial<ShiftAssignment>
) {
  const { data, error } = await supabase
    .from('shift_assignments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteShiftAssignment(id: string) {
  const { error } = await supabase
    .from('shift_assignments')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
