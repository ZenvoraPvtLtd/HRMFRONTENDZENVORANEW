import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  isCandidateRole,
  isHrRole,
  clearAuthStorage,
  isTokenValid,
} from '../utils/auth';

type ProtectedRouteProps = {
  allowedRoles?: 'admin' | 'hr' | 'candidate' | 'employee' | 'manager';
};

function getDashboardPath(role: string): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'hr':
      return '/dashboard';
    case 'manager':
      return '/manager/dashboard';
    case 'employee':
      return '/dashboard';
    case 'candidate':
      return '/candidatedashboard';
    default:
      return '/';
  }
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const location = useLocation();

  if (allowedRoles === 'admin') {
    const raw = localStorage.getItem('admin_accessToken') || localStorage.getItem('hr_accessToken') || localStorage.getItem('accessToken');
    const token = isTokenValid(raw) ? raw : null;
    const role = localStorage.getItem('admin_userRole') || localStorage.getItem('hr_userRole') || localStorage.getItem('userRole');

    if (!token) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    // Allow both admin and hr roles to access admin section
    if (role !== 'admin' && role !== 'hr') {
      return <Navigate to="/" replace />;
    }

    return <Outlet />;
  }

  if (allowedRoles === 'hr') {
    const raw = localStorage.getItem('hr_accessToken') || localStorage.getItem('accessToken');
    const token = isTokenValid(raw) ? raw : null;
    const role = localStorage.getItem('hr_userRole') || localStorage.getItem('userRole');

    if (!token) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    // Manager should be redirected to their own dashboard
    if (role === 'manager') {
      return <Navigate to="/manager/dashboard" replace />;
    }

    if (!role || !isHrRole(role)) {
      clearAuthStorage();
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return <Outlet />;
  }

  if (allowedRoles === 'candidate') {
    const raw = localStorage.getItem('candidate_accessToken');
    const token = isTokenValid(raw) ? raw : null;
    const role = localStorage.getItem('candidate_userRole');

    if (!token) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    if (!role || !isCandidateRole(role)) {
      clearAuthStorage();
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return <Outlet />;
  }

  if (allowedRoles === 'manager') {
    const raw = localStorage.getItem('hr_accessToken') || localStorage.getItem('accessToken');
    const token = isTokenValid(raw) ? raw : null;
    const role = localStorage.getItem('hr_userRole') || localStorage.getItem('userRole');

    if (!token || role !== 'manager') {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return <Outlet />;
  }

  if (allowedRoles === 'employee') {
    const raw = localStorage.getItem('accessToken');
    const token = isTokenValid(raw) ? raw : null;
    const role = localStorage.getItem('userRole');

    if (!token) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    if (role !== 'employee') {
      clearAuthStorage();
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return <Outlet />;
  }

  if (allowedRoles === 'manager') {
    const token = localStorage.getItem('manager_accessToken');
    const role = localStorage.getItem('manager_userRole');

    if (!token) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    if (role !== 'manager') {
      clearAuthStorage();
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return <Outlet />;
  }

  // Fallback
  const generalToken = isTokenValid(localStorage.getItem('accessToken')) ? localStorage.getItem('accessToken') : null;
  if (!generalToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Retrieve stored role (hr, manager, employee, candidate, admin) and navigate to its dashboard
  const storedRole = localStorage.getItem('userRole') || localStorage.getItem('hr_userRole') || localStorage.getItem('candidate_userRole');
  const dashboardPath = storedRole ? getDashboardPath(storedRole) : '/';
  return <Navigate to={dashboardPath} replace />;
};

export default ProtectedRoute;
