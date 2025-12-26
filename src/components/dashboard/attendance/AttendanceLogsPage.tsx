import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { ChevronDown, Search } from 'lucide-react';
import AttendanceTimestamp from './AttendanceTimestamp';

type AttendanceLog = {
  id: string;
  employee: {
    id: string;
    name: string;
    employee_code: string;
  };
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: 'Present' | 'Absent' | 'Late' | 'Half Day';
};

export default function AttendanceLogsPage() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select(`*, employee:employee_id (id, name, employee_code)`);

      if (error) console.error(error);
      else setLogs(data || []);

      setLoading(false);
    };

    fetchLogs();
  }, []);

  const openModal = (employeeId: string, date: string) => {
    setSelectedEmployeeId(employeeId);
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEmployeeId(null);
    setSelectedDate(null);
  };

  const filteredLogs = useMemo(() => {
    let filtered = logs.filter(
      (log) =>
        log.employee?.name.toLowerCase().includes(search.toLowerCase()) ||
        log.employee?.employee_code.toLowerCase().includes(search.toLowerCase())
    );

    filtered.sort((a, b) => {
      if (sortField === 'date') {
        return sortOrder === 'asc'
          ? new Date(a.date).getTime() - new Date(b.date).getTime()
          : new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        return sortOrder === 'asc'
          ? (a.employee?.name || '').localeCompare(b.employee?.name || '')
          : (b.employee?.name || '').localeCompare(a.employee?.name || '');
      }
    });

    return filtered;
  }, [logs, search, sortField, sortOrder]);

  const getStatusBadge = (status: AttendanceLog['status']) => {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-800';
      case 'Late': return 'bg-yellow-100 text-yellow-800';
      case 'Absent': return 'bg-red-100 text-red-800';
      case 'Half Day': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <p className="text-center mt-4">Loading attendance logs...</p>;
  if (logs.length === 0) return <p className="text-center mt-4">No attendance logs found</p>;

  return (
    <div className="p-6 w-full bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Attendance Logs</h1>
          <p className="text-gray-600">Track and manage employee attendance records</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Employee</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or employee code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Sort */}
            <div className="flex gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <div className="relative">
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as 'name' | 'date')}
                    className="appearance-none w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-transparent transition bg-white pr-10"
                  >
                    <option value="date">Date</option>
                    <option value="name">Name</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                <div className="relative">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className="appearance-none w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white pr-10"
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Employee Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Code</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Clock In</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Clock Out</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => log.employee?.id && openModal(log.employee.id, log.date)}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{log.employee?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{log.employee?.employee_code || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(log.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.clock_in ? new Date(log.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.clock_out ? new Date(log.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 text-sm text-gray-600">
            Showing <span className="font-semibold">{filteredLogs.length}</span> of <span className="font-semibold">{logs.length}</span> records
          </div>
        </div>
      </div>

      {/* Modal */}
      <AttendanceTimestamp
        isOpen={isModalOpen}
        employeeId={selectedEmployeeId}
        date={selectedDate}
        onClose={closeModal}
      />
    </div>
  );
}
