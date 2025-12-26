import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import StatisticsOverview from './StatisticsOverview';
import ActivityFeed from './ActivityFeed';
import DataTable from './DataTable';
import UserProfile from './UserProfile';
import { useLocation } from 'react-router-dom';

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const hideSidebarPaths = ['/dashboard/attendance-face-verify'];
  const showSidebar = !hideSidebarPaths.includes(location.pathname);

  const isOverviewPage = location.pathname === '/dashboard' || location.pathname === '/dashboard/overview';

  return (
    <div className="min-h-screen bg-gray-100">
        {showSidebar && (
      <DashboardHeader 
        onMenuClick={() => setSidebarOpen(true)} 
      />
        )}
        {showSidebar && (
      <DashboardSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
        )}

      <div className={showSidebar ? 'lg:pl-64 pt-14' : 'pt-14'}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isOverviewPage ? (
            // Show dashboard overview
            <div className="grid grid-cols-1 gap-8">
              <StatisticsOverview />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <ActivityFeed />
                </div>

                <div className="lg:col-span-2">
                  <DataTable />
                </div>
              </div>

              <UserProfile user={user} />
            </div>
          ) : (
            // Show nested routes (like Employees page)
            <Outlet />
          )}
        </div>
      </div>
    </div>
  );
}