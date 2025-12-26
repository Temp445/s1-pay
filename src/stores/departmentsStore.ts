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
  removeItem,
  type StoreState,
} from './utils/storeUtils';

export interface Department {
  id: string;
  name: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface DepartmentsStore extends StoreState<Department> {
  fetchDepartments: () => Promise<void>;
  createDepartment: (name: string) => Promise<Department>;
  deleteDepartment: (id: string) => Promise<void>;
  getDepartmentById: (id: string) => Department | undefined;
  reset: () => void;
}

export const useDepartmentsStore = create<DepartmentsStore>()(
  persist(
    (set, get) => ({
      ...initialStoreState<Department>(),

      fetchDepartments: async () => {
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
            .from('departments')
            .select('*')
            .eq('tenant_id', auth.tenantId)
            .order('name');

          if (error) throw error;

          set(state => setSuccess(state, data || []));
        } catch (error) {
          set(state => setError(state, error instanceof Error ? error.message : 'Failed to fetch departments'));
        }
      },

      createDepartment: async (name) => {
        const auth = await validateAuth();
        if (!auth.isAuthenticated) {
          throw createAuthError();
        }

        if (!auth.tenantId) {
          throw createTenantError();
        }

        set(state => setLoading(state));

        try {
          const { data, error } = await supabase
            .from('departments')
            .insert([{ name, tenant_id: auth.tenantId }])
            .select()
            .single();

          if (error) {
            if (error.code === '23505') {
              throw new Error('A department with this name already exists');
            }
            throw error;
          }

          set(state => addItem(state, data));
          return data;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create department';
          set(state => setError(state, errorMessage));
          throw error;
        }
      },

      deleteDepartment: async (id) => {
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
            .from('departments')
            .delete()
            .eq('id', id)
            .eq('tenant_id', auth.tenantId);

          if (error) throw error;

          set(state => removeItem(state, id));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete department';
          set(state => setError(state, errorMessage));
          throw error;
        }
      },

      getDepartmentById: (id) => {
        return get().items.find(dept => dept.id === id);
      },

      reset: () => {
        set(initialStoreState<Department>());
      },
    }),
    {
      name: 'departments-storage',
      partialize: (state) => ({
        items: state.items,
        initialized: state.initialized,
      }),
    }
  )
);
