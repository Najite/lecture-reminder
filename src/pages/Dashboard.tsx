import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import LecturerDashboard from '@/components/dashboards/LecturerDashboard';
import StudentDashboard from '@/components/dashboards/StudentDashboard';

const Dashboard = () => {
  const { profile, loading, initialized, isAdmin, isLecturer, isStudent } = useAuth();

  // Show loading while auth is initializing or profile is loading
  if (!initialized || loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Render appropriate dashboard based on role
  if (isAdmin) {
    return <AdminDashboard />;
  }

  if (isLecturer) {
    return <LecturerDashboard />;
  }

  if (isStudent) {
    return <StudentDashboard />;
  }

  // Fallback for unknown or missing role
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Role Not Recognized</h1>
        <p className="text-gray-600">Your account role is not recognized. Please contact support.</p>
      </div>
    </div>
  );
};

export default Dashboard;