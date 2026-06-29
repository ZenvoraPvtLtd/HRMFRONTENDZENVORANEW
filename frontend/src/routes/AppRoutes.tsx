import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "../components/layout/Layout";

// Chatbots
import HRChatbot from "../features/chatbot/HRChatbot";
import EmployeeChatbot from "../features/chatbot/EmployeeChatbot";

// Dashboard tools
import Productivity from "../features/dashboard/Productivity";
import Reports from "../features/dashboard/Reports";
import ResultsReview from "../features/dashboard/ResultsReviewPage";
import RiskAnalysis from "../features/dashboard/RiskAnalysisPage";
import TeamManagement from "../features/dashboard/TeamManagement";
import WorkflowAutomationPage from "../features/dashboard/automation/WorkflowAutomationPage";
// import Jobs from "../features/dashboard/jobs/JobsPage";
// import CreateJobPage from "../features/dashboard/jobs/CreateJobPage";

// HR pages
import AttendanceCorrection from "../features/HRdashboard/AttendanceCorrection";
import HRAnnouncements from "../features/HRdashboard/Announcements";
import Compliance from "../features/HRdashboard/Compliance";
import Documents from "../features/HRdashboard/Documents";
import Employee from "../features/HRdashboard/Employee";
import EmployeeDetailPage from "../features/HRdashboard/EmployeeDetailPage";
import EmployeeManagement from "../features/HRdashboard/EmployeeManagement";
import EmployeeonBoarding from "../features/HRdashboard/EmployeeonBoarding";
import Events from "../features/HRdashboard/Events";
import ExitManagement from "../features/HRdashboard/ExitManagement";
import GrievanceHandling from "../features/HRdashboard/GrievanceHandling";
import HolidayCalendar from "../features/HRdashboard/HolidayCalendar";
import LeaveBalanceManagement from "../features/HRdashboard/LeaveBalanceManagement";
import LeaveManagment from "../features/HRdashboard/LeaveManagment";
import MyAssignTask from "../features/HRdashboard/MyAssignTask";
import PerformanceImprovementPlanPIP from "../features/HRdashboard/PerformanceImprovementPlanPIP";
import PerformanceManagement from "../features/HRdashboard/PerformanceManagement";
import RecruitmentTalentAcquisition from "../features/HRdashboard/RequirmentNTalentAcqulsition";
import TimeSheetApprovals from "../features/HRdashboard/TimeSheetApprovals";
import TimeSheetTracker from "../features/HRdashboard/TimeSheetTracker";
import InterviewModules from "../features/HRdashboard/InterviewModules";
// AI Video Interview removed
// import AIVideoInterview from "../features/HRdashboard/AIVideoInterview";
import WhatsAppIntegration from "../features/HRdashboard/WhatsAppIntegration";
import AIPredictivity from "../features/HRdashboard/AIPredictivity";
import AIAnalytics from "../features/HRdashboard/AIAnalytics";
import CandidatesPage from "../features/HRdashboard/CandidatesPage";
import CandidateScreeningPage from "../features/HRdashboard/CandidateScreeningPage";
// AI interview pages removed
import AIInterviewDashboard from "../features/ai-interview/pages/InterviewDashboard";
import AICreateInterview from "../features/ai-interview/pages/CreateInterview";
import AIInterviewHistory from "../features/ai-interview/pages/InterviewHistory";
import AIInterviewLink from "../features/ai-interview/pages/InterviewLink";
import AIResumeUpload from "../features/ai-interview/pages/ResumeUpload";
import AIResumeAnalysis from "../features/ai-interview/pages/ResumeAnalysis";
import AIPreInterviewCheck from "../features/ai-interview/pages/PreInterviewCheck";
import AIInterviewRoom from "../features/ai-interview/pages/InterviewRoom";
import AIInterviewResult from "../features/ai-interview/pages/InterviewResult";

// Module 07 — Resume Screening (removed)
// import ResumeScreening from "../features/module07/Resumescreening";
// import InterviewDashboard from "../features/module07/InterviewDashboard";

// AI Video Interview Live Page (removed)
// import AIVideoInterviewPage from "../features/dashboard/AIVideoInterviewPage";

// New feature pages
import SalarySlipPage from "../features/dashboard/SalarySlipPage";
import OfferLetterPage from "../features/dashboard/OfferLetterPage";
import ShortlistReportPage from "../features/dashboard/ShortlistReportPage";
import QrAttendanceScanPage from "../features/shared/QrAttendanceScanPage";

// Manager
import ManagerAttendancePage from "../features/ManagerDashboard/ManagementTools/Attendance";
import ApprovalsPage from "../features/ManagerDashboard/ManagementTools/ApprovalsPage";
import CreateProjectPage from "../features/ManagerDashboard/ManagementTools/CreateProjectPage";
import ProductivityPage from "../features/ManagerDashboard/ManagementTools/ProductivyPage";
import ProjectsPages from "../features/ManagerDashboard/ManagementTools/ProjectsPages";
import ManagerTeamManagement from "../features/ManagerDashboard/ManagementTools/TeamManagement";
import ManagerHomePage from "../features/ManagerDashboard/ManagerHomePage";

// Admin
import AdminOverview from "../features/AdminDashboard/AdminOverview";
import AdminUserManagement from "../features/AdminDashboard/AdminUserManagement";

// Shared
import { DashboardOverview as EmployeeDashboard } from "../features/shared/Dashboard";
import ColleagueChatPage from "../features/shared/ColleagueChatPage";
import SprintBoardPage from "../features/shared/SprintBoardPage";
import SprintBoardDetailPage from "../features/shared/SprintBoardDetailPage";
import MyTasksPage from "../features/shared/MyTasksPage";
import LeavePage from "../features/shared/LeavePage";
import TimesheetPage from "../features/shared/TimesheetPage";
import OrganizationPage from "../features/shared/OrganizationPage";
import ProfilePage from "../features/shared/ProfilePage";
import MyPIPPage from "../features/shared/MyPIPPage";
import MyPerformancePage from "../features/shared/MyPerformancePage";
import MyGrievancesPage from "../features/shared/MyGrievancesPage";

// Employee read-only views
import EmployeeAnnouncements from "../features/EmployeeDashboard/EmployeeAnnouncements";
import EmployeeEvents from "../features/EmployeeDashboard/EmployeeEvents";
import EmployeeHolidays from "../features/EmployeeDashboard/EmployeeHolidays";

// Auth
import ForgotPassword from "../pages/auth/ForgotPassword";
import Login from "../pages/auth/Login";
import OAuthCallback from "../pages/auth/OAuthCallback";
import Register from "../pages/auth/Register";
import ResetPassword from "../pages/auth/ResetPassword";

import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";

// ---------------------------------------------------------------------------
// Legacy redirect helpers (these are elements, NOT route-group wrappers)
// ---------------------------------------------------------------------------
const LegacyHrDashboardRedirect = () => {
  const location = useLocation();
  const nextPath = location.pathname.replace(/^\/hr-dashboard/, "/employees");
  return <Navigate to={`${nextPath}${location.search}${location.hash}`} replace />;
};

const LegacyEmployeeDashboardRedirect = () => {
  const location = useLocation();
  const nextPath = location.pathname.replace(/^\/employeedashboard/, "/dashboard");
  return <Navigate to={`${nextPath}${location.search}${location.hash}`} replace />;
};

// ---------------------------------------------------------------------------
// AppRoutes — everything inlined so React Router v6 never sees a custom
// component as a child of <Routes> or <Route>.
// ---------------------------------------------------------------------------
const AppRoutes = () => (
  <Routes>
    {/* ── Public ─────────────────────────────────────────────────── */}
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/oauth/callback" element={<OAuthCallback />} />
    <Route element={<PublicRoute />}>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Route>

    {/* ── HR ─────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute allowedRoles="hr" />}>
      <Route path="/" element={<Layout role="hr" />}>
        <Route index element={<EmployeeDashboard />} />

        {/* Shared pages */}
        <Route path="sprint-board" element={<SprintBoardPage />} />
        <Route path="sprint-board/:boardId" element={<SprintBoardDetailPage />} />
        <Route path="my-tasks" element={<MyTasksPage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="timesheet" element={<TimesheetPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="my-pip" element={<MyPIPPage />} />

        {/* HR tools */}
        <Route path="productivity" element={<Productivity />} />
        <Route path="automation" element={<WorkflowAutomationPage />} />
        <Route path="results" element={<ResultsReview />} />
        <Route path="risk" element={<RiskAnalysis />} />
        <Route path="reports" element={<Reports />} />
        {/* <Route path="jobs" element={<Jobs />} /> */}
        {/* <Route path="jobs/create" element={<CreateJobPage />} /> */}
        <Route path="team-management" element={<TeamManagement />} />
        <Route path="team-management/productivity" element={<Productivity />} />
        <Route path="team-management/reports" element={<Reports />} />
        <Route path="team-management/announcements" element={<HRAnnouncements />} />

        {/* Legacy redirects */}
        <Route path="hr-dashboard" element={<Navigate to="/employees" replace />} />
        <Route path="hr-dashboard/*" element={<LegacyHrDashboardRedirect />} />
        <Route path="hr-management" element={<Navigate to="/employees" replace />} />
        <Route path="vected-ems-dashboard" element={<Navigate to="/employees" replace />} />

        {/* Employees */}
        <Route path="employees" element={<Employee />} />
        <Route path="employees/:employeeId" element={<EmployeeDetailPage />} />
        <Route path="hr-management/employees" element={<Employee />} />
        <Route path="hr-management/employees/:employeeId" element={<EmployeeDetailPage />} />

        {/* Employee management */}
        <Route path="employee-management" element={<EmployeeManagement />} />
        <Route path="hr-management/employee-management" element={<EmployeeManagement />} />
        <Route path="employee-onboarding" element={<EmployeeonBoarding />} />
        <Route path="hr-management/employee-onboarding" element={<EmployeeonBoarding />} />

        {/* Calendar & leave */}
        <Route path="holiday-calendar" element={<HolidayCalendar />} />
        <Route path="hr-management/holiday-calendar" element={<HolidayCalendar />} />
        <Route path="announcements" element={<HRAnnouncements />} />
        <Route path="hr-management/announcements" element={<HRAnnouncements />} />
        <Route path="leave-balance" element={<LeaveBalanceManagement />} />
        <Route path="hr-management/leave-balance" element={<LeaveBalanceManagement />} />
        <Route path="leave-management" element={<LeaveManagment />} />
        <Route path="hr-management/leave-management" element={<LeaveManagment />} />

        {/* Performance & tasks */}
        <Route path="my-assign-task" element={<MyAssignTask />} />
        <Route path="hr-management/my-assign-task" element={<MyAssignTask />} />
        <Route path="performance" element={<PerformanceManagement />} />
        <Route path="performance-improvement-plan" element={<PerformanceImprovementPlanPIP />} />
        <Route path="hr-management/performance-improvement-plan" element={<PerformanceImprovementPlanPIP />} />

        {/* Grievances, Events, Docs */}
        <Route path="grievances" element={<GrievanceHandling />} />
        <Route path="events" element={<Events />} />
        <Route path="hr-management/events" element={<Events />} />
        <Route path="documents" element={<Documents />} />
        <Route path="hr-management/documents" element={<Documents />} />
        <Route path="compliance" element={<Compliance />} />
        <Route path="hr-management/compliance" element={<Compliance />} />
        <Route path="exit-management" element={<ExitManagement />} />
        <Route path="hr-management/exit-management" element={<ExitManagement />} />

        {/* Recruitment */}
        <Route path="recruitment-talent-acquisition" element={<RecruitmentTalentAcquisition />} />
        <Route path="hr-management/recruitment-talent-acquisition" element={<RecruitmentTalentAcquisition />} />

        {/* Timesheet */}
        <Route path="timesheet-approvals" element={<TimeSheetApprovals />} />
        <Route path="hr-management/timesheet-approvals" element={<TimeSheetApprovals />} />


        <Route path="attendance-correction" element={<AttendanceCorrection />} />
        <Route path="hr-management/attendance-correction" element={<AttendanceCorrection />} />
        <Route path="attendance-management" element={<ManagerAttendancePage />} />

        {/* HR AI */}
        <Route path="interview-modules" element={<InterviewModules />} />
        <Route path="hr-management/interview-modules" element={<InterviewModules />} />
        <Route path="recruitment/ai-interview" element={<AIInterviewDashboard />} />
        <Route path="recruitment/ai-interview/create" element={<AICreateInterview />} />
        <Route path="recruitment/ai-interview/history" element={<AIInterviewHistory />} />
        <Route path="recruitment/ai-interview/link/:id" element={<AIInterviewLink />} />
        <Route path="hr-management/ai-interview" element={<AIInterviewDashboard />} />
        <Route path="hr-management/ai-interview/create" element={<AICreateInterview />} />
        <Route path="hr-management/ai-interview/history" element={<AIInterviewHistory />} />
        <Route path="hr-management/ai-interview/link/:id" element={<AIInterviewLink />} />

        <Route path="whatsapp" element={<WhatsAppIntegration />} />
        <Route path="hr-management/whatsapp" element={<WhatsAppIntegration />} />
        <Route path="ai-predictivity" element={<AIPredictivity />} />
        <Route path="hr-management/ai-predictivity" element={<AIPredictivity />} />
        <Route path="ai-analytics" element={<AIAnalytics />} />
        <Route path="hr-management/ai-analytics" element={<AIAnalytics />} />
        <Route path="candidates" element={<CandidatesPage />} />
        <Route path="hr-management/candidates" element={<CandidatesPage />} />
        <Route path="candidate-screening" element={<CandidateScreeningPage />} />
        <Route path="hr-management/candidate-screening" element={<CandidateScreeningPage />} />




        {/* Salary & Offer Letters */}
        <Route path="salary-slips" element={<SalarySlipPage />} />
        <Route path="hr-management/salary-slips" element={<SalarySlipPage />} />
        <Route path="offer-letters" element={<OfferLetterPage />} />
        <Route path="hr-management/offer-letters" element={<OfferLetterPage />} />
        <Route path="shortlist-report" element={<ShortlistReportPage />} />
        <Route path="hr-management/shortlist-report" element={<ShortlistReportPage />} />

        {/* Manager tools (HR access) */}
        <Route path="manager-tools/attendance" element={<ManagerAttendancePage />} />
        <Route path="manager-tools/approvals" element={<Navigate to="/leave-management" replace />} />
        <Route path="manager-tools/productivity" element={<Productivity />} />
        <Route path="manager-tools/projects" element={<ProjectsPages />} />
        <Route path="manager-tools/projects/create" element={<CreateProjectPage />} />
        <Route path="manager-tools/team-management" element={<ManagerTeamManagement />} />

        {/* Chatbot */}
        <Route
          path="chatbot"
          element={
            <div className="h-full w-full flex flex-1 flex-col bg-secondary">
              <HRChatbot isFullScreen />
            </div>
          }
        />
      </Route>
    </Route>

    {/* ── Employee ────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute allowedRoles="employee" />}>
      <Route path="/employeedashboard/*" element={<LegacyEmployeeDashboardRedirect />} />
      <Route path="/dashboard" element={<Layout role="employee" />}>
        <Route index element={<EmployeeDashboard />} />

        {/* Shared */}
        <Route path="sprint-board" element={<SprintBoardPage />} />
        <Route path="sprint-board/:boardId" element={<SprintBoardDetailPage />} />
        <Route path="my-tasks" element={<MyTasksPage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="timesheet" element={<TimesheetPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="my-pip" element={<MyPIPPage />} />

        {/* Employee-specific */}
        <Route path="performance" element={<MyPerformancePage />} />
        <Route path="grievances" element={<MyGrievancesPage />} />
        <Route path="attendance" element={<Navigate to="timesheet" replace />} />
        <Route path="announcements" element={<EmployeeAnnouncements />} />
        <Route path="events" element={<EmployeeEvents />} />
        <Route path="holiday-calendar" element={<EmployeeHolidays />} />

        <Route
          path="chatbot"
          element={
            <div className="h-full w-full flex flex-1 flex-col bg-secondary">
              <EmployeeChatbot isFullScreen />
            </div>
          }
        />
      </Route>
    </Route>

    {/* ── Manager ─────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute allowedRoles="manager" />}>
      <Route path="/manager" element={<Layout role="manager" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ManagerHomePage />} />

        {/* Shared */}
        <Route path="sprint-board" element={<SprintBoardPage />} />
        <Route path="sprint-board/:boardId" element={<SprintBoardDetailPage />} />
        <Route path="my-tasks" element={<MyTasksPage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="timesheet" element={<TimesheetPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="my-pip" element={<MyPIPPage />} />

        {/* Manager tools */}
        <Route path="attendance" element={<ManagerAttendancePage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="productivity" element={<ProductivityPage />} />
        <Route path="projects" element={<ProjectsPages />} />
        <Route path="projects/create" element={<CreateProjectPage />} />
        <Route path="team-management" element={<ManagerTeamManagement />} />
        <Route path="announcements" element={<HRAnnouncements />} />
        <Route path="events" element={<Events />} />
        <Route path="holiday-calendar" element={<HolidayCalendar />} />

        <Route
          path="chatbot"
          element={
            <div className="h-full w-full flex flex-1 flex-col bg-secondary">
              <EmployeeChatbot isFullScreen />
            </div>
          }
        />
      </Route>

      {/* Legacy manager path */}
      <Route path="/managerdashboard" element={<Layout role="manager" />}>
        <Route index element={<ManagerHomePage />} />
        <Route path="sprint-board" element={<SprintBoardPage />} />
        <Route path="sprint-board/:boardId" element={<SprintBoardDetailPage />} />
        <Route path="my-tasks" element={<MyTasksPage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="timesheet" element={<TimesheetPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="my-pip" element={<MyPIPPage />} />
        <Route path="attendance" element={<ManagerAttendancePage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="productivity" element={<ProductivityPage />} />
        <Route path="projects" element={<ProjectsPages />} />
        <Route path="projects/create" element={<CreateProjectPage />} />
        <Route path="team-management" element={<ManagerTeamManagement />} />
        <Route path="announcements" element={<HRAnnouncements />} />
        <Route path="events" element={<Events />} />
        <Route path="holiday-calendar" element={<HolidayCalendar />} />
      </Route>
    </Route>

    {/* ── Admin ───────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute allowedRoles="admin" />}>
      <Route path="/admin/*" element={<Layout role="admin" />}>
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUserManagement />} />

        {/* Shared */}
        <Route path="leave" element={<LeavePage />} />
        <Route path="timesheet" element={<TimesheetPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="my-pip" element={<MyPIPPage />} />

        {/* HR routes for admin */}
        <Route path="employees" element={<Employee />} />
        <Route path="employees/:employeeId" element={<EmployeeDetailPage />} />
        <Route path="employee-management" element={<EmployeeManagement />} />
        <Route path="employee-onboarding" element={<EmployeeonBoarding />} />
        <Route path="holiday-calendar" element={<HolidayCalendar />} />
        <Route path="announcements" element={<HRAnnouncements />} />
        <Route path="leave-balance" element={<LeaveBalanceManagement />} />
        <Route path="leave-management" element={<LeaveManagment />} />
        <Route path="my-assign-task" element={<MyAssignTask />} />
        <Route path="performance" element={<PerformanceManagement />} />
        <Route path="performance-improvement-plan" element={<PerformanceImprovementPlanPIP />} />
        <Route path="grievances" element={<GrievanceHandling />} />
        <Route path="events" element={<Events />} />
        <Route path="documents" element={<Documents />} />
        <Route path="compliance" element={<Compliance />} />
        <Route path="exit-management" element={<ExitManagement />} />
        <Route path="recruitment-talent-acquisition" element={<RecruitmentTalentAcquisition />} />
        <Route path="timesheet-approvals" element={<TimeSheetApprovals />} />
        <Route path="attendance-correction" element={<AttendanceCorrection />} />
        <Route path="attendance-management" element={<ManagerAttendancePage />} />
        <Route path="interview-modules" element={<InterviewModules />} />
        <Route path="recruitment/ai-interview" element={<AIInterviewDashboard />} />
        <Route path="recruitment/ai-interview/create" element={<AICreateInterview />} />
        <Route path="recruitment/ai-interview/history" element={<AIInterviewHistory />} />
        <Route path="recruitment/ai-interview/link/:id" element={<AIInterviewLink />} />

        <Route path="whatsapp" element={<WhatsAppIntegration />} />
        <Route path="ai-predictivity" element={<AIPredictivity />} />
        <Route path="ai-analytics" element={<AIAnalytics />} />
        <Route path="candidates" element={<CandidatesPage />} />
        <Route path="candidate-screening" element={<CandidateScreeningPage />} />



        <Route path="salary-slips" element={<SalarySlipPage />} />
        <Route path="offer-letters" element={<OfferLetterPage />} />
        <Route path="shortlist-report" element={<ShortlistReportPage />} />

        {/* Manager tools */}
        <Route path="attendance" element={<ManagerAttendancePage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="productivity" element={<ProductivityPage />} />
        <Route path="projects" element={<ProjectsPages />} />
        <Route path="projects/create" element={<CreateProjectPage />} />
        <Route path="team-management" element={<ManagerTeamManagement />} />

        <Route path="reports" element={<Reports />} />
        <Route path="automation" element={<WorkflowAutomationPage />} />
      </Route>

      {/* Legacy admin paths */}
      <Route path="/admindashboard" element={<Navigate to="/admin" replace />} />
      <Route path="/admindashboard/*" element={<Navigate to="/admin" replace />} />
    </Route>

    {/* Fallback */}
    <Route path="*" element={<Navigate to="/login" replace />} />



    {/* AI Interview Candidate Routes */}
    <Route path="/candidate/interview/:id" element={<AIResumeUpload />} />
    <Route path="/candidate/interview/:id/analysis" element={<AIResumeAnalysis />} />
    <Route path="/candidate/interview/:id/check" element={<AIPreInterviewCheck />} />
    <Route path="/candidate/interview/:id/start" element={<AIInterviewRoom />} />
    <Route path="/candidate/interview/:id/result" element={<AIInterviewResult />} />

    {/* Standalone — QR Attendance Scan (mobile-friendly, no auth required) */}
    <Route path="/qr-attendance" element={<QrAttendanceScanPage />} />


  </Routes>
);

export default AppRoutes;
