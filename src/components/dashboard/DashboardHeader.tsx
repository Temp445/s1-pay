import React from 'react';
import { Menu, Search, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import NotificationDropdown from '../NotificationDropdown';
import TenantSwitcher from '../TenantSwitcher';

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

export default function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
  <header className="bg-[#6366F1] shadow-lg fixed inset-x-0 top-0 z-20">
    <div className="h-14">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex justify-between">

          {/* LEFT */}
          <div className="flex items-center flex-1">

            {/* Menu + Product Name */}
            <div className="flex items-center">
              <button
                type="button"
                className="px-4 text-white hover:bg-indigo-600
                 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white
                 lg:hidden"
                onClick={onMenuClick}
              >
                <span className="sr-only">Open sidebar</span>
                <Menu className="h-6 w-6" />
              </button>

              <span className="ml-3 text-white font-semibold text-lg tracking-wide whitespace-nowrap">
                ACE PAYROLL SYSTEM
              </span>
            </div>

            {/* SEARCH */}
            <div className="flex-1 flex items-center px-4 lg:px-6">
              <div className="w-full max-w-lg">
                <label htmlFor="search-field" className="sr-only">
                  Search
                </label>
                <div className="relative text-indigo-200 focus-within:text-white">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    id="search-field"
                    type="search"
                    placeholder="Search"
                    className="block w-full pl-10 pr-3 py-2
                     bg-indigo-500/30 text-white
                     placeholder-indigo-200
                     rounded-md
                     focus:outline-none focus:ring-2 focus:ring-white
                     sm:text-sm"
                  />
                </div>
              </div>
            </div>

          </div>


          {/* RIGHT */}
          <div className="flex items-center space-x-4">
            <TenantSwitcher />
            <NotificationDropdown />

            <button
              onClick={handleSignOut}
              className="p-2 rounded-full
                         text-indigo-100
                         hover:text-white hover:bg-indigo-600
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
            >
              <span className="sr-only">Sign out</span>
              <LogOut className="h-6 w-6" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}