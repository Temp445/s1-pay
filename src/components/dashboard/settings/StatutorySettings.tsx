import React, { useState, useEffect } from 'react';
import { Shield, Save, AlertCircle } from 'lucide-react';
import { useSettingsStore, type StatutoryConfiguration, type EmployeeStatutoryValue } from '../../../stores/settingsStore';
import { useEmployeesStore, type Employee } from '../../../stores/employeesStore';
import { supabase } from '../../../lib/supabase';
import { getTenantId } from '../../../lib/tenantDb';

export default function StatutorySettings() {
  const {
    companyStatutorySettings,
    fetchCompanyStatutorySettings,
    statutoryConfigurations,
    fetchStatutoryConfigurations,
    saveStatutoryConfiguration,
    fetchEmployeeStatutoryValues,
    saveEmployeeStatutoryValues,
    loading,
    error,
  } = useSettingsStore();

  const { items: employees, fetchEmployees } = useEmployeesStore();

  const [selectedElement, setSelectedElement] = useState<string>('');
  const [calculationMethod, setCalculationMethod] = useState<'percentage' | 'value'>('percentage');
  const [applicationType, setApplicationType] = useState<'same_to_all' | 'vary_employeewise'>('same_to_all');
  const [globalValue, setGlobalValue] = useState<string>('');
  const [employeeValues, setEmployeeValues] = useState<Map<string, string>>(new Map());
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Get list of applicable statutory elements from company settings
  const applicableElements = React.useMemo(() => {
    if (!companyStatutorySettings) return [];

    const elements: Array<{ value: string; label: string }> = [];

    if (companyStatutorySettings.provident_fund) {
      elements.push({ value: 'provident_fund', label: 'Provident Fund (PF)' });
    }
    if (companyStatutorySettings.employee_state_insurance) {
      elements.push({ value: 'employee_state_insurance', label: 'Employee State Insurance (ESI)' });
    }
    if (companyStatutorySettings.professional_tax) {
      elements.push({ value: 'professional_tax', label: 'Professional Tax' });
    }
    if (companyStatutorySettings.tax_deducted_at_source) {
      elements.push({ value: 'tax_deducted_at_source', label: 'Tax Deducted At Source (TDS)' });
    }

    return elements;
  }, [companyStatutorySettings]);

  // Load data on mount
  useEffect(() => {
    fetchCompanyStatutorySettings();
    fetchStatutoryConfigurations();
    fetchEmployees();
  }, [fetchCompanyStatutorySettings, fetchStatutoryConfigurations, fetchEmployees]);

  // Load saved configuration when element is selected
  useEffect(() => {
    const loadSavedConfiguration = async () => {
      if (!selectedElement) return;

      try {
        // Fetch existing configuration for this element
        const existingConfig = statutoryConfigurations.find(
          c => c.statutory_element === selectedElement
        );

        if (existingConfig) {
          // Load configuration values
          setCalculationMethod(existingConfig.calculation_method);
          setApplicationType(existingConfig.application_type);

          if (existingConfig.application_type === 'same_to_all' && existingConfig.global_value) {
            setGlobalValue(existingConfig.global_value.toString());
          }

          // Load employee selections and values
          if (existingConfig.id) {
            const savedEmployeeValues = await fetchEmployeeStatutoryValues(existingConfig.id);

            if (savedEmployeeValues && savedEmployeeValues.length > 0) {
              const employeeIds = new Set<string>();
              const valueMap = new Map<string, string>();

              savedEmployeeValues.forEach(ev => {
                employeeIds.add(ev.employee_id);
                valueMap.set(ev.employee_id, ev.value.toString());
              });

              setSelectedEmployees(employeeIds);
              setEmployeeValues(valueMap);
              setSelectAll(employeeIds.size === employees.length && employees.length > 0);
            }
          }
        }
      } catch (err) {
        console.error('Error loading saved configuration:', err);
      }
    };

    loadSavedConfiguration();
  }, [selectedElement, employees.length, fetchEmployeeStatutoryValues, statutoryConfigurations]);

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(employees.map(emp => emp.id)));
    }
    setSelectAll(!selectAll);
  };

  // Handle individual employee selection
  const handleEmployeeSelect = (employeeId: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployees(newSelected);
    setSelectAll(newSelected.size === employees.length);
  };

  // Handle employee value change
  const handleEmployeeValueChange = (employeeId: string, value: string) => {
    const newValues = new Map(employeeValues);
    newValues.set(employeeId, value);
    setEmployeeValues(newValues);
  };

  // Reset form
  const resetForm = () => {
    setSelectedElement('');
    setCalculationMethod('percentage');
    setApplicationType('same_to_all');
    setGlobalValue('');
    setEmployeeValues(new Map());
    setSelectedEmployees(new Set());
    setSelectAll(false);
    setSaveError(null);
  };

  // Helper function to get statutory element display name
  const getStatutoryElementDisplayName = (element: string): string => {
    const nameMap: Record<string, string> = {
      provident_fund: 'Provident Fund (PF)',
      employee_state_insurance: 'Employee State Insurance (ESI)',
      professional_tax: 'Professional Tax',
      tax_deducted_at_source: 'Tax Deducted At Source (TDS)',
    };
    return nameMap[element] || element;
  };

  // Create payroll_component entry for statutory element
  const createPayrollComponentForStatutory = async (config: StatutoryConfiguration) => {
    try {
      const tenantId = await getTenantId();
      const componentName = getStatutoryElementDisplayName(config.statutory_element);

      // Check if component already exists for this statutory configuration
      const { data: existing } = await supabase
        .from('payroll_components')
        .select('id, statutory_component_id')
        .eq('tenant_id', tenantId)
        .eq('name', componentName)
        .eq('component_type', 'deduction')
        .maybeSingle();

      if (!existing) {
        // Create new component with statutory_component_id
        const { error } = await supabase
          .from('payroll_components')
          .insert({
            name: componentName,
            description: `Statutory ${componentName}`,
            component_type: 'deduction',
            is_active: true,
            tenant_id: tenantId,
            statutory_component_id: config.id, // NEW: Link to statutory configuration
          });

        if (error) {
          console.error('Error creating payroll component:', error);
        }
      } else if (!existing.statutory_component_id && config.id) {
        // Update existing component to link to statutory configuration
        const { error } = await supabase
          .from('payroll_components')
          .update({
            statutory_component_id: config.id, // NEW: Add link if missing
          })
          .eq('id', existing.id);

        if (error) {
          console.error('Error updating payroll component:', error);
        }
      }
    } catch (error) {
      console.error('Error in createPayrollComponentForStatutory:', error);
    }
  };

  // Validate employee selections
  const validateEmployeeSelections = (): { valid: boolean; error?: string } => {
    // Validation for both application types: at least one employee must be selected
    if (selectedEmployees.size === 0) {
      return {
        valid: false,
        error: 'Please select at least one employee from the employee list'
      };
    }

    // Additional validation for "vary employeewise" - ensure selected employees have values
    if (applicationType === 'vary_employeewise') {
      let hasInvalidValue = false;
      const employeesWithoutValues: string[] = [];

      selectedEmployees.forEach(employeeId => {
        const value = employeeValues.get(employeeId);
        if (!value || parseFloat(value) <= 0) {
          hasInvalidValue = true;
          const employee = employees.find(e => e.id === employeeId);
          if (employee) {
            employeesWithoutValues.push(employee.name);
          }
        }
      });

      if (hasInvalidValue) {
        return {
          valid: false,
          error: `Please enter valid values for all selected employees: ${employeesWithoutValues.join(', ')}`
        };
      }
    }

    return { valid: true };
  };

  // Handle save
  const handleSave = async () => {
    try {
      setSaveError(null);
      setSaveSuccess(false);

      if (!selectedElement) {
        setSaveError('Please select a statutory element');
        return;
      }

      if (applicationType === 'same_to_all' && !globalValue) {
        setSaveError('Please enter a value');
        return;
      }

      // Validate employee selections for both application types
      const validation = validateEmployeeSelections();
      if (!validation.valid) {
        setSaveError(validation.error!);
        return;
      }

      // Save configuration
      const config: Omit<StatutoryConfiguration, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> = {
        statutory_element: selectedElement as any,
        calculation_method: calculationMethod,
        application_type: applicationType,
        global_value: applicationType === 'same_to_all' ? parseFloat(globalValue) : undefined,
        is_active: true,
      };

      const savedConfig = await saveStatutoryConfiguration(config);

      // Create corresponding payroll_component entry for the statutory element
      await createPayrollComponentForStatutory(savedConfig);

      // Save employee selections for both application types
      if (savedConfig.id && selectedEmployees.size > 0) {
        const values: Omit<EmployeeStatutoryValue, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>[] = [];

        selectedEmployees.forEach(employeeId => {
          let valueToSave: number;

          if (applicationType === 'vary_employeewise') {
            // For vary employeewise, use individual employee values
            const value = employeeValues.get(employeeId);
            valueToSave = value ? parseFloat(value) : 0;
          } else {
            // For same to all, use the global value for all selected employees
            valueToSave = parseFloat(globalValue);
          }

          if (valueToSave > 0) {
            values.push({
              employee_id: employeeId,
              configuration_id: savedConfig.id!,
              value: valueToSave,
            });
          }
        });

        if (values.length > 0) {
          await saveEmployeeStatutoryValues(values);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        resetForm();
      }, 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save configuration');
    }
  };

  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 flex items-center">
        <Shield className="h-5 w-5 mr-2 text-indigo-500" />
        Statutory Settings
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Configure statutory element settings and employee-specific values.
      </p>

      {/* Success Message */}
      {saveSuccess && (
        <div className="mt-4 rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                Statutory configuration saved successfully
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {(saveError || error) && (
        <div className="mt-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">
                {saveError || error}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* Statutory Element Selection */}
        <div>
          <label htmlFor="statutory-element" className="block text-sm font-medium text-gray-700">
            Statutory Elements Applicable
          </label>
          <select
            id="statutory-element"
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            value={selectedElement}
            onChange={(e) => setSelectedElement(e.target.value)}
          >
            <option value="">Select Statutory Element</option>
            {applicableElements.map((element) => (
              <option key={element.value} value={element.value}>
                {element.label}
              </option>
            ))}
          </select>
          {applicableElements.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              No statutory elements configured. Please configure them in Company Settings first.
            </p>
          )}
        </div>

        {selectedElement && (
          <>
            {/* Calculation Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Percentage / Value
              </label>
              <div className="mt-2">
                <select
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={calculationMethod}
                  onChange={(e) => setCalculationMethod(e.target.value as 'percentage' | 'value')}
                >
                  <option value="percentage">Percentage</option>
                  <option value="value">Fixed Value</option>
                </select>
              </div>
            </div>

            {/* Application Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Application Type
              </label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center">
                  <input
                    id="same-to-all"
                    type="radio"
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                    checked={applicationType === 'same_to_all'}
                    onChange={() => setApplicationType('same_to_all')}
                  />
                  <label htmlFor="same-to-all" className="ml-2 text-sm text-gray-700">
                    Same to All
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="vary-employeewise"
                    type="radio"
                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                    checked={applicationType === 'vary_employeewise'}
                    onChange={() => setApplicationType('vary_employeewise')}
                  />
                  <label htmlFor="vary-employeewise" className="ml-2 text-sm text-gray-700">
                    Vary Employeewise
                  </label>
                </div>
              </div>
            </div>

            {/* Global Value (Same to All) */}
            {applicationType === 'same_to_all' && (
              <div>
                <label htmlFor="global-value" className="block text-sm font-medium text-gray-700">
                  {calculationMethod === 'percentage' ? 'Percentage Value' : 'Fixed Value'}
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="number"
                    id="global-value"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md"
                    placeholder="0.00"
                    value={globalValue}
                    onChange={(e) => setGlobalValue(e.target.value)}
                    step="0.01"
                    min="0"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">
                      {calculationMethod === 'percentage' ? '%' : '₹'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Employee List - Always Visible for Both Application Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {applicationType === 'vary_employeewise' ? 'Employee Selection and Values' : 'Employee List'}
              </label>
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">
                        <input
                          type="checkbox"
                          className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                          checked={selectAll}
                          onChange={handleSelectAll}
                        />
                        <span className="ml-2">Select All</span>
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Employee Code
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Employee Name
                      </th>
                      {/* Value Entry Column - Only visible when Vary Employeewise is selected */}
                      {applicationType === 'vary_employeewise' && (
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Value Entry
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan={applicationType === 'vary_employeewise' ? 4 : 3} className="px-3 py-4 text-sm text-gray-500 text-center">
                          No employees found
                        </td>
                      </tr>
                    ) : (
                      employees.map((employee) => (
                        <tr key={employee.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                            <input
                              type="checkbox"
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                              checked={selectedEmployees.has(employee.id)}
                              onChange={() => handleEmployeeSelect(employee.id)}
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                            {employee.employee_code || '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                            {employee.name}
                          </td>
                          {/* Value Entry Column - Only visible when Vary Employeewise is selected */}
                          {applicationType === 'vary_employeewise' && (
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              <div className="relative rounded-md shadow-sm max-w-xs">
                                <input
                                  type="number"
                                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md disabled:bg-gray-100"
                                  placeholder="0.00"
                                  value={employeeValues.get(employee.id) || ''}
                                  onChange={(e) => handleEmployeeValueChange(employee.id, e.target.value)}
                                  disabled={!selectedEmployees.has(employee.id)}
                                  step="0.01"
                                  min="0"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                  <span className="text-gray-500 sm:text-sm">
                                    {calculationMethod === 'percentage' ? '%' : '₹'}
                                  </span>
                                </div>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-5 border-t border-gray-200">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={resetForm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
