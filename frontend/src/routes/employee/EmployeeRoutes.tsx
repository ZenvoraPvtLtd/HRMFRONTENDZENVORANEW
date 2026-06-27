import { Navigate, Route } from "react-router-dom";

import MyPerformancePage from "../../features/shared/MyPerformancePage";
import MyGrievancesPage from "../../features/shared/MyGrievancesPage";

export const EmployeeSpecificRoutes = () => (
  <>
    <Route path="performance" element={<MyPerformancePage />} />
    <Route path="grievances" element={<MyGrievancesPage />} />
    <Route path="attendance" element={<Navigate to="timesheet" replace />} />
  </>
);

export default EmployeeSpecificRoutes;
