import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, Percent, DollarSign, Lock } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  useSalaryStructuresStore,
  type SalaryStructureHeader,
  type SalaryStructure,
  type SalaryStructureComponent,
  type ComponentType,
} from '../../../stores/salaryStructuresStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { supabase } from '../../../lib/supabase';
import { getTenantId } from '../../../lib/tenantDb';

interface AddSalaryStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStructureCreated: () => void;
  selectedStructure?: SalaryStructureHeader | null; // ✅ Accept selected structure
}

export default function AddPayStructureModal({
  isOpen,
  onClose,
  onStructureCreated,
  selectedStructure,
}: AddSalaryStructureModalProps) {
  const { user } = useAuth();
  const {
    salaryComponentTypes,
    deductionComponentTypes,
    componentTypesLoading,
    fetchSalaryComponentTypes,
    fetchDeductionComponentTypes,
    fetchSalaryStructureDetails,
    createSalaryStructure,
    updateSalaryStructure,
  } = useSalaryStructuresStore();
  const {
    companyStatutorySettings,
    fetchCompanyStatutorySettings,
    statutoryConfigurations,
    fetchStatutoryConfigurations,
  } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const componentRefs = useRef<
    Record<string, HTMLInputElement | HTMLSelectElement | null>
  >({});
  const [lastKeyNumber, setLastKeyNumber] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  // Track which statutory buttons are disabled
  const [disabledStatutoryButtons, setDisabledStatutoryButtons] = useState<
    Set<string>
  >(new Set());
  // Track available statutory deductions
  const [availableStatutoryDeductions, setAvailableStatutoryDeductions] =
    useState<SalaryStructureComponent[]>([]);

  // Helper to get statutory deductions from settings
  const getStatutoryDeductions = async (): Promise<
    SalaryStructureComponent[]
  > => {
    if (!companyStatutorySettings || !statutoryConfigurations) return [];

    const tenantId = await getTenantId();
    const components: SalaryStructureComponent[] = [];

    // Map of statutory elements
    const statutoryMap = {
      provident_fund: 'Provident Fund (PF)',
      employee_state_insurance: 'Employee State Insurance (ESI)',
      professional_tax: 'Professional Tax',
      tax_deducted_at_source: 'Tax Deducted At Source (TDS)',
    };

    // UPDATED: Check each statutory element and load ALL applicable ones
    for (const [key, displayName] of Object.entries(statutoryMap)) {
      if (
        companyStatutorySettings[key as keyof typeof companyStatutorySettings]
      ) {
        // Find configuration for this element
        const config = statutoryConfigurations.find(
          (c) => c.statutory_element === key && c.is_active
        );

        // UPDATED: Load ALL configured statutory elements (removed global_value check)
        if (config) {
          // UPDATED: Get component ID using statutory_component_id relationship
          const { data: payrollComponent } = await supabase
            .from('payroll_components')
            .select('id, name')
            .eq('tenant_id', tenantId)
            .eq('statutory_component_id', config.id) // NEW: Use ID-based lookup
            .eq('component_type', 'deduction')
            .maybeSingle();

          // Use the name from the database or fallback to displayName
          const componentName = payrollComponent?.name || displayName;

          // UPDATED: Set editability based on application_type
          // "Same to All" → Fixed (not editable in payroll)
          // "Vary Employee wise" → Enter Later (must be entered in payroll)
          const editability =
            config.application_type === 'same_to_all' ? 'fixed' : 'enter_later';

          // UPDATED: For "Vary Employee wise", set amount/percentage to 0
          let amount: number | undefined;
          let percentage_value: number | undefined;

          if (config.application_type === 'same_to_all') {
            // Use the configured global value
            amount =
              config.calculation_method === 'value'
                ? config.global_value
                : undefined;
            percentage_value =
              config.calculation_method === 'percentage'
                ? config.global_value
                : undefined;
          } else {
            // For "vary_employeewise", set to 0 (will be entered in payroll)
            amount = config.calculation_method === 'value' ? 0 : undefined;
            percentage_value =
              config.calculation_method === 'percentage' ? 0 : undefined;
          }

          components.push({
            key: `SD${components.length + 1}`,
            id: payrollComponent?.id || '',
            name: componentName, // Use the actual component name from DB
            component_type: 'deduction',
            isCustom: false,
            isStatutory: true,
            // NEW: Use two-set system
            calculation_type:
              config.calculation_method === 'percentage'
                ? 'percentage'
                : 'value',
            editability: editability, // UPDATED: Based on application_type
            amount: amount, // UPDATED: 0 for vary_employeewise
            percentage_value: percentage_value, // UPDATED: 0 for vary_employeewise
            reference_components: [],
            is_taxable: false,
            description: `Statutory ${componentName}`,
            display_order: components.length,
          });
        }
      }
    }

    return components;
  };

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    is_active: boolean;
    earnings: SalaryStructureComponent[];
    deductions: SalaryStructureComponent[];
  }>({
    name: '',
    description: '',
    is_active: true,
    earnings: [],
    deductions: [],
  });

  useEffect(() => {
    if (isOpen) {
      fetchSalaryComponentTypes();
      fetchDeductionComponentTypes();
      fetchCompanyStatutorySettings();
      fetchStatutoryConfigurations();
    }
  }, [
    isOpen,
    fetchSalaryComponentTypes,
    fetchDeductionComponentTypes,
    fetchCompanyStatutorySettings,
    fetchStatutoryConfigurations,
  ]);

  // Load available statutory deductions (don't auto-add them)
  useEffect(() => {
    const loadAvailableStatutoryDeductions = async () => {
      if (!isOpen) return;

      const statutoryDeductions = await getStatutoryDeductions();
      setAvailableStatutoryDeductions(statutoryDeductions);

      // Disable buttons for statutory deductions already in the form
      const existingStatutory = formData.deductions
        .filter((d) => d.isStatutory)
        .map((d) => d.name);
      setDisabledStatutoryButtons(new Set(existingStatutory));
    };

    loadAvailableStatutoryDeductions();
  }, [
    isOpen,
    companyStatutorySettings,
    statutoryConfigurations,
    formData.deductions,
  ]);

  useEffect(() => {
    if (selectedStructure) {
      const loadStructureComponents = async () => {
        try {
          setLoading(true);
          if (selectedStructure.id) {
            const fetchedStructureDetails = await fetchSalaryStructureDetails(
              selectedStructure.id
            );
            const tenantId = await getTenantId();

            // UPDATED: Fetch statutory components to identify which components are statutory
            const { data: statutoryComponents } = await supabase
              .from('payroll_components')
              .select('id, name, statutory_component_id')
              .eq('tenant_id', tenantId)
              .eq('component_type', 'deduction')
              .not('statutory_component_id', 'is', null);

            const statutoryComponentIds = new Set(
              statutoryComponents?.map((c) => c.id) || []
            );

            let maxKeyNumber = 0;

            const updatedEarnings = fetchedStructureDetails[0].components
              .filter((c) => c.component_type === 'earning')
              .map((comp) => {
                return {
                  ...comp,
                  key: `E${++maxKeyNumber}`,
                  // UPDATED: Ensure calculation_type and editability are set
                  calculation_type:
                    comp.calculation_type ||
                    (comp.calculation_method === 'percentage'
                      ? 'percentage'
                      : 'value'),
                  editability: comp.editability || 'fixed',
                };
              });

            // UPDATED: Identify statutory deductions and set isStatutory flag
            const updatedDeductions = fetchedStructureDetails[0].components
              .filter((c) => c.component_type === 'deduction')
              .map((comp) => {
                // Check if this component is statutory
                const isStatutory = comp.id
                  ? statutoryComponentIds.has(comp.id)
                  : false;

                return {
                  ...comp,
                  key: isStatutory
                    ? `SD${++maxKeyNumber}`
                    : `D${++maxKeyNumber}`,
                  isStatutory: isStatutory,
                  // UPDATED: Ensure calculation_type and editability are set
                  calculation_type:
                    comp.calculation_type ||
                    (comp.calculation_method === 'percentage'
                      ? 'percentage'
                      : 'value'),
                  editability: comp.editability || 'fixed',
                };
              });

            setLastKeyNumber(maxKeyNumber); // ✅ Ensure state maintains the last used number

            setFormData({
              name: fetchedStructureDetails[0].name,
              description: fetchedStructureDetails[0].description || '',
              is_active: fetchedStructureDetails[0].is_active,
              earnings: updatedEarnings,
              deductions: updatedDeductions,
            });

            // UPDATED: Update disabled buttons based on existing statutory deductions
            const existingStatutoryNames = updatedDeductions
              .filter((d) => d.isStatutory)
              .map((d) => d.name);
            setDisabledStatutoryButtons(new Set(existingStatutoryNames));
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Failed to load structures'
          );
        } finally {
          setLoading(false);
        }
      };

      loadStructureComponents();
    }
  }, [selectedStructure]);

  // NEW: Function to add a statutory deduction
  const addStatutoryDeduction = (statutoryName: string) => {
    // Find the statutory deduction configuration
    const statutoryConfig = availableStatutoryDeductions.find(
      (d) => d.name === statutoryName
    );
    if (!statutoryConfig) return;

    // Disable the button immediately
    setDisabledStatutoryButtons((prev) => new Set(prev).add(statutoryName));

    // Create a new key for the component
    const newKey = `SD${lastKeyNumber + 1}`;
    setLastKeyNumber((prevKey) => prevKey + 1);

    // Add the statutory deduction with locked fields
    const newStatutoryDeduction: SalaryStructureComponent = {
      ...statutoryConfig,
      key: newKey,
      display_order: formData.earnings.length + formData.deductions.length,
    };

    setFormData((prev) => ({
      ...prev,
      deductions: [...prev.deductions, newStatutoryDeduction],
    }));
  };

  const addComponent = (type: 'earning' | 'deduction') => {
    setFormData((prev) => {
      // Get all existing components
      const allComponents = [...prev.earnings, ...prev.deductions];

      // Find the first component with an empty name
      const emptyComponent = allComponents.find(
        (comp) => comp.name.trim() === ''
      );

      if (emptyComponent) {
        // Focus on the input field of the empty component
        if (componentRefs.current[emptyComponent.key]) {
          componentRefs.current[emptyComponent.key]?.focus();
        }
        alert(
          'Please fill in the name for the existing component before adding a new one.'
        );
        return prev; // ❌ Prevent adding a new component
      }

      const newKey = `${type === 'earning' ? 'E' : 'D'}${lastKeyNumber + 1}`;
      setLastKeyNumber((prevKey) => prevKey + 1); // ✅ Increment key counter

      let newComponent = {
        key: newKey,
        id: '',
        name: '',
        component_type: type,
        isCustom: false,
        // NEW: Default to value type with fixed editability
        calculation_type: 'value' as 'value' | 'percentage',
        editability: 'fixed' as 'fixed' | 'editable' | 'enter_later',
        is_taxable: type === 'earning',
        reference_components: [],
        display_order: prev.earnings.length + prev.deductions.length,
      };

      return {
        ...prev,
        [type === 'earning' ? 'earnings' : 'deductions']: [
          ...prev[type === 'earning' ? 'earnings' : 'deductions'],
          newComponent,
        ],
      };
    });
  };

  const removeComponent = (type: 'earning' | 'deduction', index: number) => {
    const componentToRemove =
      formData[type === 'earning' ? 'earnings' : 'deductions'][index];

    // If removing a statutory component, re-enable its button
    if (componentToRemove.isStatutory && type === 'deduction') {
      setDisabledStatutoryButtons((prev) => {
        const newSet = new Set(prev);
        newSet.delete(componentToRemove.name);
        return newSet;
      });
    }

    setFormData((prev) => ({
      ...prev,
      [type === 'earning' ? 'earnings' : 'deductions']: prev[
        type === 'earning' ? 'earnings' : 'deductions'
      ].filter((_, i) => i !== index),
    }));
  };

  const updateComponent = (
    type: 'earning' | 'deduction',
    index: number,
    updates: Partial<SalaryStructureComponent>
  ) => {
    setFormData((prev) => {
      const existingNames = [...prev.earnings, ...prev.deductions]
        .filter((comp, i) => comp.key !== updates.key) // ✅ Exclude current component to allow renaming
        .map((c) => c.name.toLowerCase());

      if (updates.name && existingNames.includes(updates.name.toLowerCase())) {
        // Find the duplicate component
        const duplicateComp = [...prev.earnings, ...prev.deductions].find(
          (c) => c.name.toLowerCase() === updates.name?.toLowerCase()
        );
        if (duplicateComp && componentRefs.current[duplicateComp.key]) {
          componentRefs.current[duplicateComp.key]?.focus(); // ✅ Focus on the duplicate component
        }

        alert('Component name already exists! Please use a different name.');
        return prev; // ❌ Prevent updating to a duplicate name
      }

      return {
        ...prev,
        [type === 'earning' ? 'earnings' : 'deductions']: prev[
          type === 'earning' ? 'earnings' : 'deductions'
        ].map((comp, i) => (i === index ? { ...comp, ...updates } : comp)),
      };
    });
  };

  const calculateComponentAmount = useCallback(
    (
      component: SalaryStructureComponent,
      allComponents: SalaryStructureComponent[]
    ) => {
      // FIXED: Use calculation_type instead of calculation_method
      if (component.calculation_type !== 'percentage') {
        return component.amount || 0; // Correctly returning value-based amount
      }

      // FIXED: Calculate percentage-based components
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

        return (
          (baseAmount * parseFloat(component.percentage_value.toString())) / 100
        );
      }

      return 0;
    },
    []
  );

  const calculateTotal = (type: 'earning' | 'deduction') => {
    return formData[type === 'earning' ? 'earnings' : 'deductions'].reduce(
      (sum, comp) =>
        sum +
        calculateComponentAmount(comp, [
          ...formData.earnings,
          ...formData.deductions,
        ]),
      0
    );
  };

  // Update component calculations
  useEffect(() => {
    setFormData((prevData) => {
      const updatedComponents = [...prevData.earnings, ...prevData.deductions];
      let hasUpdates = false;

      updatedComponents.forEach((component, index) => {
        const newAmount = calculateComponentAmount(
          component,
          updatedComponents
        );
        if (
          newAmount.toFixed(2) !==
          (component.amount ? component.amount.toFixed(2) : '0.00')
        ) {
          updatedComponents[index] = {
            ...component,
            amount: parseFloat(newAmount.toFixed(2)),
          };
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        return {
          ...prevData,
          earnings: updatedComponents.filter(
            (c) => c.component_type === 'earning'
          ),
          deductions: updatedComponents.filter(
            (c) => c.component_type === 'deduction'
          ),
        };
      }

      return prevData;
    });
  }, [formData.earnings, formData.deductions, calculateComponentAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      setValidationError(null);

      // Validate that all statutory components are included
      const statutoryDeductions = await getStatutoryDeductions();
      const missingStatutory = statutoryDeductions.filter(
        (statutory) =>
          !formData.deductions.some((d) => d.name === statutory.name)
      );

      if (missingStatutory.length > 0) {
        const missingNames = missingStatutory.map((d) => d.name).join(', ');
        setValidationError(
          `Missing required statutory deductions: ${missingNames}`
        );
        setLoading(false);
        return;
      }

      const structureData = {
        id: selectedStructure?.id, // Only include id if editing
        ...formData,
        components: [...formData.earnings, ...formData.deductions],
      };

      if (selectedStructure) {
        if (structureData.id) {
          await updateSalaryStructure(structureData.id, structureData);
        } else {
          throw new Error('Structure ID is undefined');
        }
      } else {
        await createSalaryStructure(structureData);
      }

      onStructureCreated();
      onClose();
      setFormData({
        name: '',
        description: '',
        is_active: true,
        earnings: [],
        deductions: [],
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save salary structure'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              onClick={onClose}
              className="bg-white rounded-md text-gray-400 hover:text-gray-500"
              aria-label="Close Modal"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Create Salary Structure
            </h3>

            {error && <div className="mt-2 text-red-600">{error}</div>}
            {validationError && (
              <div className="mt-2 text-red-600 bg-red-50 border border-red-200 rounded p-3">
                {validationError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              <input
                type="text"
                placeholder="Structure Name"
                required
                className="w-full border p-2"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              <textarea
                placeholder="Description"
                className="w-full border p-2"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />

              <div>
                <h4 className="font-medium">Earnings</h4>
                <button
                  type="button"
                  onClick={() => addComponent('earning')}
                  className="text-indigo-600"
                >
                  <Plus className="h-4 w-4 inline" /> Add Earning
                </button>
              </div>
              {formData.earnings.map((component, index) => (
                <div
                  key={component.key}
                  className="mb-4 p-4 border rounded-lg bg-gray-50"
                >
                  <div className="grid grid-cols-1 gap-4">
                    {/* Component Name Selection */}
                    <div className="flex gap-2">
                      <select
                        className="w-24 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={component.isCustom ? 'custom' : 'predefined'}
                        onChange={(e) =>
                          updateComponent('earning', index, {
                            isCustom: e.target.value === 'custom',
                            name: '',
                          })
                        }
                        aria-label="Salary Component Type"
                      >
                        <option value="predefined">Select</option>
                        <option value="custom">Custom</option>
                      </select>
                      {component.isCustom ? (
                        <input
                          type="text"
                          placeholder="Enter component name"
                          className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={component.name}
                          onChange={(e) =>
                            updateComponent('earning', index, {
                              name: e.target.value,
                            })
                          }
                          ref={(el) =>
                            (componentRefs.current[component.key] = el)
                          } // ✅ Store ref for focus
                          required
                        />
                      ) : (
                        <select
                          className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={JSON.stringify({
                            id: component.id,
                            name: component.name,
                          })}
                          // onChange={(e) => updateComponent('earning', index, { name: e.target.value })}
                          onChange={(e) => {
                            const { id, name } = JSON.parse(e.target.value);
                            updateComponent('earning', index, { name, id });
                          }}
                          aria-label="Salary Component Type"
                          ref={(el) =>
                            (componentRefs.current[component.key] = el)
                          } // ✅ Store ref for focus
                          required
                        >
                          <option value="">Select Component</option>
                          {salaryComponentTypes.map((type) => (
                            <option
                              key={type.id}
                              value={JSON.stringify({
                                id: type.id,
                                name: type.name,
                              })}
                            >
                              {type.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* NEW: First Set - Calculation Type */}
                    <div className="border-b pb-3 mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Calculation Type
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            className="form-radio h-4 w-4 text-indigo-600"
                            checked={component.calculation_type === 'value'}
                            onChange={() =>
                              updateComponent('earning', index, {
                                calculation_type: 'value',
                                percentage_value: undefined,
                                reference_components: [],
                              })
                            }
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Value (Fixed Amount)
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            className="form-radio h-4 w-4 text-indigo-600"
                            checked={
                              component.calculation_type === 'percentage'
                            }
                            onChange={() =>
                              updateComponent('earning', index, {
                                calculation_type: 'percentage',
                                amount: undefined,
                              })
                            }
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Percentage (% of other components)
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* NEW: Second Set - Editability */}
                    <div className="border-b pb-3 mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Editability in Payroll Entry
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            className="form-radio h-4 w-4 text-indigo-600"
                            checked={component.editability === 'fixed'}
                            onChange={() =>
                              updateComponent('earning', index, {
                                editability: 'fixed',
                              })
                            }
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Fixed (Not Editable)
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            className="form-radio h-4 w-4 text-indigo-600"
                            checked={component.editability === 'editable'}
                            onChange={() =>
                              updateComponent('earning', index, {
                                editability: 'editable',
                              })
                            }
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Editable
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            className="form-radio h-4 w-4 text-indigo-600"
                            checked={component.editability === 'enter_later'}
                            onChange={() =>
                              updateComponent('earning', index, {
                                editability: 'enter_later',
                              })
                            }
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Enter Later
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Amount Input or Percentage Configuration */}
                    {component.calculation_type !== 'percentage' ? (
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">₹</span>
                        </div>
                        <input
                          type="number"
                          placeholder={
                            component.editability === 'enter_later'
                              ? 'Amount (Optional - Enter in Payroll)'
                              : 'Amount'
                          }
                          className="block w-full pl-7 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={component.amount || ''}
                          onChange={(e) =>
                            updateComponent('earning', index, {
                              amount: parseFloat(e.target.value),
                            })
                          }
                          required={component.editability !== 'enter_later'}
                          min="0"
                          step="0.01"
                        />
                        {component.editability === 'enter_later' && (
                          <p className="mt-1 text-xs text-gray-500">
                            This field is optional. Value must be entered during
                            payroll processing.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <select
                            multiple
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={(component.reference_components || [])
                              .map((ref) => {
                                const matchedComponent = formData.earnings
                                  .concat(formData.deductions)
                                  .find((c) => c.name === ref);
                                return matchedComponent
                                  ? matchedComponent.name
                                  : undefined;
                              })
                              .filter(
                                (name): name is string => name !== undefined
                              )}
                            onChange={(e) => {
                              const selectedOptions = Array.from(
                                e.target.selectedOptions
                              ).map((opt) => opt.value);
                              updateComponent(component.component_type, index, {
                                reference_components: selectedOptions,
                              }); // ✅ Store only 'id'
                            }}
                            size={4}
                            aria-label="Reference Salary Components"
                          >
                            {formData.earnings
                              .concat(formData.deductions) // ✅ Ensure all previous components are selectable
                              .filter((comp) => {
                                const allComponents = [
                                  ...formData.earnings,
                                  ...formData.deductions,
                                ];
                                const currentIndex = allComponents.findIndex(
                                  (c) => c.name === component.name
                                );
                                return (
                                  allComponents.findIndex(
                                    (c) => c.name === comp.name
                                  ) < currentIndex
                                );
                              })
                              .map((comp) => (
                                <option key={comp.key} value={comp.name}>
                                  {comp.name}{' '}
                                  {comp.amount
                                    ? `($${comp.amount.toFixed(2)})`
                                    : ''}
                                </option>
                              ))}
                          </select>

                          <p className="mt-1 text-xs text-gray-500">
                            Hold Ctrl/Cmd to select multiple components
                          </p>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            placeholder="Percentage"
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 pr-8 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={component.percentage_value || ''}
                            onChange={(e) =>
                              updateComponent('earning', index, {
                                ...component,
                                percentage_value: parseFloat(e.target.value),
                              })
                            }
                            required
                            min="0"
                            max="100"
                            step="0.01"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Calculated Amount Display for Percentage */}
                    {component.calculation_method === 'percentage' && (
                      <div className="text-sm text-gray-500">
                        Calculated Amount: ₹{component.amount || '0'}
                      </div>
                    )}

                    {/* Remove Button */}
                    {formData.earnings.length > 1 && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeComponent('earning', index)}
                          className="inline-flex items-center px-2 py-1 border border-transparent rounded-md text-sm font-medium text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div>
                <h4 className="font-medium">Deductions</h4>
                {/* EXISTING: Add Deduction button - functionality unchanged */}
                <button
                  type="button"
                  onClick={() => addComponent('deduction')}
                  className="text-red-600 mr-2"
                >
                  <Plus className="h-4 w-4 inline" /> Add Deduction
                </button>

                {/* NEW: Individual statutory element buttons */}
                {availableStatutoryDeductions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-sm text-gray-600 mr-2">
                      Add Statutory:
                    </span>
                    {availableStatutoryDeductions.map((statutory) => (
                      <button
                        key={statutory.name}
                        type="button"
                        onClick={() => addStatutoryDeduction(statutory.name)}
                        disabled={disabledStatutoryButtons.has(statutory.name)}
                        className={`inline-flex items-center px-3 py-1 border rounded-md text-sm font-medium ${
                          disabledStatutoryButtons.has(statutory.name)
                            ? 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed'
                            : 'border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                        }`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {statutory.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {formData.deductions.map((component, index) => (
                <div
                  key={component.key}
                  className={`mb-4 p-4 border rounded-lg ${
                    component.isStatutory
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'bg-gray-50'
                  }`}
                >
                  {component.isStatutory && (
                    <div className="flex items-center mb-2 text-indigo-700 text-sm font-medium">
                      <Lock className="h-4 w-4 mr-1" />
                      Statutory Deduction (Locked)
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4">
                    {/* Component Name Selection */}
                    <div className="flex gap-2">
                      {component.isStatutory ? (
                        <input
                          type="text"
                          className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 text-gray-600 cursor-not-allowed sm:text-sm"
                          value={component.name}
                          disabled
                          readOnly
                        />
                      ) : (
                        <>
                          <select
                            className="w-24 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={component.isCustom ? 'custom' : 'predefined'}
                            onChange={(e) =>
                              updateComponent('deduction', index, {
                                isCustom: e.target.value === 'custom',
                                name: '',
                              })
                            }
                            aria-label="Deduction Component Type"
                          >
                            <option value="predefined">Select</option>
                            <option value="custom">Custom</option>
                          </select>
                          {component.isCustom ? (
                            <input
                              type="text"
                              placeholder="Enter deduction name"
                              className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                              value={component.name}
                              onChange={(e) =>
                                updateComponent('deduction', index, {
                                  name: e.target.value,
                                })
                              }
                              ref={(el) =>
                                (componentRefs.current[component.key] = el)
                              }
                              required
                            />
                          ) : (
                            <select
                              className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                              value={JSON.stringify({
                                id: component.id,
                                name: component.name,
                              })}
                              onChange={(e) => {
                                const { id, name } = JSON.parse(e.target.value);
                                updateComponent('deduction', index, {
                                  name,
                                  id,
                                });
                              }}
                              aria-label="Deduction Component Type"
                              ref={(el) =>
                                (componentRefs.current[component.key] = el)
                              }
                              required
                            >
                              <option value="">Select Deduction</option>
                              {/* UPDATED: Filter out statutory elements using statutory_component_id */}
                              {deductionComponentTypes
                                .filter((type) => !type.statutory_component_id) // NEW: Filter by ID field instead of name
                                .map((type) => (
                                  <option
                                    key={type.id}
                                    value={JSON.stringify({
                                      id: type.id,
                                      name: type.name,
                                    })}
                                  >
                                    {type.name}
                                  </option>
                                ))}
                            </select>
                          )}
                        </>
                      )}
                    </div>

                    {/* NEW: First Set - Calculation Type */}
                    <div className="border-b pb-3 mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Calculation Type
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            className="form-radio h-4 w-4 text-indigo-600"
                            checked={component.calculation_type === 'value'}
                            onChange={() =>
                              updateComponent('deduction', index, {
                                calculation_type: 'value',
                                percentage_value: undefined,
                                reference_components: [],
                              })
                            }
                            disabled={component.isStatutory}
                          />
                          <span
                            className={`ml-2 text-sm ${
                              component.isStatutory
                                ? 'text-gray-500'
                                : 'text-gray-700'
                            }`}
                          >
                            Value (Fixed Amount)
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            className="form-radio h-4 w-4 text-indigo-600"
                            checked={
                              component.calculation_type === 'percentage'
                            }
                            onChange={() =>
                              updateComponent('deduction', index, {
                                calculation_type: 'percentage',
                                amount: undefined,
                              })
                            }
                            disabled={component.isStatutory}
                          />
                          <span
                            className={`ml-2 text-sm ${
                              component.isStatutory
                                ? 'text-gray-500'
                                : 'text-gray-700'
                            }`}
                          >
                            Percentage (% of other components)
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* NEW: Second Set - Editability */}
                    <div className="border-b pb-3 mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Editability in Payroll Entry
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            className="form-radio h-4 w-4 text-indigo-600"
                            checked={component.editability === 'fixed'}
                            onChange={() =>
                              updateComponent('deduction', index, {
                                editability: 'fixed',
                              })
                            }
                            disabled={component.isStatutory}
                          />
                          <span
                            className={`ml-2 text-sm ${
                              component.isStatutory
                                ? 'text-gray-500'
                                : 'text-gray-700'
                            }`}
                          >
                            Fixed (Not Editable)
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            className="form-radio h-4 w-4 text-indigo-600"
                            checked={component.editability === 'editable'}
                            onChange={() =>
                              updateComponent('deduction', index, {
                                editability: 'editable',
                              })
                            }
                            disabled={component.isStatutory}
                          />
                          <span
                            className={`ml-2 text-sm ${
                              component.isStatutory
                                ? 'text-gray-500'
                                : 'text-gray-700'
                            }`}
                          >
                            Editable
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            className="form-radio h-4 w-4 text-indigo-600"
                            checked={component.editability === 'enter_later'}
                            onChange={() =>
                              updateComponent('deduction', index, {
                                editability: 'enter_later',
                              })
                            }
                            disabled={component.isStatutory}
                          />
                          <span
                            className={`ml-2 text-sm ${
                              component.isStatutory
                                ? 'text-gray-500'
                                : 'text-gray-700'
                            }`}
                          >
                            Enter Later
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Amount Input or Percentage Configuration */}
                    {component.calculation_type !== 'percentage' ? (
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">₹</span>
                        </div>
                        <input
                          type="number"
                          placeholder={
                            component.editability === 'enter_later'
                              ? 'Amount (Optional - Enter in Payroll)'
                              : 'Amount'
                          }
                          className={`block w-full pl-7 border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm ${
                            component.isStatutory &&
                            component.editability !== 'editable'
                              ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                              : 'focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
                          }`}
                          value={component.amount || ''}
                          onChange={(e) =>
                            updateComponent('deduction', index, {
                              amount: parseFloat(e.target.value),
                            })
                          }
                          required={component.editability !== 'enter_later'}
                          min="0"
                          step="0.01"
                          disabled={
                            component.isStatutory &&
                            component.editability !== 'editable'
                          }
                          readOnly={
                            component.isStatutory &&
                            component.editability !== 'editable'
                          }
                        />
                        {component.editability === 'enter_later' &&
                          !component.isStatutory && (
                            <p className="mt-1 text-xs text-gray-500">
                              This field is optional. Value must be entered
                              during payroll processing.
                            </p>
                          )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <select
                            multiple
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={(component.reference_components || [])
                              .map((ref) => {
                                const matchedComponent = formData.earnings
                                  .concat(formData.deductions)
                                  .find((c) => c.name === ref);
                                return matchedComponent
                                  ? matchedComponent.name
                                  : undefined;
                              })
                              .filter(
                                (name): name is string => name !== undefined
                              )}
                            onChange={(e) => {
                              const selectedOptions = Array.from(
                                e.target.selectedOptions
                              ).map((opt) => opt.value);
                              updateComponent(component.component_type, index, {
                                reference_components: selectedOptions,
                              }); // ✅ Store only 'id'
                            }}
                            size={4}
                            aria-label="Reference Salary Components"
                          >
                            {formData.earnings
                              .concat(formData.deductions) // ✅ Ensure all previous components are selectable
                              .filter((comp) => {
                                const allComponents = [
                                  ...formData.earnings,
                                  ...formData.deductions,
                                ];
                                const currentIndex = allComponents.findIndex(
                                  (c) => c.name === component.name
                                );
                                return (
                                  allComponents.findIndex(
                                    (c) => c.name === comp.name
                                  ) < currentIndex
                                );
                              })
                              .map((comp) => (
                                <option key={comp.key} value={comp.name}>
                                  {comp.name}{' '}
                                  {comp.amount
                                    ? `($${comp.amount.toFixed(2)})`
                                    : ''}
                                </option>
                              ))}
                          </select>

                          <p className="mt-1 text-xs text-gray-500">
                            Hold Ctrl/Cmd to select multiple components
                          </p>
                        </div>

                        <div className="relative">
                          <input
                            type="number"
                            placeholder="Percentage"
                            className={`block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 pr-8 sm:text-sm ${
                              component.isStatutory &&
                              component.editability !== 'editable'
                                ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                                : 'focus:outline-none focus:ring-indigo-500 focus:border-indigo-500'
                            }`}
                            value={component.percentage_value || ''}
                            onChange={(e) =>
                              updateComponent('deduction', index, {
                                ...component,
                                percentage_value: parseFloat(e.target.value),
                              })
                            }
                            required
                            min="0"
                            max="100"
                            step="0.01"
                            disabled={
                              component.isStatutory &&
                              component.editability !== 'editable'
                            }
                            readOnly={
                              component.isStatutory &&
                              component.editability !== 'editable'
                            }
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Calculated Amount Display for Percentage */}
                    {component.calculation_method === 'percentage' && (
                      <div className="text-sm text-gray-500">
                        Calculated Amount: ₹{component.amount || '0'}
                      </div>
                    )}

                    {/* Remove Button - UPDATED: Allow removing statutory deductions */}
                    {formData.deductions.length > 1 && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeComponent('deduction', index)}
                          className="inline-flex items-center px-2 py-1 border border-transparent rounded-md text-sm font-medium text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg">
                  <span>Total Earnings:</span>
                  <span>₹{calculateTotal('earning').toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span>Total Deductions:</span>
                  <span>₹{calculateTotal('deduction').toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Net Salary:</span>
                  <span>
                    ₹
                    {(
                      calculateTotal('earning') - calculateTotal('deduction')
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white p-2 rounded-md"
              >
                {loading ? 'Creating...' : 'Create Structure'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
