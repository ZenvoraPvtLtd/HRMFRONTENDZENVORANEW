import { Outlet, Navigate, useLocation } from "react-router-dom";
import { getDashboardPath, isTokenValid } from "../utils/auth";

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

const PublicRoute = () => {
  const location = useLocation();
  const isInviteLogin =
    location.pathname === "/login" &&
    new URLSearchParams(location.search).get("invite") === "1";

  const hrToken = isTokenValid(localStorage.getItem("hr_accessToken")) ? localStorage.getItem("hr_accessToken") : null;
  const candidateToken = isTokenValid(localStorage.getItem("candidate_accessToken")) ? localStorage.getItem("candidate_accessToken") : null;
  const generalToken = isTokenValid(localStorage.getItem("accessToken")) ? localStorage.getItem("accessToken") : null;

  const isOnPublicPath = PUBLIC_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + "/")
  );

  if (!isOnPublicPath) {
    return <Outlet />;
  }

  // Invite links must always show the login form (avoids redirect loop on shared devices).
  if (isInviteLogin) {
    return <Outlet />;
  }

  if (hrToken) {
    const role = localStorage.getItem("hr_userRole") || localStorage.getItem("userRole");
    return <Navigate to={getDashboardPath(role)} replace />;
  }

  if (candidateToken) {
    const role = localStorage.getItem("candidate_userRole") || "candidate";
    return <Navigate to={getDashboardPath(role)} replace />;
  }

  if (generalToken) {
    const role = localStorage.getItem("userRole");
    return <Navigate to={getDashboardPath(role)} replace />;
  }

  return <Outlet />;
};

export default PublicRoute;
