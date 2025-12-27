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

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  status: 'Active' | 'Terminated' | 'Suspended' | 'Relieved'| 'Rejoin';
  start_date: string;
  employee_code?: string;
  address?: string;
  date_of_birth?: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface EmployeesStore extends StoreState<Employee> {
  fetchEmployees: () => Promise<void>;
  createEmployee: (employee: Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'tenant_id'>) => Promise<Employee>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<Employee>;
  deleteEmployee: (id: string) => Promise<void>;
  getEmployeeById: (id: string) => Employee | undefined;
  reset: () => void;
}

export const useEmployeesStore = create<EmployeesStore>()(
  persist(
    (set, get) => ({
      ...initialStoreState<Employee>(),

      fetchEmployees: async () => {
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
            .from('employees')
            .select('*')
            .eq('tenant_id', auth.tenantId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          set(state => setSuccess(state, data || []));
        } catch (error) {
          set(state => setError(state, error instanceof Error ? error.message : 'Failed to fetch employees'));
        }
      },

      createEmployee: async (employee) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          throw createAuthError();
        }

        if (!auth.tenantId) {
          throw createTenantError();
        }

        set(state => setLoading(state));

        try {
          // Check for duplicate email within tenant
          const { data: existingEmployeeWithEmail } = await supabase
            .from('employees')
            .select('id')
            .eq('email', employee.email)
            .eq('tenant_id', auth.tenantId)
            .maybeSingle();

          if (existingEmployeeWithEmail) {
            throw new Error('An employee with this email already exists in your organization');
          }

          // Check for duplicate employee code within tenant if provided
          if (employee.employee_code) {
            const { data: existingEmployee } = await supabase
              .from('employees')
              .select('id')
              .eq('employee_code', employee.employee_code)
              .eq('tenant_id', auth.tenantId)
              .maybeSingle();

            if (existingEmployee) {
              throw new Error('An employee with this employee code already exists in your organization');
            }
          }

          const { data, error } = await supabase
            .from('employees')
            .insert([
              {
                ...employee,
                tenant_id: auth.tenantId,
                created_by: auth.userId,
              },
            ])
            .select()
            .single();

          if (error) throw error;

          set(state => addItem(state, data));
          return data;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create employee';
          set(state => setError(state, errorMessage));
          throw error;
        }
      },

      updateEmployee: async (id, updates) => {
  const auth = await validateAuth();
  if (!auth.isAuthenticated) throw createAuthError();
  if (!auth.tenantId) throw createTenantError();

  set(state => setLoading(state));

  try {
    // 🔹 Fetch current values
    const { data: currentEmployee, error: fetchError } = await supabase
      .from('employees')
      .select('status, start_date')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .single();

    if (fetchError) throw fetchError;

    const nextStatus = updates.status ?? currentEmployee.status;
    const nextStartDate = updates.start_date ?? currentEmployee.start_date;

    const isChanged =
      nextStatus !== currentEmployee.status ||
      nextStartDate !== currentEmployee.start_date;

    // 🔹 Store history if ANY change happened
    if (isChanged) {
      await supabase.from('employee_status_history').insert({
        employee_id: id,
        old_status: currentEmployee.status,
        new_status: nextStatus,
        old_start_date: currentEmployee.start_date,
        new_start_date: nextStartDate,
        tenant_id: auth.tenantId,
        updated_by: auth.userId,
      });
    }

    // 🔹 Existing duplicate checks (UNCHANGED)
    if (updates.email) {
      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('email', updates.email)
        .eq('tenant_id', auth.tenantId)
        .neq('id', id)
        .maybeSingle();

      if (data) throw new Error('An employee with this email already exists');
    }

    if (updates.employee_code) {
      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('employee_code', updates.employee_code)
        .eq('tenant_id', auth.tenantId)
        .neq('id', id)
        .maybeSingle();

      if (data) throw new Error('An employee with this employee code already exists');
    }

    // 🔹 Update employee (UNCHANGED)
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select()
      .single();

    if (error) throw error;

    set(state => updateItem(state, id, data));
    return data;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to update employee';
    set(state => setError(state, msg));
    throw error;
  }
},


      deleteEmployee: async (id) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          throw createAuthError();
        }

        if (!auth.tenantId) {
          throw createTenantError();
        }

        set(state => setLoading(state));

        try {
          const { error } = await supabase
            .from('employees')
            .delete()
            .eq('id', id)
            .eq('tenant_id', auth.tenantId);

          if (error) throw error;

          set(state => removeItem(state, id));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete employee';
          set(state => setError(state, errorMessage));
          throw error;
        }
      },

      getEmployeeById: (id) => {
        return get().items.find(emp => emp.id === id);
      },

      reset: () => {
        set(initialStoreState<Employee>());
      },
    }),
    {
      name: 'employees-storage',
      partialize: (state) => ({
        items: state.items,
        initialized: state.initialized,
      }),
    }
  )
);
