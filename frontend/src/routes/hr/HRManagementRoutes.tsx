import { Navigate, Route } from "react-router-dom";

import Employee from "../../features/HRdashboard/Employee";
import EmployeeDetailPage from "../../features/HRdashboard/EmployeeDetailPage";
import EmployeeManagement from "../../features/HRdashboard/EmployeeManagement";
import EmployeeonBoarding from "../../features/HRdashboard/EmployeeonBoarding";
import HolidayCalendar from "../../features/HRdashboard/HolidayCalendar";
import HRAnnouncements from "../../features/HRdashboard/Announcements";
import LeaveBalanceManagement from "../../features/HRdashboard/LeaveBalanceManagement";
import LeaveManagment from "../../features/HRdashboard/LeaveManagment";
import MyAssignTask from "../../features/HRdashboard/MyAssignTask";
import PerformanceManagement from "../../features/HRdashboard/PerformanceManagement";
import GrievanceHandling from "../../features/HRdashboard/GrievanceHandling";
import Events from "../../features/HRdashboard/Events";
import Documents from "../../features/HRdashboard/Documents";
import Compliance from "../../features/HRdashboard/Compliance";
import PerformanceImprovementPlanPIP from "../../features/HRdashboard/PerformanceImprovementPlanPIP";
import ExitManagement from "../../features/HRdashboard/ExitManagement";
import RecruitmentTalentAcquisition from "../../features/HRdashboard/RequirmentNTalentAcqulsition";
import TimeSheetApprovals from "../../features/HRdashboard/TimeSheetApprovals";
import TimeSheetTracker from "../../features/HRdashboard/TimeSheetTracker";
import TrainingNDevlopment from "../../features/HRdashboard/TrainingNDevlopment";
import AttendanceManagement from "../../features/HRdashboard/AttendanceManagement";
import InterviewModules from "../../features/HRdashboard/InterviewModules";
// import AIVideoInterview from "../../features/HRdashboard/AIVideoInterview"; // removed
import WhatsAppIntegration from "../../features/HRdashboard/WhatsAppIntegration";
import AIPredictivity from "../../features/HRdashboard/AIPredictivity";
import AIAnalytics from "../../features/HRdashboard/AIAnalytics";
import CandidatesPage from "../../features/HRdashboard/CandidatesPage";

export const HRManagementRoutes = () => (
  <>
    <Route path="hr-management" element={<Navigate to="/employees" replace />} />
    <Route path="vected-ems-dashboard" element={<Navigate to="/employees" replace />} />
    <Route path="hr-management/vected-ems-dashboard" element={<Navigate to="/employees" replace />} />

    {/* Employees */}
    <Route path="employees" element={<Employee />} />
    <Route path="employees/:employeeId" element={<EmployeeDetailPage />} />
    <Route path="hr-management/employees" element={<Employee />} />
    <Route path="hr-management/employees/:employeeId" element={<EmployeeDetailPage />} />

    {/* Employee Management */}
    <Route path="employee-management" element={<EmployeeManagement />} />
    <Route path="hr-management/employee-management" element={<EmployeeManagement />} />

    {/* Onboarding */}
    <Route path="employee-onboarding" element={<EmployeeonBoarding />} />
    <Route path="hr-management/employee-onboarding" element={<EmployeeonBoarding />} />

    {/* Holiday Calendar */}
    <Route path="holiday-calendar" element={<HolidayCalendar />} />
    <Route path="hr-management/holiday-calendar" element={<HolidayCalendar />} />

    {/* Announcements */}
    <Route path="announcements" element={<HRAnnouncements />} />
    <Route path="team-management/announcements" element={<HRAnnouncements />} />

    {/* Leave Management */}
    <Route path="leave-balance" element={<LeaveBalanceManagement />} />
    <Route path="hr-management/leave-balance" element={<LeaveBalanceManagement />} />
    <Route path="leave-management" element={<LeaveManagment />} />
    <Route path="hr-management/leave-management" element={<LeaveManagment />} />

    {/* HR Actions */}
    <Route path="my-assign-task" element={<MyAssignTask />} />
    <Route path="hr-management/my-assign-task" element={<MyAssignTask />} />

    {/* Performance */}
    <Route path="performance" element={<PerformanceManagement />} />
    <Route path="performance-improvement-plan" element={<PerformanceImprovementPlanPIP />} />
    <Route path="hr-management/performance-improvement-plan" element={<PerformanceImprovementPlanPIP />} />

    {/* Grievances */}
    <Route path="grievances" element={<GrievanceHandling />} />

    {/* Events & Documents */}
    <Route path="events" element={<Events />} />
    <Route path="documents" element={<Documents />} />
    <Route path="compliance" element={<Compliance />} />

    {/* Exit Management */}
    <Route path="exit-management" element={<ExitManagement />} />

    {/* Recruitment */}
    <Route path="recruitment-talent-acquisition" element={<RecruitmentTalentAcquisition />} />
    <Route path="hr-management/recruitment-talent-acquisition" element={<RecruitmentTalentAcquisition />} />

    {/* Timesheet */}
    <Route path="timesheet-approvals" element={<TimeSheetApprovals />} />
    <Route path="hr-management/timesheet-approvals" element={<TimeSheetApprovals />} />


    {/* Training */}
    <Route path="training-development" element={<TrainingNDevlopment />} />
    <Route path="hr-management/training-development" element={<TrainingNDevlopment />} />

    {/* New HR AI Pages */}
    <Route path="interview-modules" element={<InterviewModules />} />
    <Route path="hr-management/interview-modules" element={<InterviewModules />} />

    <Route path="whatsapp" element={<WhatsAppIntegration />} />
    <Route path="hr-management/whatsapp" element={<WhatsAppIntegration />} />
    <Route path="ai-predictivity" element={<AIPredictivity />} />
    <Route path="hr-management/ai-predictivity" element={<AIPredictivity />} />
    <Route path="ai-analytics" element={<AIAnalytics />} />
    <Route path="hr-management/ai-analytics" element={<AIAnalytics />} />
    <Route path="candidates" element={<CandidatesPage />} />
    <Route path="hr-management/candidates" element={<CandidatesPage />} />

  </>
);

export default HRManagementRoutes;
