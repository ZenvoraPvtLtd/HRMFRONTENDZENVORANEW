import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  getDashboardPath,
  isTokenValid,
} from '../utils/auth';

type ProtectedRouteProps = {
  allowedRoles?: 'admin' | 'hr' | 'candidate' | 'employee' | 'manager';
};

const getActiveAuth = () => {
  const token =
    localStorage.getItem('accessToken') ||
    localStorage.getItem('hr_accessToken') ||
    localStorage.getItem('admin_accessToken') ||
    localStorage.getItem('manager_accessToken') ||
    localStorage.getItem('candidate_accessToken');

  const role =
    localStorage.getItem('userRole') ||
    localStorage.getItem('hr_userRole') ||
    localStorage.getItem('admin_userRole') ||
    localStorage.getItem('manager_userRole') ||
    localStorage.getItem('candidate_userRole');

  return { token: isTokenValid(token) ? token : null, role };
};

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const location = useLocation();
  const { token, role } = getActiveAuth();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles === 'admin') {
    if (role !== 'admin' && role !== 'hr') {
      return <Navigate to={getDashboardPath(role)} replace />;
    }
  } else if (allowedRoles === 'hr') {
    if (role === 'manager') {
      return <Navigate to="/manager/dashboard" replace />;
    }
    if (role !== 'hr' && role !== 'admin') {
      return <Navigate to={getDashboardPath(role)} replace />;
    }
  } else if (allowedRoles === 'candidate') {
    if (role !== 'candidate') {
      return <Navigate to={getDashboardPath(role)} replace />;
    }
  } else if (allowedRoles === 'manager') {
    if (role !== 'manager' && role !== 'hr' && role !== 'admin') {
      return <Navigate to={getDashboardPath(role)} replace />;
    }
  } else if (allowedRoles === 'employee') {
    if (!role) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
