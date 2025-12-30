import React, { useState, useEffect } from 'react';
import { Plus, Filter, Upload } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import ShiftCalendar from './ShiftCalendar';
import ShiftFilter from './ShiftFilter';
import ShiftAssignment from './ShiftAssignment';
import EmployeeAvailability from './EmployeeAvailability';
import CreateShiftModal from './CreateShiftModal';
import AssignShiftModal from './AssignShiftModal';
import ShiftList from './ShiftList';
import ImportModal from '../../ImportModal';
import { ShiftAssignment as ShiftAssignmentType, Shift, useShiftsStore } from '../../../stores/shiftsStore';
import { importShifts } from '../../../lib/import';
import { useEmployeesStore } from '../../../stores/employeesStore';

export default function ShiftsPage() {
  const { fetchShifts, fetchShiftAssignments } = useShiftsStore();
  const { items: employees, fetchEmployees } = useEmployeesStore();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftAssignmentType | null>(null);
  const [selectedShiftForAssignment, setSelectedShiftForAssignment] = useState<Shift | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [filters, setFilters] = useState({
    startDate: format(startOfWeek(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfWeek(new Date()), 'yyyy-MM-dd'),
    department: '',
    status: '',
  });

  const [focusedDate, setFocusedDate] = useState<Date | null>(null);


  useEffect(() => {
    fetchEmployees();
    fetchShifts();
  }, [fetchEmployees, fetchShifts]);

  const availableEmployees = employees.filter(emp => emp.status === 'Active');

  const handleShiftClick = (shift: ShiftAssignmentType) => {
    setSelectedShift(shift);
    setFocusedDate(new Date(shift.schedule_date));

  };

  const handleAssignmentUpdate = () => {
    setSelectedShift(null);
    setLastRefresh(Date.now());
  };

  const handleShiftCreated = () => {
    setLastRefresh(Date.now());
  };

  const handleImport = async (data: any[]) => {
    return await importShifts(data);
  };

  const handleImportComplete = () => {
    setLastRefresh(Date.now());
  };

  const handleAssignClick = (shift: Shift) => {
    setSelectedShiftForAssignment(shift);
    setIsAssignModalOpen(true);
  };

  const handleAssignmentComplete = () => {
    setIsAssignModalOpen(false);
    setSelectedShiftForAssignment(null);
    setLastRefresh(Date.now());
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Shift Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and assign shifts, view schedules, and handle shift swaps.
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Shift
            </button>
          </div>
        </div>

        {isFiltersOpen && (
          <div className="mt-4">
            <ShiftFilter
              filters={filters}
              onFilterChange={setFilters}
            />
          </div>
        )}

        <div className="mt-4">
          <ShiftList
            onRefresh={handleShiftCreated}
            lastRefresh={lastRefresh}
            onAssignClick={handleAssignClick}
          />
        </div>

        <div
  className={`mt-8 grid gap-4 transition-all duration-300 ${
    selectedShift || focusedDate ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'
  }`}
>
  <div className={selectedShift || focusedDate ? 'lg:col-span-2' : 'lg:col-span-3'}>
    <ShiftCalendar
      onShiftClick={handleShiftClick}
      selectedDate={new Date(filters.startDate)}
      focusedDate={focusedDate}
      onClearFocus={() => {
        setFocusedDate(null);
        setSelectedShift(null);
      }}
    />
  </div>

  {(selectedShift || focusedDate) && (
    <div className="transition-all duration-300 space-y-4">
      {selectedShift ? (
        <ShiftAssignment
          shift={selectedShift}
          availableEmployees={availableEmployees}
          onAssignmentUpdate={handleAssignmentUpdate}
        />
      ) : (
        // Show all shifts for the focused date
        shiftsForFocusedDate.map(shift => (
          <ShiftAssignment
            key={shift.shift_id}
            shift={shift}
            availableEmployees={availableEmployees}
            onAssignmentUpdate={handleAssignmentUpdate}
          />
        ))
      )}
    </div>
  )}
</div>

      </div>

      <CreateShiftModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onShiftCreated={handleShiftCreated}
      />

      {selectedShiftForAssignment && (
        <AssignShiftModal
          shift={selectedShiftForAssignment}
          isOpen={isAssignModalOpen}
          onClose={() => {
            setIsAssignModalOpen(false);
            setSelectedShiftForAssignment(null);
          }}
          onAssignmentComplete={handleAssignmentComplete}
        />
      )}

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          handleImportComplete();
        }}
        entityType="shifts"
        entityName="Shifts"
        onImport={handleImport}
      />
    </div>
  );
}