import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
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
  tenant_id?: string;
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
  tenant_id?: string;
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

interface ShiftStore extends StoreState<Shift> {
  assignments: StoreState<ShiftAssignment>;

  fetchShifts: () => Promise<void>;
  createShift: (shift: Omit<Shift, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>) => Promise<Shift>;
  updateShift: (id: string, updates: Partial<Shift>) => Promise<Shift>;
  deleteShift: (id: string) => Promise<void>;

  fetchShiftAssignments: (startDate: string, endDate: string, employeeId?: string) => Promise<void>;
  createShiftAssignment: (assignment: Omit<ShiftAssignment, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>) => Promise<ShiftAssignment>;
  updateShiftAssignment: (id: string, updates: Partial<ShiftAssignment>) => Promise<ShiftAssignment>;
  deleteShiftAssignment: (id: string) => Promise<void>;
  createBulkAssignments: (request: any) => Promise<any>;
}

export const useShiftsStore = create<ShiftStore>()(
  persist(
    (set, get) => ({
      ...initialStoreState<Shift>(),
      assignments: initialStoreState<ShiftAssignment>(),

      /** Fetch all shifts */
      fetchShifts: async () => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          set(state => setError(state, createAuthError().message));
          return;
        }

        if (!auth.tenantId) {
          set(state => setError(state, createTenantError().message));
          return;
        }

        set(state => setLoading(state));

        try {
          const { data, error } = await supabase
            .from('shifts')
            .select('*')
            .eq('tenant_id', auth.tenantId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          set(state => setSuccess(state, data || []));
        } catch (error) {
          set(state =>
            setError(
              state,
              error instanceof Error ? error.message : 'Failed to fetch shifts'
            )
          );
        }
      },

      /** Create new shift */
      createShift: async (shift) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => setLoading(state));

        try {
          const { data, error } = await supabase
            .from('shifts')
            .insert([{ ...shift, tenant_id: auth.tenantId }])
            .select()
            .single();

          if (error) throw error;
          set(state => addItem(state, data));
          return data;
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to create shift';
          set(state => setError(state, msg));
          throw error;
        }
      },

      /** Update existing shift */
      updateShift: async (id, updates) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => setLoading(state));

        try {
          const { data, error } = await supabase
            .from('shifts')
            .update(updates)
            .eq('id', id)
            .eq('tenant_id', auth.tenantId)
            .select()
            .single();

          if (error) throw error;
          set(state => updateItem(state, id, data));
          return data;
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to update shift';
          set(state => setError(state, msg));
          throw error;
        }
      },

      /** Delete shift */
      deleteShift: async (id) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => setLoading(state));

        try {
          const { error } = await supabase
            .from('shifts')
            .delete()
            .eq('id', id)
            .eq('tenant_id', auth.tenantId);

          if (error) throw error;
          set(state => removeItem(state, id));
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to delete shift';
          set(state => setError(state, msg));
          throw error;
        }
      },

      /** Fetch shift assignments (via RPC) */
      fetchShiftAssignments: async (startDate, endDate, employeeId) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => ({
          ...state,
          assignments: setLoading(state.assignments),
        }));

        try {
          const { data, error } = await supabase.rpc('get_shift_assignments_secure', {
            p_start_date: startDate,
            p_end_date: endDate,
            p_employee_id: employeeId || null,
            p_tenant_id: auth.tenantId,
          });

          if (error) throw error;
          set(state => ({
            ...state,
            assignments: setSuccess(state.assignments, data || []),
          }));
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to fetch assignments';
          set(state => ({
            ...state,
            assignments: setError(state.assignments, msg),
          }));
          throw error;
        }
      },

      /** Create assignment */
      createShiftAssignment: async (assignment) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => ({
          ...state,
          assignments: setLoading(state.assignments),
        }));

        try {
          const { data, error } = await supabase
            .from('shift_assignments')
            .insert([{ ...assignment, tenant_id: auth.tenantId }])
            .select()
            .single();

          if (error) throw error;
          set(state => ({
            ...state,
            assignments: addItem(state.assignments, data),
          }));
          return data;
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to create assignment';
          set(state => ({
            ...state,
            assignments: setError(state.assignments, msg),
          }));
          throw error;
        }
      },

      /** Update assignment */
      updateShiftAssignment: async (id, updates) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => ({
          ...state,
          assignments: setLoading(state.assignments),
        }));

        try {
          const { data, error } = await supabase
            .from('shift_assignments')
            .update(updates)
            .eq('id', id)
            .eq('tenant_id', auth.tenantId)
            .select()
            .single();

          if (error) throw error;
          set(state => ({
            ...state,
            assignments: updateItem(state.assignments, id, data),
          }));
          return data;
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to update assignment';
          set(state => ({
            ...state,
            assignments: setError(state.assignments, msg),
          }));
          throw error;
        }
      },

      /** Delete assignment */
      deleteShiftAssignment: async (id) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) throw createAuthError();
        if (!auth.tenantId) throw createTenantError();

        set(state => ({
          ...state,
          assignments: setLoading(state.assignments),
        }));

        try {
          const { error } = await supabase
            .from('shift_assignments')
            .delete()
            .eq('id', id)
            .eq('tenant_id', auth.tenantId);

          if (error) throw error;
          set(state => ({
            ...state,
            assignments: removeItem(state.assignments, id),
          }));
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Failed to delete assignment';
          set(state => ({
            ...state,
            assignments: setError(state.assignments, msg),
          }));
          throw error;
        }
      },


      createBulkAssignments: async (request: any) => {
        try {
         
          const auth = await validateAuth();
          if (!auth.isAuthenticated) throw createAuthError();
          if (!auth.tenantId) throw createTenantError();


          const { data, error } = await supabase.rpc('create_bulk_assignments', {
            p_shift_id: request.shift_id,
            p_employee_ids: request.employee_ids,
            p_start_date: request.rotation.startDate,
            p_end_date: request.rotation.endDate || request.rotation.startDate,
            p_department: request.department || null,
            p_tenant_id: auth.tenantId,
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
    
          if (!data || !data[0] || !data[0].success) {
            return {
              success: false,
              errors: data?.[0]?.errors || [{ code: 'UNKNOWN', message: 'Bulk assignment failed' }],
            };
          }
    
          // Refresh assignments after bulk creation
          const startDate = request.rotation.startDate;
          const endDate = request.rotation.endDate || request.rotation.startDate;
          await get().fetchShiftAssignments(startDate, endDate);
    
          return {
            success: true,
            assignments: data[0].assignments,
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
      },

    }),
    {
      name: 'shifts-storage',
      partialize: (state) => ({
        items: state.items,
        assignments: state.assignments,
        initialized: state.initialized,
      }),
    }
  )
);
