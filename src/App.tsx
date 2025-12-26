import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Testimonials from './components/Testimonials';
import Pricing from './components/Pricing';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import ResetPasswordForm from './components/auth/ResetPasswordForm';
import Dashboard from './components/dashboard/Dashboard';
import EmployeesPage from './components/dashboard/employees/EmployeesPage';
import PayrollPage from './components/dashboard/payroll/PayrollPage';
import SalaryStructuresPage from './components/dashboard/payroll/SalaryStructuresPage';
import PayrollProcessPage from './components/dashboard/payroll/PayrollProcessPage';
import AttendancePage from './components/dashboard/attendance/AttendancePage';
import FaceEnrollmentPage from './components/dashboard/attendance/FaceEnrollmentPage';
import LeavePage from './components/dashboard/leave/LeavePage';
import ShiftsPage from './components/dashboard/shifts/ShiftsPage';
import HolidaysPage from './components/dashboard/holidays/HolidaysPage';
import ReportsPage from './components/dashboard/reports/ReportsPage';
import SettingsPage from './components/dashboard/settings/SettingsPage';
import NotificationsPage from './components/dashboard/notifications/NotificationsPage'; 
import FaceAttendancePage from './components/dashboard/attendance/FaceAttendancePage';
import VisitorCapturesPage from './components/dashboard/attendance/VisitorCapturesPage';
import AttendanceLogsPage from './components/dashboard/attendance/AttendanceLogsPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <TenantProvider>
          <NotificationProvider>
            <Routes>
            {/* Public routes */}
            <Route
              path="/"
              element={
                <div className="min-h-screen bg-white">
                  <Navbar />
                  <div className="pt-16">
                    <Hero />
                    <Features />
                    <Testimonials />
                    <Pricing />
                  </div>
                </div>
              }
            />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/reset-password" element={<ResetPasswordForm />} />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={null} /> {/* Overview is handled by Dashboard component */}
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="attendance/face-enrollment" element={<FaceEnrollmentPage />} />
              <Route path="attendance-face-verify" element={<FaceAttendancePage />} />
              <Route path="attendance-logs" element={<AttendanceLogsPage />} />
              <Route path="visitor-records" element={<VisitorCapturesPage />} />
              <Route path="leave" element={<LeavePage />} />
              <Route path="shifts" element={<ShiftsPage />} />
              <Route path="holidays" element={<HolidaysPage />} />
              <Route path="payroll" element={<PayrollPage />} />
              <Route path="salary-structures" element={<SalaryStructuresPage />} />
              <Route path="payroll-process" element={<PayrollProcessPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </NotificationProvider>
        </TenantProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;