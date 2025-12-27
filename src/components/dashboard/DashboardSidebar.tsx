import React from 'react';
import { X, Home, Users, ScanFace, IndianRupee, Settings, PieChart, FileText, Clock, FileClock , Calendar, ClipboardList, Bell, Play } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Employees', href: '/dashboard/employees', icon: Users },
  { name: 'Attendance', href: '/dashboard/attendance', icon: Clock },
  { name: 'Attendance Face', href: '/dashboard/attendance-face-verify', icon: Clock },
  { name: 'Attendance Log', href: '/dashboard/attendance-logs', icon: FileClock },
  { name: 'Visitor Log', href: '/dashboard/visitor-records', icon: ScanFace },
  { name: 'Leave', href: '/dashboard/leave', icon: Calendar },
  { name: 'Shifts', href: '/dashboard/shifts', icon: ClipboardList },
  { name: 'Holidays', href: '/dashboard/holidays', icon: Calendar },
  { name: 'Payroll', href: '/dashboard/payroll', icon: IndianRupee },
  { name: 'Salary Structures', href: '/dashboard/salary-structures', icon: FileText },
  { name: 'Payroll Process', href: '/dashboard/payroll-process', icon: Play },
  { name: 'Reports', href: '/dashboard/reports', icon: PieChart },
  { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const location = useLocation();

  return (
    <>
      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 flex z-40 lg:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      >
        <div
          className={`fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'
            }`}
          onClick={onClose}
        />

        <div
          className={`relative flex-1 flex flex-col max-w-xs w-full bg-[#6366F1] transform transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={onClose}
            >
              <span className="sr-only">Close sidebar</span>
              <X className="h-6 w-6 text-white" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            {/* <div className="flex-shrink-0 flex items-center px-4">
              <DollarSign className="h-8 w-8 text-white" />
              <span className="ml-2 text-xl font-bold text-white">Ace Payroll</span>
            </div> */}
            <nav className="mt-5 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${isActive
                      ? 'bg-white text-indigo-600'
                      : 'text-indigo-100 hover:bg-indigo-600 hover:text-white'

                      }`}
                  >
                    <item.icon
                      className={`mr-4 h-6 w-6 ${isActive ? 'text-indigo-600' : 'text-indigo-200 group-hover:text-white'
                        }`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-[#6366F1] border-r border-indigo-400">
          <div className="flex-1 flex flex-col pt-14 pb-4 overflow-y-auto">

            {/* <div className="flex items-center flex-shrink-0 px-4">
              <DollarSign className="h-8 w-8 text-white" />
              <span className="ml-2 text-xl font-bold text-white">Ace Payroll</span>
            </div> */}

            <nav className="mt-5 flex-1 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive
                      ? 'bg-white text-indigo-600'
                      : 'text-indigo-100 hover:bg-indigo-600 hover:text-white'

                      }`}
                  >
                    <item.icon
                      className={`mr-3 h-6 w-6 ${isActive ? 'text-indigo-600' : 'text-indigo-200 group-hover:text-white'
                        }`}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}