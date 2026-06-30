import { Route } from "react-router-dom";

import RecruitmentTalentAcquisition from "../../features/HRdashboard/RequirmentNTalentAcqulsition";

export const RecruitmentRoutes = () => (
  <>
    <Route path="recruitment-talent-acquisition" element={<RecruitmentTalentAcquisition />} />
    <Route path="hr-management/recruitment-talent-acquisition" element={<RecruitmentTalentAcquisition />} />
  </>
);

export default RecruitmentRoutes;
