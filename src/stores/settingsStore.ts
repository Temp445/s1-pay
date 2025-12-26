import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { validateAuth, createAuthError, createTenantError } from './utils/storeUtils';

// Type definitions for statutory elements
export interface CompanyStatutorySettings {
  id?: string;
  tenant_id?: string;
  provident_fund: boolean;
  employee_state_insurance: boolean;
  professional_tax: boolean;
  tax_deducted_at_source: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StatutoryConfiguration {
  id?: string;
  tenant_id?: string;
  statutory_element: 'provident_fund' | 'employee_state_insurance' | 'professional_tax' | 'tax_deducted_at_source';
  calculation_method: 'percentage' | 'value';
  application_type: 'same_to_all' | 'vary_employeewise';
  global_value?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeStatutoryValue {
  id?: string;
  tenant_id?: string;
  employee_id: string;
  configuration_id: string;
  value: number;
  created_at?: string;
  updated_at?: string;
}

interface SettingsStore {
  settings: any;
  loading: boolean;
  error: string | null;

  // Statutory elements state
  companyStatutorySettings: CompanyStatutorySettings | null;
  statutoryConfigurations: StatutoryConfiguration[];
  employeeStatutoryValues: EmployeeStatutoryValue[];

  // Company statutory settings methods
  fetchCompanyStatutorySettings: () => Promise<void>;
  saveCompanyStatutorySettings: (settings: Omit<CompanyStatutorySettings, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => Promise<void>;

  // Statutory configurations methods
  fetchStatutoryConfigurations: () => Promise<void>;
  saveStatutoryConfiguration: (config: Omit<StatutoryConfiguration, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => Promise<StatutoryConfiguration>;
  updateStatutoryConfiguration: (id: string, updates: Partial<StatutoryConfiguration>) => Promise<void>;
  deleteStatutoryConfiguration: (id: string) => Promise<void>;

  // Employee statutory values methods
  fetchEmployeeStatutoryValues: (configurationId: string) => Promise<EmployeeStatutoryValue[]>;
  saveEmployeeStatutoryValues: (values: Omit<EmployeeStatutoryValue, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>[]) => Promise<void>;

  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  loading: false,
  error: null,
  companyStatutorySettings: null,
  statutoryConfigurations: [],
  employeeStatutoryValues: [],

  // Fetch company statutory settings
  fetchCompanyStatutorySettings: async () => {
    const auth = await validateAuth();
    if (!auth.isAuthenticated || !auth.tenantId) {
      set({ error: 'Authentication required' });
      return;
    }

    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('company_statutory_settings')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();

      if (error) throw error;

      set({ companyStatutorySettings: data, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch statutory settings',
        loading: false,
      });
    }
  },

  // Save company statutory settings
  saveCompanyStatutorySettings: async (settings) => {
    const auth = await validateAuth();
    if (!auth.isAuthenticated || !auth.tenantId) {
      throw createAuthError();
    }

    set({ loading: true, error: null });

    try {
      // Check if settings already exist
      const { data: existing } = await supabase
        .from('company_statutory_settings')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();

      let result;
      if (existing) {
        // Update existing settings
        result = await supabase
          .from('company_statutory_settings')
          .update(settings)
          .eq('tenant_id', auth.tenantId)
          .select()
          .single();
      } else {
        // Insert new settings
        result = await supabase
          .from('company_statutory_settings')
          .insert({ ...settings, tenant_id: auth.tenantId })
          .select()
          .single();
      }

      if (result.error) throw result.error;

      set({ companyStatutorySettings: result.data, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save statutory settings',
        loading: false,
      });
      throw error;
    }
  },

  // Fetch statutory configurations
  fetchStatutoryConfigurations: async () => {
    const auth = await validateAuth();
    if (!auth.isAuthenticated || !auth.tenantId) {
      set({ error: 'Authentication required' });
      return;
    }

    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('statutory_configurations')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ statutoryConfigurations: data || [], loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch configurations',
        loading: false,
      });
    }
  },

  // Save statutory configuration
  saveStatutoryConfiguration: async (config) => {
    const auth = await validateAuth();
    if (!auth.isAuthenticated || !auth.tenantId) {
      throw createAuthError();
    }

    set({ loading: true, error: null });

    try {
      // Check if configuration already exists for this element
      const { data: existing } = await supabase
        .from('statutory_configurations')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('statutory_element', config.statutory_element)
        .maybeSingle();

      let result;
      if (existing) {
        // Update existing configuration
        result = await supabase
          .from('statutory_configurations')
          .update(config)
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        // Insert new configuration
        result = await supabase
          .from('statutory_configurations')
          .insert({ ...config, tenant_id: auth.tenantId })
          .select()
          .single();
      }

      if (result.error) throw result.error;

      // Update local state
      const configs = get().statutoryConfigurations;
      const existingIndex = configs.findIndex(c => c.id === result.data.id);

      if (existingIndex >= 0) {
        configs[existingIndex] = result.data;
        set({ statutoryConfigurations: [...configs], loading: false });
      } else {
        set({ statutoryConfigurations: [...configs, result.data], loading: false });
      }

      return result.data;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save configuration',
        loading: false,
      });
      throw error;
    }
  },

  // Update statutory configuration
  updateStatutoryConfiguration: async (id, updates) => {
    const auth = await validateAuth();
    if (!auth.isAuthenticated || !auth.tenantId) {
      throw createAuthError();
    }

    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('statutory_configurations')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', auth.tenantId)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      const configs = get().statutoryConfigurations;
      const index = configs.findIndex(c => c.id === id);

      if (index >= 0) {
        configs[index] = data;
        set({ statutoryConfigurations: [...configs], loading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update configuration',
        loading: false,
      });
      throw error;
    }
  },

  // Delete statutory configuration
  deleteStatutoryConfiguration: async (id) => {
    const auth = await validateAuth();
    if (!auth.isAuthenticated || !auth.tenantId) {
      throw createAuthError();
    }

    set({ loading: true, error: null });

    try {
      const { error } = await supabase
        .from('statutory_configurations')
        .delete()
        .eq('id', id)
        .eq('tenant_id', auth.tenantId);

      if (error) throw error;

      // Update local state
      const configs = get().statutoryConfigurations.filter(c => c.id !== id);
      set({ statutoryConfigurations: configs, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete configuration',
        loading: false,
      });
      throw error;
    }
  },

  // Fetch employee statutory values
  fetchEmployeeStatutoryValues: async (configurationId) => {
    const auth = await validateAuth();
    if (!auth.isAuthenticated || !auth.tenantId) {
      throw createAuthError();
    }

    try {
      const { data, error } = await supabase
        .from('employee_statutory_values')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('configuration_id', configurationId);

      if (error) throw error;

      return data || [];
    } catch (error) {
      throw error;
    }
  },

  // Save employee statutory values
  saveEmployeeStatutoryValues: async (values) => {
    const auth = await validateAuth();
    if (!auth.isAuthenticated || !auth.tenantId) {
      throw createAuthError();
    }

    set({ loading: true, error: null });

    try {
      // Delete existing values for this configuration
      if (values.length > 0) {
        const configurationId = values[0].configuration_id;
        await supabase
          .from('employee_statutory_values')
          .delete()
          .eq('tenant_id', auth.tenantId)
          .eq('configuration_id', configurationId);
      }

      // Insert new values
      const valuesToInsert = values.map(v => ({
        ...v,
        tenant_id: auth.tenantId,
      }));

      const { error } = await supabase
        .from('employee_statutory_values')
        .insert(valuesToInsert);

      if (error) throw error;

      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save employee values',
        loading: false,
      });
      throw error;
    }
  },

  reset: () => {
    set({
      settings: null,
      loading: false,
      error: null,
      companyStatutorySettings: null,
      statutoryConfigurations: [],
      employeeStatutoryValues: [],
    });
  },
}));
