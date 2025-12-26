import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Plus, UserPlus, Calendar, FileText, Users, Save, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { validateAuth } from '../../../stores/utils/storeUtils';
import { useSalaryStructuresStore, type SalaryStructureHeader, type SalaryStructureComponent } from '../../../stores/salaryStructuresStore';
import { useEmployeesStore, type Employee } from '../../../stores/employeesStore';
import { usePayrollStore } from '../../../stores/payrollStore';
import { validatePayrollPeriod, type PayrollCalculationResult } from '../../../lib/payrollCalculation';
import { format } from 'date-fns';

interface EmployeeSalaryStructure {
  id: string;
  employee_id: string;
  structure_id: string;
  effective_from: string;
  effective_to?: string;
  employee?: {
    employee_code: string;
    first_name: string;
    last_name: string;
    designation?: string;
  };
}

interface EditableComponent {
  id: string;
  name: string;
  component_type: 'earning' | 'deduction';
  calculation_type?: string;
  editability?: string;
  amount?: number;
  percentage_value?: number;
}

interface EmployeePayrollData {
  employeeSalaryStructureId: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  designation: string;
  selected: boolean;
  editableComponents: Record<string, number>;
  calculationResult?: PayrollCalculationResult;
  processedComponents?: {
    earnings: SalaryStructureComponent[];
    deductions: SalaryStructureComponent[];
  };
  totals?: {
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
  };
}

export default function PayrollProcessPage() {
  const { items: structures, fetchSalaryStructures, fetchSalaryStructureDetails } = useSalaryStructuresStore();
  const { items: allEmployees, fetchEmployees } = useEmployeesStore();
  const { createPayProcessEntry } = usePayrollStore();

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [structureComponents, setStructureComponents] = useState<SalaryStructureComponent[]>([]);
  const [editableComponents, setEditableComponents] = useState<EditableComponent[]>([]);

  const [employeeSalaryStructures, setEmployeeSalaryStructures] = useState<EmployeeSalaryStructure[]>([]);
  const [employeePayrollData, setEmployeePayrollData] = useState<EmployeePayrollData[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchSalaryStructures();
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedStructureId) {
      loadEmployeesForStructure();
      loadStructureComponents();
    } else {
      setEmployeeSalaryStructures([]);
      setEmployeePayrollData([]);
      setStructureComponents([]);
      setEditableComponents([]);
    }
  }, [selectedStructureId]);

  const loadStructureComponents = async () => {
    try {
      if (!selectedStructureId) return;

      const details = await fetchSalaryStructureDetails(selectedStructureId);
      if (details && details.length > 0) {
        const components = details[0].components || [];
        setStructureComponents(components);

        const editable = components.filter(
          c => c.editability === 'editable' || c.editability === 'enter_later'
        );
        setEditableComponents(editable);
      }
    } catch (err) {
      console.error('Error loading structure components:', err);
      setError('Failed to load salary structure components');
    }
  };

  const loadEmployeesForStructure = async () => {
    try {
      setLoading(true);
      setError(null);

      const auth = await validateAuth();
      if (!auth.isAuthenticated || !auth.tenantId) {
        setError('Authentication required');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('employee_salary_structures')
        .select(`
          id,
          employee_id,
          structure_id,
          effective_from,
          effective_to,
          employees:employee_id (
            employee_code,
            name,
            email,
            department
          )
        `)
        .eq('structure_id', selectedStructureId)
        .eq('employees.tenant_id', auth.tenantId)
        .is('effective_to', null)
        .order('employees(employee_code)', { ascending: true });

      if (fetchError) throw fetchError;

      const formatted = (data || []).map(item => ({
        id: item.id,
        employee_id: item.employee_id,
        structure_id: item.structure_id,
        effective_from: item.effective_from,
        effective_to: item.effective_to,
        employee: Array.isArray(item.employees) ? item.employees[0] : item.employees
      }));

      setEmployeeSalaryStructures(formatted);

      const payrollData: EmployeePayrollData[] = await Promise.all(
        formatted.map(async (ess) => {
          let editableComponentsData: Record<string, number> = {};

          const draftData = await loadDraftFromDatabase(ess.employee_id);

          if (draftData && Object.keys(draftData).length > 0) {
            editableComponentsData = draftData;
          } else {
            try {
              const { data: previousPayroll, error: payrollError } = await supabase
                .from('payroll')
                .select('salary_components')
                .eq('employee_id', ess.employee_id)
                .eq('tenant_id', auth.tenantId)
                .order('period_start', { ascending: false })
                .limit(1)
                .single();

              if (!payrollError && previousPayroll && previousPayroll.salary_components) {
                const components = previousPayroll.salary_components as SalaryStructureComponent[];

                components.forEach((comp) => {
                  if (comp.editability === 'enter_later' && comp.amount !== undefined) {
                    editableComponentsData[comp.name] = comp.amount;
                  }
                });
              }
            } catch (err) {
              console.log(`No previous payroll data for employee ${ess.employee?.employee_code || ess.employee_id}`);
            }
          }

          return {
            employeeSalaryStructureId: ess.id,
            employee_id: ess.employee_id,
            employee_code: ess.employee?.employee_code || '',
            employee_name: `${ess.employee?.name || ''}`.trim(),
            designation: ess.employee?.department || '',
            selected: false,
            editableComponents: editableComponentsData
          };
        })
      );

      setEmployeePayrollData(payrollData);
    } catch (err) {
      console.error('Error loading employees:', err);
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setEmployeePayrollData(prev =>
      prev.map(emp => ({ ...emp, selected: newSelectAll }))
    );
  };

  const handleSelectEmployee = (employeeId: string) => {
    setEmployeePayrollData(prev =>
      prev.map(emp =>
        emp.employee_id === employeeId ? { ...emp, selected: !emp.selected } : emp
      )
    );
  };

  const saveDraftToDatabase = useCallback(async (
    employeeId: string,
    componentValues: Record<string, number>
  ) => {
    try {
      if (!periodStart || !periodEnd || !selectedStructureId) {
        return;
      }

      const auth = await validateAuth();
      if (!auth.isAuthenticated || !auth.userId || !auth.tenantId) {
        return;
      }

      setSavingDraft(true);

      const { error } = await supabase
        .from('payroll_drafts')
        .upsert({
          employee_id: employeeId,
          structure_id: selectedStructureId,
          period_start: periodStart,
          period_end: periodEnd,
          component_values: componentValues,
          tenant_id: auth.tenantId,
          created_by: auth.userId,
          last_modified_by: auth.userId
        }, {
          onConflict: 'employee_id,structure_id,period_start,period_end,tenant_id'
        });

      if (error) {
        console.error('Error saving draft:', error);
      } else {
        setLastSaved(new Date());
      }
    } catch (err) {
      console.error('Failed to save draft:', err);
    } finally {
      setSavingDraft(false);
    }
  }, [periodStart, periodEnd, selectedStructureId]);

  const debouncedSaveDraft = useCallback((
    employeeId: string,
    componentValues: Record<string, number>
  ) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDraftToDatabase(employeeId, componentValues);
    }, 1000);
  }, [saveDraftToDatabase]);

  const loadDraftFromDatabase = useCallback(async (employeeId: string): Promise<Record<string, number>> => {
    try {
      if (!periodStart || !periodEnd || !selectedStructureId) {
        return {};
      }

      const auth = await validateAuth();
      if (!auth.isAuthenticated || !auth.tenantId) {
        return {};
      }

      const { data, error } = await supabase
        .from('payroll_drafts')
        .select('component_values')
        .eq('employee_id', employeeId)
        .eq('structure_id', selectedStructureId)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();

      if (error) {
        console.error('Error loading draft:', error);
        return {};
      }

      return data?.component_values || {};
    } catch (err) {
      console.error('Failed to load draft:', err);
      return {};
    }
  }, [periodStart, periodEnd, selectedStructureId]);

  const handleComponentValueChange = (employeeId: string, componentName: string, value: number) => {
    setEmployeePayrollData(prev =>
      prev.map(emp => {
        if (emp.employee_id === employeeId) {
          const updatedComponents = {
            ...emp.editableComponents,
            [componentName]: value
          };

          debouncedSaveDraft(employeeId, updatedComponents);

          return {
            ...emp,
            editableComponents: updatedComponents
          };
        }
        return emp;
      })
    );
  };

  const calculateComponentAmount = useCallback(
    (
      component: SalaryStructureComponent,
      allComponents: SalaryStructureComponent[]
    ): number => {
      if (component.calculation_type !== 'percentage') {
        return component.amount || 0;
      }

      if (
        component.calculation_type === 'percentage' &&
        component.percentage_value &&
        component.reference_components?.length
      ) {
        const baseAmount = component.reference_components.reduce(
          (total, ref) => {
            const refComponent = allComponents.find((c) => c.name === ref);
            return total + (refComponent ? refComponent.amount || 0 : 0);
          },
          0
        );

        return (baseAmount * parseFloat(component.percentage_value.toString())) / 100;
      }

      return 0;
    },
    []
  );

  const calculateTotal = useCallback(
    (components: SalaryStructureComponent[], allComponents: SalaryStructureComponent[]): number => {
      return components.reduce(
        (sum, comp) => sum + calculateComponentAmount(comp, allComponents),
        0
      );
    },
    [calculateComponentAmount]
  );

  const processPayroll = async () => {
    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);

      if (!periodStart || !periodEnd) {
        setError('Please select payroll period');
        return;
      }

      if (!selectedStructureId) {
        setError('Please select a salary structure');
        return;
      }

      const selectedEmployees = employeePayrollData.filter(emp => emp.selected);
      if (selectedEmployees.length === 0) {
        setError('Please select at least one employee');
        return;
      }

      const auth = await validateAuth();
      if (!auth.isAuthenticated || !auth.userId || !auth.tenantId) {
        setError('Authentication required');
        return;
      }

      let processedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const empData of selectedEmployees) {
        try {
          let calculationResult: PayrollCalculationResult | null = null;

          try {
            calculationResult = await validatePayrollPeriod({
              employeeId: empData.employee_id,
              startDate: periodStart,
              endDate: periodEnd,
            });
          } catch (validationErr) {
            console.warn('Attendance validation skipped:', validationErr);
          }

          let processedEarnings = structureComponents
            .filter(c => c.component_type === 'earning')
            .map(c => {
              let component = { ...c };

              if (c.editability === 'editable' || c.editability === 'enter_later') {
                const editedValue = empData.editableComponents[c.name];
                if (editedValue !== undefined) {
                  component.amount = editedValue;
                }
              }

              return component;
            });

          let processedDeductions = structureComponents
            .filter(c => c.component_type === 'deduction')
            .map(c => {
              let component = { ...c };

              if (c.editability === 'editable' || c.editability === 'enter_later') {
                const editedValue = empData.editableComponents[c.name];
                if (editedValue !== undefined) {
                  component.amount = editedValue;
                }
              }

              return component;
            });

          if (calculationResult && calculationResult.payableDaysFactor < 1 && calculationResult.payableDaysFactor > 0) {
            processedEarnings = processedEarnings.map((component) => {
              if (component.calculation_type !== 'percentage' && component.amount) {
                const originalAmount = component.amount;
                const adjustedAmount = originalAmount * calculationResult!.payableDaysFactor;
                return {
                  ...component,
                  amount: parseFloat(adjustedAmount.toFixed(2)),
                };
              }
              return component;
            });

            processedDeductions = processedDeductions.map((component) => {
              if (component.calculation_type !== 'percentage' && component.amount) {
                const originalAmount = component.amount;
                const adjustedAmount = originalAmount * calculationResult!.payableDaysFactor;
                return {
                  ...component,
                  amount: parseFloat(adjustedAmount.toFixed(2)),
                };
              }
              return component;
            });
          }

          const allProcessedComponents = [...processedEarnings, ...processedDeductions];

          processedEarnings = processedEarnings.map(comp => ({
            ...comp,
            amount: calculateComponentAmount(comp, allProcessedComponents)
          }));

          processedDeductions = processedDeductions.map(comp => ({
            ...comp,
            amount: calculateComponentAmount(comp, allProcessedComponents)
          }));

          const finalAllComponents = [...processedEarnings, ...processedDeductions];
          const grossSalary = calculateTotal(processedEarnings, finalAllComponents);
          const totalDeductions = calculateTotal(processedDeductions, finalAllComponents);
          const netSalary = grossSalary - totalDeductions;

          const attendanceSummary = calculationResult ? {
            total_working_days: calculationResult.totalWorkingDays,
            total_present_days: calculationResult.totalPresentDays,
            total_absent_days: calculationResult.totalAbsentDays,
            total_leave_days: calculationResult.totalLeaveDays,
            total_paid_leave_days: calculationResult.totalPaidLeaveDays,
            payable_days_factor: calculationResult.payableDaysFactor,
          } : undefined;

          await createPayProcessEntry({
            employee_id: empData.employee_id,
            employee_code: empData.employee_code,
            period_start: periodStart,
            period_end: periodEnd,
            salary_components: [...processedEarnings, ...processedDeductions],
            deduction_components: processedDeductions,
            total_amount: netSalary,
            status: 'Draft',
            payment_date: null,
            attendance_summary: attendanceSummary,
          });

          processedCount++;
        } catch (err) {
          console.error(`Error processing payroll for employee ${empData.employee_code}:`, err);
          errorCount++;
          errors.push(`${empData.employee_code}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      if (errorCount > 0) {
        setError(`Processed ${processedCount} employees successfully. ${errorCount} failed:\n${errors.join('\n')}`);
      } else {
        setSuccess(`Successfully processed payroll for ${processedCount} employees`);
        setEmployeePayrollData(prev => prev.map(emp => ({ ...emp, selected: false })));
        setSelectAll(false);
      }
    } catch (err) {
      console.error('Error processing payroll:', err);
      setError(err instanceof Error ? err.message : 'Failed to process payroll');
    } finally {
      setProcessing(false);
    }
  };

  const loadAvailableEmployees = async () => {
    try {
      const auth = await validateAuth();
      if (!auth.isAuthenticated || !auth.tenantId) return;

      const currentEmployeeIds = employeeSalaryStructures.map(ess => ess.employee_id);
      const available = allEmployees.filter(emp => !currentEmployeeIds.includes(emp.id || ''));
      setAvailableEmployees(available);
    } catch (err) {
      console.error('Error loading available employees:', err);
    }
  };

  const addEmployeeToStructure = async (employeeId: string) => {
    try {
      if (!selectedStructureId || !periodStart) {
        setError('Please select structure and period first');
        return;
      }

      const auth = await validateAuth();
      if (!auth.isAuthenticated || !auth.userId || !auth.tenantId) {
        setError('Authentication required');
        return;
      }

      const { data, error: insertError } = await supabase
        .from('employee_salary_structures')
        .insert({
          employee_id: employeeId,
          structure_id: selectedStructureId,
          effective_from: periodStart,
          created_by: auth.userId,
          tenant_id: auth.tenantId
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setShowAddEmployeeModal(false);
      await loadEmployeesForStructure();
      setSuccess('Employee added to structure successfully');
    } catch (err) {
      console.error('Error adding employee:', err);
      setError(err instanceof Error ? err.message : 'Failed to add employee');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Process</h1>
          <p className="mt-1 text-sm text-gray-500">Process payroll for multiple employees with attendance-based calculations</p>
        </div>
        {lastSaved && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-md">
            <CheckCircle className="h-4 w-4" />
            <span>Draft saved at {lastSaved.toLocaleTimeString()}</span>
          </div>
        )}
        {savingDraft && (
          <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-md">
            <Save className="h-4 w-4 animate-pulse" />
            <span>Saving draft...</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg whitespace-pre-line">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Period Start
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Period End
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="inline h-4 w-4 mr-1" />
              Salary Structure
            </label>
            <select
              value={selectedStructureId}
              onChange={(e) => setSelectedStructureId(e.target.value)}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Select Structure</option>
              {structures.map((structure) => (
                <option key={structure.id} value={structure.id}>
                  {structure.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedStructureId && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <Users className="h-5 w-5 text-gray-400 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Employees ({employeePayrollData.length})
              </h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  loadAvailableEmployees();
                  setShowAddEmployeeModal(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-indigo-300 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Employee
              </button>
              <button
                onClick={processPayroll}
                disabled={processing || employeePayrollData.filter(e => e.selected).length === 0}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Play className="h-4 w-4 mr-2" />
                {processing ? 'Processing...' : 'Process Payroll'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading employees...</div>
          ) : employeePayrollData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No employees found for this structure. Click "Add Employee" to add employees.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Designation
                    </th>
                    {editableComponents.map((component) => (
                      <th
                        key={component.id}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {component.name}
                        <span className="block text-xs text-gray-400 normal-case">
                          ({component.component_type})
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employeePayrollData.map((employee) => (
                    <tr key={employee.employee_id} className={employee.selected ? 'bg-indigo-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={employee.selected}
                          onChange={() => handleSelectEmployee(employee.employee_id)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.employee_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.employee_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.designation}
                      </td>
                      {editableComponents.map((component) => (
                        <td key={component.id} className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={employee.editableComponents[component.name] || ''}
                            onChange={(e) =>
                              handleComponentValueChange(
                                employee.employee_id,
                                component.name,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="Enter value"
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            step="0.01"
                            min="0"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAddEmployeeModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAddEmployeeModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Add Employee to Structure
                    </h3>
                    <div className="mt-2">
                      {availableEmployees.length === 0 ? (
                        <p className="text-sm text-gray-500">No available employees to add</p>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {availableEmployees.map((employee) => (
                            <button
                              key={employee.id}
                              onClick={() => addEmployeeToStructure(employee.id!)}
                              className="w-full text-left px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <div className="font-medium text-gray-900">
                                 {employee.employee_code} - {employee.name}
                              </div>
                              <div className="text-sm text-gray-500">{employee.department}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowAddEmployeeModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
