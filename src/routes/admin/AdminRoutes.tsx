import { Route } from "react-router-dom";

import AdminOverview from "../../features/AdminDashboard/AdminOverview";
import AdminUserManagement from "../../features/AdminDashboard/AdminUserManagement";

export const AdminRoutes = () => (
  <>
    <Route index element={<AdminOverview />} />
    <Route path="users" element={<AdminUserManagement />} />
  </>
);

export default AdminRoutes;
