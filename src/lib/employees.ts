import { supabase } from './supabase';
import { getTenantId } from './tenantDb';

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  start_date: string;
  employee_code?: string;
  address?: string;
  date_of_birth?: string;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
}

export async function createEmployee(
  employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>,
  user_id: string
) {
  if (!user_id) {
    throw new Error('Login User ID is required');
  }

  // Get user's tenant_id
  const tenant_id = await getTenantId();

  // Check for duplicate email within tenant
  const { data: existingEmployeeWithEmail } = await supabase
    .from('employees')
    .select('id')
    .eq('email', employee.email)
    .eq('tenant_id', tenant_id)
    .maybeSingle();

  if (existingEmployeeWithEmail) {
    throw new Error('An employee with this email already exists in your organization');
  }

  // Check for duplicate employee code within tenant if one is provided
  if (employee.employee_code) {
    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_code', employee.employee_code)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (existingEmployee) {
      throw new Error('An employee with this employee code already exists in your organization');
    }
  }

  const { data, error } = await supabase
    .from('employees')
    .insert([
      {
        name: employee.name,
        email: employee.email,
        department: employee.department,
        role: employee.role,
        status: employee.status,
        start_date: employee.start_date,
        employee_code: employee.employee_code,
        address: employee.address,
        date_of_birth:
          employee.date_of_birth === '' ? null : employee.date_of_birth,
        created_by: user_id,
        tenant_id: tenant_id,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getEmployees() {
  const tenantId = await getTenantId();
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateEmployee(id: string, updates: Partial<Employee>) {
  // Get user's tenant_id
  const tenant_id = await getTenantId();

  // Check for duplicate email within tenant if email is being updated
  if (updates.email) {
    const { data: existingEmployeeWithEmail } = await supabase
      .from('employees')
      .select('id')
      .eq('email', updates.email)
      .eq('tenant_id', tenant_id)
      .neq('id', id)
      .maybeSingle();

    if (existingEmployeeWithEmail) {
      throw new Error('An employee with this email already exists in your organization');
    }
  }

  // Check for duplicate employee code within tenant if updating
  if (updates.employee_code) {
    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_code', updates.employee_code)
      .eq('tenant_id', tenant_id)
      .neq('id', id)
      .maybeSingle();

    if (existingEmployee) {
      throw new Error('An employee with this employee code already exists in your organization');
    }
  }

  const { data, error } = await supabase
    .from('employees')
    .update({
      name: updates.name,
      email: updates.email,
      department: updates.department,
      role: updates.role,
      status: updates.status,
      start_date: updates.start_date,
      employee_code: updates.employee_code,
      address: updates.address,
      date_of_birth:
        updates.date_of_birth === '' ? null : updates.date_of_birth,
    })
    .eq('id', id)
    .eq('tenant_id', tenant_id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteEmployee(id: string) {
  const tenantId = await getTenantId();
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(error.message);
  }
}
