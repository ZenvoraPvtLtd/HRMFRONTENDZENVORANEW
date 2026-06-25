import { Route } from "react-router-dom";

import SprintBoardPage from "../../features/shared/SprintBoardPage";
import SprintBoardDetailPage from "../../features/shared/SprintBoardDetailPage";
import MyTasksPage from "../../features/shared/MyTasksPage";
import LeavePage from "../../features/shared/LeavePage";
import TimesheetPage from "../../features/shared/TimesheetPage";
import OrganizationPage from "../../features/shared/OrganizationPage";
import ProfilePage from "../../features/shared/ProfilePage";
import ColleagueChatPage from "../../features/shared/ColleagueChatPage";
import MyPIPPage from "../../features/shared/MyPIPPage";

export const SharedWorkRoutes = () => (
  <>
    <Route path="sprint-board" element={<SprintBoardPage />} />
    <Route path="sprint-board/:boardId" element={<SprintBoardDetailPage />} />
    <Route path="my-tasks" element={<MyTasksPage />} />
    <Route path="leave" element={<LeavePage />} />
    <Route path="timesheet" element={<TimesheetPage />} />
    <Route path="organization" element={<OrganizationPage />} />
    <Route path="profile" element={<ProfilePage />} />
    <Route path="chat" element={<ColleagueChatPage />} />
    <Route path="my-pip" element={<MyPIPPage />} />
  </>
);

export default SharedWorkRoutes;
