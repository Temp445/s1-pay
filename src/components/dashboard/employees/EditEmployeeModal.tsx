import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Employee } from "../../../stores/employeesStore";
import { useDepartmentsStore } from "../../../stores/departmentsStore";
import { useRolesStore } from "../../../stores/rolesStore";

interface EditEmployeeModalProps {
  employee: Employee | null;
  onClose: () => void;
  onSave: (employeeId: string, updates: Partial<Employee>) => Promise<void>;
}

export default function EditEmployeeModal({
  employee,
  onClose,
  onSave,
}: EditEmployeeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { items: departments, fetchDepartments } = useDepartmentsStore();
  const { items: roles, fetchRoles } = useRolesStore();

  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    employee_code: string;
    department: string;
    role: string;
    start_date: string;
    status: "Active" | "Terminated" | "Suspended" | "Relieved" | "Rejoin";
    address: string;
    date_of_birth: string;
  }>({
    name: "",
    email: "",
    employee_code: "",
    department: "",
    role: "",
    start_date: "",
    status: "Active",
    address: "",
    date_of_birth: "",
  });

  const isRejoinSelected = formData.status === "Rejoin";

  useEffect(() => {
    if (formData.status === "Rejoin") {
      setFormData((prev) => ({
        ...prev,
        start_date: "",
      }));
    }
  }, [formData.status]);

  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name,
        email: employee.email,
        employee_code: employee.employee_code || "",
        department: employee.department,
        role: employee.role,
        start_date: employee.start_date,
        status: employee.status === "Rejoin" ? "Active" : employee.status,
        address: employee.address || "",
        date_of_birth: employee.date_of_birth || "",
      });
    }
  }, [employee]);

  useEffect(() => {
    if (employee) {
      fetchDepartments();
      fetchRoles();
    }
  }, [employee, fetchDepartments, fetchRoles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    try {
      setLoading(true);
      setError(null);
      await onSave(employee.id, formData);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update employee"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

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
                Edit Employee
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
                    name="name"
                    id="name"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                    name="email"
                    id="email"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
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
                    max={new Date().toISOString().split("T")[0]} // Prevent future dates
                  />
                </div>

                <div>
                  <label
                    htmlFor="department"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Department
                  </label>
                  <select
                    id="department"
                    name="department"
                    required
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="role"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    required
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                  >
                    <option value="">Select Role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.name}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="start_date"
                    className="block text-sm font-medium text-gray-700"
                  >
                    {isRejoinSelected ? "Rejoin Date" : "Join Date"}
                  </label>

                  <input
                    type="date"
                    name="start_date"
                    id="start_date"
                    required
                    min={
                      isRejoinSelected
                        ? new Date().toISOString().split("T")[0]
                        : undefined
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="status"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Status
                  </label>

                  <select
                    id="status"
                    name="status"
                    required
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    value={formData.status}
                    onChange={(e) => {
                      const value = e.target.value as
                        | "Active"
                        | "Suspended"
                        | "Relieved"
                        | "Terminated"
                        | "Rejoin";

                      setFormData((prev) => ({
                        ...prev,
                        status: value,
                        start_date: value === "Rejoin" ? "" : prev.start_date,
                      }));
                    }}
                  >
                    {employee &&
                    ["Relieved", "Terminated"].includes(employee.status) ? (
                      <>
                        {/* Show only the current exiting status */}
                        <option value={employee.status}>
                          {employee.status}
                        </option>
                        {/* And allow Rejoin */}
                        <option value="Rejoin">Rejoin</option>
                      </>
                    ) : (
                      <>
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Relieved">Relieved</option>
                        <option value="Terminated">Terminated</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save Changes"}
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
