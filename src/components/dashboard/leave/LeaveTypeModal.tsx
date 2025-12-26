import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useLeaveStore, type LeaveType } from '../../../stores/leaveStore';

interface LeaveTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<LeaveType, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  leaveType?: LeaveType | null;
}

export default function LeaveTypeModal({ isOpen, onClose, onSave, leaveType }: LeaveTypeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createLeaveType, updateLeaveType } = useLeaveStore();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_days: 0,
    requires_approval: true,
    is_active: true,
    is_paid: true,
  });

  useEffect(() => {
    if (leaveType) {
      setFormData({
        name: leaveType.name,
        description: leaveType.description || '',
        default_days: leaveType.default_days,
        requires_approval: leaveType.requires_approval,
        is_active: leaveType.is_active ?? true,
        is_paid: leaveType.is_paid ?? true,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        default_days: 0,
        requires_approval: true,
        is_active: true,
        is_paid: true,
      });
    }
  }, [leaveType]);

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Leave type name is required');
      return false;
    }

    if (formData.default_days < 0) {
      setError('Default days must be a positive number');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      if (leaveType) {
        await updateLeaveType(leaveType.id, formData);
      } else {
        await createLeaveType(formData);
      }

      // Refresh leave types list
      await onSave(formData);
      onClose();
    } catch (err) {
      let errorMessage = 'Failed to save leave type';
      if (err instanceof Error) {
        if (err.message.includes('duplicate key')) {
          errorMessage = 'A leave type with this name already exists';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
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

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              onClick={onClose}
              className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <span className="sr-only">Close</span>
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {leaveType ? 'Edit Leave Type' : 'Add Leave Type'}
              </h3>

              {error && (
                <div className="mt-2 rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">{error}</h3>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="default_days" className="block text-sm font-medium text-gray-700">
                    Default Annual Days
                  </label>
                  <input
                    type="number"
                    id="default_days"
                    required
                    min="0"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.default_days}
                    onChange={(e) => setFormData({ ...formData, default_days: parseInt(e.target.value) })}
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="requires_approval"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    checked={formData.requires_approval}
                    onChange={(e) => setFormData({ ...formData, requires_approval: e.target.checked })}
                  />
                  <label htmlFor="requires_approval" className="ml-2 block text-sm text-gray-900">
                    Requires Approval
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_paid"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    checked={formData.is_paid}
                    onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                  />
                  <label htmlFor="is_paid" className="ml-2 block text-sm text-gray-900">
                    Paid Leave
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Active
                  </label>
                </div>

                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save'}
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