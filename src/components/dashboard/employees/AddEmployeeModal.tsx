import React, { useState, useEffect } from 'react';
import { X, Plus, Pencil } from 'lucide-react';
import { useEmployeesStore } from '../../../stores/employeesStore';
import { useDepartmentsStore, type Department } from '../../../stores/departmentsStore';
import { useRolesStore, type Role } from '../../../stores/rolesStore';
import { useAuth } from '../../../contexts/AuthContext';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmployeeAdded: () => void;
}

export default function AddEmployeeModal({
  isOpen,
  onClose,
  onEmployeeAdded,
}: AddEmployeeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNewDepartment, setIsNewDepartment] = useState(false);
  const [isNewRole, setIsNewRole] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editedDepartmentName, setEditedDepartmentName] = useState('');

  const [newRoleName, setNewRoleName] = useState('');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editedRoleName, setEditedRoleName] = useState('');
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const { user } = useAuth();

  const { createEmployee } = useEmployeesStore();
  const { items: departments, fetchDepartments, createDepartment, updateDepartment } = useDepartmentsStore();
  const { items: roles, fetchRoles, createRole, updateRole } = useRolesStore();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    employee_code: '',
    department: '',
    role: '',
    start_date: '',
    status: 'Active' as const,
    address: '',
    date_of_birth: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
      fetchRoles();
    }
  }, [isOpen, fetchDepartments, fetchRoles]);

  const handleCreateDepartment = async () => {
    try {
      setLoading(true);
      const newDept = await createDepartment(newDepartmentName);
      setFormData({ ...formData, department: newDept.name });
      setIsNewDepartment(false);
      setNewDepartmentName('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create department'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDepartment = async () => {
  if (!editingDepartment) return;

  try {
    setLoading(true);
    const updated = await updateDepartment(
      editingDepartment.id,
      editedDepartmentName
    );

    setFormData({ ...formData, department: updated.name });
    setEditingDepartment(null);
    setEditedDepartmentName('');
  } catch (err) {
    setError(
      err instanceof Error ? err.message : 'Failed to update department'
    );
  } finally {
    setLoading(false);
  }
};


  const handleCreateRole = async () => {
    try {
      setLoading(true);
      const newRole = await createRole(newRoleName);
      setFormData({ ...formData, role: newRole.name });
      setIsNewRole(false);
      setNewRoleName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const employeeData = {
        ...formData,
        // Only include employee_code if it's not empty
        ...(formData.employee_code
          ? { employee_code: formData.employee_code }
          : {}),
        // Only include address and date_of_birth if they're not empty
        ...(formData.address ? { address: formData.address } : {}),
        ...(formData.date_of_birth
          ? { date_of_birth: formData.date_of_birth }
          : {}),
      };

      await createEmployee(employeeData);
      onEmployeeAdded();
      onClose();

      // Reset form
      setFormData({
        name: '',
        email: '',
        employee_code: '',
        department: '',
        role: '',
        start_date: '',
        status: 'Active',
        address: '',
        date_of_birth: '',
      });
      setIsNewDepartment(false);
      setIsNewRole(false);
      setNewDepartmentName('');
      setNewRoleName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add employee');
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
              type="button"
              className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Add New Employee
              </h3>
              {error && (
                <div className="mt-2 rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}
              <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                      isValidatingEmail
                        ? 'border-yellow-300'
                        : 'border-gray-300'
                    }`}
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      setError(null);
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="employee_code"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Employee Code
                  </label>
                  <input
                    type="text"
                    id="employee_code"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={formData.employee_code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        employee_code: e.target.value,
                      })
                    }
                    placeholder="Enter employee code"
                  />
                </div>

                <div>
                  <label
                    htmlFor="address"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Address (Optional)
                  </label>
                  <textarea
                    id="address"
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Enter full address"
                  />
                </div>

                <div>
                  <label
                    htmlFor="date_of_birth"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    id="date_of_birth"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={formData.date_of_birth}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        date_of_birth: e.target.value,
                      })
                    }
                    max={new Date().toISOString().split('T')[0]} // Prevent future dates
                  />
                </div>

<div>
  <label className="block text-sm font-medium text-gray-700">
    Department
  </label>

  {/* EDIT MODE */}
  {editingDepartment ? (
    <div className="mt-1 flex gap-2">
      <input
        type="text"
        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        value={editedDepartmentName}
        onChange={(e) => setEditedDepartmentName(e.target.value)}
      />

      <button
        type="button"
        onClick={handleUpdateDepartment}
        disabled={!editedDepartmentName.trim() || loading}
        className="inline-flex items-center px-3 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
      >
        Save
      </button>

      <button
        type="button"
        onClick={() => {
          setEditingDepartment(null);
          setEditedDepartmentName('');
        }}
        className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  ) : !isNewDepartment ? (
    <div className="mt-1 flex gap-2">
      {/* DROPDOWN */}
      <select
        required
        className="block w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        value={formData.department}
        onChange={(e) => {
          if (e.target.value === 'new') {
            setIsNewDepartment(true);
          } else {
            setFormData({
              ...formData,
              department: e.target.value,
            });
          }
        }}
      >
        <option value="">Select Department</option>
        {departments.map((dept) => (
          <option key={dept.id} value={dept.name}>
            {dept.name}
          </option>
        ))}
        <option value="new">+ Create New Department</option>
      </select>

      {/* EDIT BUTTON AT END */}
      {formData.department && (
        <button
          type="button"
          onClick={() => {
            const dept = departments.find(
              (d) => d.name === formData.department
            );
            if (!dept) return;
            setEditingDepartment(dept);
            setEditedDepartmentName(dept.name);
          }}
          className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 text-gray-600 hover:text-indigo-600 hover:border-indigo-600"
          title="Edit Department"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  ) : (
    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Enter new department name"
                        value={newDepartmentName}
                        onChange={(e) => setNewDepartmentName(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleCreateDepartment}
                        disabled={!newDepartmentName.trim() || loading}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewDepartment(false);
                          setNewDepartmentName('');
                        }}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Cancel
                      </button>
                    </div>
  )}
</div>



                <div>
  <label
    htmlFor="role"
    className="block text-sm font-medium text-gray-700"
  >
    Role
  </label>

  {/* EDIT MODE */}
  {editingRole ? (
    <div className="mt-1 flex gap-2">
      <input
        type="text"
        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        value={editedRoleName}
        onChange={(e) => setEditedRoleName(e.target.value)}
      />

      <button
        type="button"
        onClick={async () => {
          await updateRole(editingRole.id, editedRoleName);
          setFormData({ ...formData, role: editedRoleName });
          setEditingRole(null);
          setEditedRoleName('');
        }}
        disabled={!editedRoleName.trim() || loading}
        className="inline-flex items-center px-3 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
      >
        Save
      </button>

      <button
        type="button"
        onClick={() => {
          setEditingRole(null);
          setEditedRoleName('');
        }}
        className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  ) : !isNewRole ? (
    <div className="mt-1 flex gap-2">
      {/* DROPDOWN */}
      <select
        id="role"
        name="role"
        required
        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        value={formData.role}
        onChange={(e) => {
          if (e.target.value === 'new') {
            setIsNewRole(true);
          } else {
            setFormData({ ...formData, role: e.target.value });
          }
        }}
      >
        <option value="">Select Role</option>
        {roles.map((role) => (
          <option key={role.id} value={role.name}>
            {role.name}
          </option>
        ))}
        <option value="new">+ Create New Role</option>
      </select>

      {/* EDIT ICON */}
      {formData.role && (
        <button
          type="button"
          onClick={() => {
            const role = roles.find(
              (r) => r.name === formData.role
            );
            if (!role) return;
            setEditingRole(role);
            setEditedRoleName(role.name);
          }}
          className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 text-gray-600 hover:text-indigo-600 hover:border-indigo-600"
          title="Edit Role"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
    </div>
  ) : (
    /* EXISTING CREATE ROLE UI – UNCHANGED */
    <div className="mt-1 flex gap-2">
      <input
        type="text"
        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        placeholder="Enter new role name"
        value={newRoleName}
        onChange={(e) => setNewRoleName(e.target.value)}
      />
      <button
        type="button"
        onClick={handleCreateRole}
        disabled={!newRoleName.trim() || loading}
        className="inline-flex items-center px-3 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
      >
        <Plus className="h-4 w-4 mr-1" />
        Add
      </button>
      <button
        type="button"
        onClick={() => {
          setIsNewRole(false);
          setNewRoleName('');
        }}
        className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  )}
</div>


                <div>
                  <label
                    htmlFor="start_date"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Join Date
                  </label>
                  <input
                    type="date"
                    id="start_date"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                  />
                </div>

                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Employee'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
