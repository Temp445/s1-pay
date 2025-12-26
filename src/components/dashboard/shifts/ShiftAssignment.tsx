import React, { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { format } from 'date-fns';
import { AlertCircle, Search } from 'lucide-react';
import { useShiftsStore, type ShiftAssignment as ShiftAssignmentType } from '../../../stores/shiftsStore';
import { type Employee } from '../../../stores/employeesStore';
import SortableEmployee from './SortableEmployee';

interface ShiftAssignmentProps {
  shift: ShiftAssignmentType;
  onAssignmentUpdate: () => void;
}

export default function ShiftAssignment({ shift, onAssignmentUpdate }: ShiftAssignmentProps) {
  const { assignments: assignmentsState, fetchShiftAssignments, updateShiftAssignment } = useShiftsStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedEmployees, setAssignedEmployees] = useState<ShiftAssignmentType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    const loadAssignedEmployees = async () => {
      try {
        setLoading(true);
        await fetchShiftAssignments(
          shift.schedule_date,
          shift.schedule_date
        );
        const assignments = assignmentsState.items;

        // Filter assignments for current shift and ensure employee data exists
        const validAssignments = assignments.filter((a: { shift_id: string; }) => a.shift_id === shift.shift_id);
        setAssignedEmployees(validAssignments);

        // Extract unique departments from valid assignments
        const uniqueDepartments: string[] = Array.from(new Set<string>(
          validAssignments
            .map((a: { employee?: Employee }) => a.employee?.department)
            .filter((dept: string | undefined): dept is string => Boolean(dept))
        )).sort();
        setDepartments(uniqueDepartments);

        setError(null);
      } catch (err) {
        console.error('Error loading assignments:', err);
        setError(err instanceof Error ? err.message : 'Failed to load assigned employees');
      } finally {
        setLoading(false);
      }
    };

    loadAssignedEmployees();
  }, [shift.schedule_date, shift.shift_id]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    try {
      setLoading(true);
      setError(null);

      await updateShiftAssignment(shift.id, {
        employee_id: active.id as string,
        status: 'scheduled'
      });

      onAssignmentUpdate();
    } catch (err) {
      console.error('Error updating assignment:', err);
      setError(err instanceof Error ? err.message : 'Failed to update assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (employeeId: string, newStatus: 'scheduled' | 'in_progress' | 'completed' | 'cancelled') => {
    try {
      setLoading(true);
      setError(null);

      const assignment = assignedEmployees.find(a => a.employee_id === employeeId);
      if (assignment) {
        await updateShiftAssignment(assignment.id, { status: newStatus });
        onAssignmentUpdate();
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = assignedEmployees.filter(assignment => {
    const employee = assignment.employee;
    if (!employee) return false;

    const matchesSearch = 
      (employee.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (employee.department?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesDepartment = !selectedDepartment || employee.department === selectedDepartment;
    
    return matchesSearch && matchesDepartment;
  });

  if (loading && assignedEmployees.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Assigned Employees for {shift.shift?.name}
        </h3>
        <p className="text-sm text-gray-500">
          {format(new Date(shift.schedule_date), 'MMMM d, yyyy')}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {shift.shift?.start_time} - {shift.shift?.end_time}
        </p>
      </div>

      <div className="space-y-4">
        {/* Search and Filter Controls */}
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {departments.length > 0 && (
            <select
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          )}
        </div>

        {/* Assigned Employees List */}
        <div>
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredAssignments.map(a => a.employee_id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {filteredAssignments.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    {assignedEmployees.length === 0 
                      ? 'No employees assigned to this shift'
                      : 'No employees match the current filters'}
                  </p>
                ) : (
                  filteredAssignments.map((assignment) => (
                    assignment.employee && (
                      <div key={assignment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <SortableEmployee
                          employee={assignment.employee as Employee}
                          disabled={loading}
                        />
                        <div className="flex items-center space-x-2">
                          <select
                            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            value={assignment.status}
                            onChange={(e) => handleStatusUpdate(
                              assignment.employee_id,
                              e.target.value as 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
                            )}
                            disabled={loading}
                          >
                            <option value="scheduled">Scheduled</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                    )
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Summary Stats */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
            <div>
              <span className="font-medium">Total Assigned:</span>{' '}
              {assignedEmployees.length}
            </div>
            <div>
              <span className="font-medium">Completed:</span>{' '}
              {assignedEmployees.filter(a => a.status === 'completed').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}