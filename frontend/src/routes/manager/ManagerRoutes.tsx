import { Route } from "react-router-dom";

import ManagerAttendancePage from "../../features/ManagerDashboard/ManagementTools/Attendance";
import ApprovalsPage from "../../features/ManagerDashboard/ManagementTools/ApprovalsPage";
import ProductivityPage from "../../features/ManagerDashboard/ManagementTools/ProductivyPage";
import ProjectsPages from "../../features/ManagerDashboard/ManagementTools/ProjectsPages";
import CreateProjectPage from "../../features/ManagerDashboard/ManagementTools/CreateProjectPage";
import ManagerTeamManagement from "../../features/ManagerDashboard/ManagementTools/TeamManagement";

export const ManagerToolRoutes = () => (
  <>
    <Route path="attendance" element={<ManagerAttendancePage />} />
    <Route path="approvals" element={<ApprovalsPage />} />
    <Route path="productivity" element={<ProductivityPage />} />
    <Route path="projects" element={<ProjectsPages />} />
    <Route path="projects/create" element={<CreateProjectPage />} />
    <Route path="team-management" element={<ManagerTeamManagement />} />
  </>
);

export default ManagerToolRoutes;
