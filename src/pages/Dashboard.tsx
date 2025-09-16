import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import LecturerDashboard from '@/components/dashboards/LecturerDashboard';
import StudentDashboard from '@/components/dashboards/StudentDashboard';

const Dashboard = () => {
  const { profile, isAdmin, isLecturer, isStudent } = useAuth();

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAdmin) {
    return <AdminDashboard />;
  }

  if (isLecturer) {
    return <LecturerDashboard />;
  }

  if (isStudent) {
    return <StudentDashboard />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Unknown role</p>
    </div>
  );
};

export default Dashboard;