import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { getTenantId } from '../lib/tenantDb';
import {
  validateAuth,
  createAuthError,
  createTenantError,
  initialStoreState,
  setLoading,
  setError,
  setSuccess,
  addItem,
  updateItem,
  removeItem,
  type StoreState,
} from './utils/storeUtils';

export interface LeaveType {
  id: string;
  name: string;
  description: string | null;
  default_days: number;
  requires_approval: boolean;
  is_active: boolean;
  is_paid: boolean;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  year: number;
  total_days: number;
  used_days: number;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
  leave_types: {
    name: string;
  };
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  document_url: string | null;
  approved_by: string | null;
  approved_at: string | null;
  is_half_day_start?: boolean;
  is_half_day_end?: boolean;
  half_day_period_start?: '1st half' | '2nd half' | null;
  half_day_period_end?: '1st half' | '2nd half' | null;
  total_days?: number;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
  leave_type: {
    name: string;
  };
  approved_by_user?: {
    email: string;
  };
}

interface LeaveStore {
  // Leave Types
  leaveTypes: StoreState<LeaveType>;
  fetchLeaveTypes: () => Promise<void>;
  createLeaveType: (leaveType: Omit<LeaveType, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>) => Promise<LeaveType>;
  updateLeaveType: (id: string, updates: Partial<LeaveType>) => Promise<LeaveType>;
  deleteLeaveType: (id: string) => Promise<void>;

  // Leave Balances
  leaveBalances: StoreState<LeaveBalance>;
  fetchLeaveBalances: (employeeId: string, year: number) => Promise<void>;

  // Leave Requests
  leaveRequests: StoreState<LeaveRequest>;
  fetchLeaveRequests: (employeeId: string, startDate?: string, endDate?: string) => Promise<void>;
  submitLeaveRequest: (request: {
    employee_id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    reason: string;
    document_url?: string;
    is_half_day_start?: boolean;
    is_half_day_end?: boolean;
    half_day_period_start?: '1st half' | '2nd half' | null;
    half_day_period_end?: '1st half' | '2nd half' | null;
  }) => Promise<LeaveRequest>;
  updateLeaveRequestStatus: (requestId: string, status: LeaveRequest['status'], approvedBy?: string) => Promise<LeaveRequest>;
  cancelLeaveRequest: (requestId: string) => Promise<void>;

  reset: () => void;
}

export const useLeaveStore = create<LeaveStore>()(
  persist(
    (set, get) => ({
      // Leave Types State
      leaveTypes: initialStoreState<LeaveType>(),

      fetchLeaveTypes: async () => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          set(state => ({
            ...state,
            leaveTypes: setError(state.leaveTypes, createAuthError().message),
          }));
          return;
        }

        if (!auth.tenantId) {
          set(state => ({
            ...state,
            leaveTypes: setError(state.leaveTypes, createTenantError().message),
          }));
          return;
        }

        set(state => ({
          ...state,
          leaveTypes: setLoading(state.leaveTypes),
        }));

        try {
          const { data, error } = await supabase
            .from('leave_types')
            .select('*')
            .eq('tenant_id', auth.tenantId)
            .order('name');

          if (error) throw error;

          set(state => ({
            ...state,
            leaveTypes: setSuccess(state.leaveTypes, data || []),
          }));
        } catch (error) {
          set(state => ({
            ...state,
            leaveTypes: setError(state.leaveTypes, error instanceof Error ? error.message : 'Failed to fetch leave types'),
          }));
        }
      },

      createLeaveType: async (leaveType) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => ({
          ...state,
          leaveTypes: setLoading(state.leaveTypes),
        }));

        try {
          const { data, error } = await supabase
            .from('leave_types')
            .insert([{ ...leaveType, tenant_id: auth.tenantId }])
            .select()
            .single();

          if (error) throw error;

          set(state => ({
            ...state,
            leaveTypes: addItem(state.leaveTypes, data),
          }));

          return data;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create leave type';
          set(state => ({
            ...state,
            leaveTypes: setError(state.leaveTypes, errorMessage),
          }));
          throw error;
        }
      },

      updateLeaveType: async (id, updates) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => ({
          ...state,
          leaveTypes: setLoading(state.leaveTypes),
        }));

        try {
          const { data, error } = await supabase
            .from('leave_types')
            .update(updates)
            .eq('id', id)
            .eq('tenant_id', auth.tenantId)
            .select()
            .single();

          if (error) throw error;

          set(state => ({
            ...state,
            leaveTypes: updateItem(state.leaveTypes, id, data),
          }));

          return data;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update leave type';
          set(state => ({
            ...state,
            leaveTypes: setError(state.leaveTypes, errorMessage),
          }));
          throw error;
        }
      },

      deleteLeaveType: async (id) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => ({
          ...state,
          leaveTypes: setLoading(state.leaveTypes),
        }));

        try {
          const { error } = await supabase
            .from('leave_types')
            .delete()
            .eq('id', id)
            .eq('tenant_id', auth.tenantId);

          if (error) throw error;

          set(state => ({
            ...state,
            leaveTypes: removeItem(state.leaveTypes, id),
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete leave type';
          set(state => ({
            ...state,
            leaveTypes: setError(state.leaveTypes, errorMessage),
          }));
          throw error;
        }
      },

      // Leave Balances State
      leaveBalances: initialStoreState<LeaveBalance>(),

      fetchLeaveBalances: async (employeeId, year) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          set(state => ({
            ...state,
            leaveBalances: setError(state.leaveBalances, createAuthError().message),
          }));
          return;
        }

        if (!auth.tenantId) {
          set(state => ({
            ...state,
            leaveBalances: setError(state.leaveBalances, createTenantError().message),
          }));
          return;
        }

        set(state => ({
          ...state,
          leaveBalances: setLoading(state.leaveBalances),
        }));

        try {
          const { data, error } = await supabase.rpc('get_leave_balances', {
            p_employee_id: employeeId || '',
            p_year: year,
            p_tenant_id: auth.tenantId,
          });

          if (error) throw error;

          set(state => ({
            ...state,
            leaveBalances: setSuccess(state.leaveBalances, data || []),
          }));
        } catch (error) {
          set(state => ({
            ...state,
            leaveBalances: setError(state.leaveBalances, error instanceof Error ? error.message : 'Failed to fetch leave balances'),
          }));
        }
      },

      // Leave Requests State
      leaveRequests: initialStoreState<LeaveRequest>(),

      fetchLeaveRequests: async (employeeId, startDate, endDate) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          set(state => ({
            ...state,
            leaveRequests: setError(state.leaveRequests, createAuthError().message),
          }));
          return;
        }

        if (!auth.tenantId) {
          set(state => ({
            ...state,
            leaveRequests: setError(state.leaveRequests, createTenantError().message),
          }));
          return;
        }

        set(state => ({
          ...state,
          leaveRequests: setLoading(state.leaveRequests),
        }));

        try {
          const { data, error } = await supabase.rpc('get_leave_request_details', {
            p_employee_id: employeeId === '' ? null : employeeId,
            p_start_date: startDate || null,
            p_end_date: endDate || null,
            p_tenant_id: auth.tenantId,
          });

          if (error) throw error;

          set(state => ({
            ...state,
            leaveRequests: setSuccess(state.leaveRequests, data || []),
          }));
        } catch (error) {
          set(state => ({
            ...state,
            leaveRequests: setError(state.leaveRequests, error instanceof Error ? error.message : 'Failed to fetch leave requests'),
          }));
        }
      },

      submitLeaveRequest: async (request) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => ({
          ...state,
          leaveRequests: setLoading(state.leaveRequests),
        }));

        try {
          // Calculate days
          const start = new Date(request.start_date);
          const end = new Date(request.end_date);
          let days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

          if (request.is_half_day_start) days -= 0.5;
          if (request.is_half_day_end && request.start_date !== request.end_date) days -= 0.5;
          if (request.start_date === request.end_date && request.is_half_day_start) days = 0.5;

          // Ensure leave balance exists
          await supabase.rpc('ensure_leave_balance', {
            p_employee_id: request.employee_id,
            p_leave_type_id: request.leave_type_id,
            p_year: start.getFullYear(),
            p_tenant_id: auth.tenantId,
          });

          // Get leave balance
          const { data: balances } = await supabase
            .from('leave_balances')
            .select('*')
            .eq('employee_id', request.employee_id)
            .eq('leave_type_id', request.leave_type_id)
            .eq('tenant_id', auth.tenantId)
            .eq('year', start.getFullYear());

          if (!balances || balances.length === 0) {
            throw new Error('Leave balance not found');
          }

          const balance = balances[0];
          const availableDays = balance.total_days - balance.used_days;

          if (days > availableDays) {
            throw new Error(`Insufficient leave balance. Available: ${availableDays} days, Requested: ${days} days`);
          }

          const { data, error } = await supabase
            .from('leave_requests')
            .insert([
              {
                ...request,
                status: 'Pending',
                total_days: days,
                tenant_id: auth.tenantId,
                created_by: auth.userId,
              },
            ])
            .select(`
              *,
              leave_type:leave_types(name)
            `)
            .single();

          if (error) throw error;

          set(state => ({
            ...state,
            leaveRequests: addItem(state.leaveRequests, data),
          }));

          return data;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to submit leave request';
          set(state => ({
            ...state,
            leaveRequests: setError(state.leaveRequests, errorMessage),
          }));
          throw error;
        }
      },

      updateLeaveRequestStatus: async (requestId, status, approvedBy) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => ({
          ...state,
          leaveRequests: setLoading(state.leaveRequests),
        }));

        try {
          const updates: Record<string, any> = { status };

          if (status === 'Approved' && approvedBy) {
            updates.approved_by = approvedBy;
            updates.approved_at = new Date().toISOString();
          }

          const { data, error } = await supabase
            .from('leave_requests')
            .update(updates)
            .eq('id', requestId)
            .eq('tenant_id', auth.tenantId)
            .select(`
              *,
              leave_type:leave_types(name)
            `)
            .single();

          if (error) throw error;

          set(state => ({
            ...state,
            leaveRequests: updateItem(state.leaveRequests, requestId, data),
          }));

          return data;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update leave request';
          set(state => ({
            ...state,
            leaveRequests: setError(state.leaveRequests, errorMessage),
          }));
          throw error;
        }
      },

      cancelLeaveRequest: async (requestId) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => ({
          ...state,
          leaveRequests: setLoading(state.leaveRequests),
        }));

        try {
          const { data, error } = await supabase
            .from('leave_requests')
            .update({ status: 'Cancelled' })
            .eq('id', requestId)
            .eq('tenant_id', auth.tenantId)
            .select()
            .single();

          if (error) throw error;

          set(state => ({
            ...state,
            leaveRequests: updateItem(state.leaveRequests, requestId, data),
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to cancel leave request';
          set(state => ({
            ...state,
            leaveRequests: setError(state.leaveRequests, errorMessage),
          }));
          throw error;
        }
      },

      reset: () => {
        set({
          leaveTypes: initialStoreState<LeaveType>(),
          leaveBalances: initialStoreState<LeaveBalance>(),
          leaveRequests: initialStoreState<LeaveRequest>(),
        });
      },
    }),
    {
      name: 'leave-storage',
      partialize: (state) => ({
        leaveTypes: {
          items: state.leaveTypes.items,
          initialized: state.leaveTypes.initialized,
        },
        leaveRequests: {
          items: state.leaveRequests.items,
          initialized: state.leaveRequests.initialized,
        },
      }),
    }
  )
);
