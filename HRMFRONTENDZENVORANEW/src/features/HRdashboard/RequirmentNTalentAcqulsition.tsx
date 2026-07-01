import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Plus,
  Save,
  X,
} from "lucide-react";
import ConstrainedDropdown from "../../components/ConstrainedDropdown";
import { useTopHeaderSearch } from "../../hooks/useTopHeaderSearch";
import {
  btnPrimary,
  card,
  getStatusStyle,
  hrPageWrap,
  inputMuted,
  tableHead,
  textPrimary,
  textSecondary,
} from "./hrTheme";
import {
  createRecruitmentCandidate,
  createRecruitmentInterview,
  createRecruitmentJob,
  fetchRecruitmentCandidates,
  fetchRecruitmentInterviews,
  fetchRecruitmentJobs,
} from "../../services/recruitmentApi";

type JobStatus = "Published" | "Draft" | "Closed";
type CandidateStatus = "Accepted" | "Offered" | "Applied" | "Rejected";

type Job = {
  id: string | number;
  title: string;
  type: string;
  location: string;
  department: string;
  status: JobStatus;
  posted: string;
  description: string;
};

type Candidate = {
  id: string | number;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: CandidateStatus;
  applied: string;
  source: string;
};

type Interview = {
  id: string | number;
  candidate: string;
  role: string;
  date: string;
  time: string;
  mode: string;
  interviewer: string;
  meetingLink: string;
};

const initialJobs: Job[] = [
  {
    id: 1,
    title: "SEO Intern",
    type: "Internship",
    location: "Indore",
    department: "Marketing",
    status: "Published",
    posted: "04/12/2025",
    description: "Support SEO campaigns, keyword tracking, and weekly reporting.",
  },
  {
    id: 2,
    title: "AWS Engineer",
    type: "Full Time",
    location: "Remote",
    department: "Tech Team",
    status: "Published",
    posted: "02/12/2025",
    description: "Manage cloud infrastructure, deployments, and monitoring.",
  },
  {
    id: 3,
    title: "Graphic Designer",
    type: "Full Time",
    location: "Hybrid",
    department: "Creative",
    status: "Published",
    posted: "01/12/2025",
    description: "Create marketing creatives, social posts, and brand assets.",
  },
];

const initialCandidates: Candidate[] = [
  {
    id: 1,
    name: "Sanskar Yadav",
    email: "sanskar@vectedtech.com",
    phone: "9876543210",
    role: "SEO Intern",
    status: "Accepted",
    applied: "04/12/2025",
    source: "Referral",
  },
  {
    id: 2,
    name: "Shiva Nirapure",
    email: "shivanirapure2003@gmail.com",
    phone: "9876501234",
    role: "AWS Engineer",
    status: "Offered",
    applied: "04/12/2025",
    source: "LinkedIn",
  },
  {
    id: 3,
    name: "Siddharth Awasthi",
    email: "sidawasthi0902@gmail.com",
    phone: "9988776655",
    role: "Graphic Designer",
    status: "Applied",
    applied: "02/12/2025",
    source: "Careers Page",
  },
];

const initialInterviews: Interview[] = [
  {
    id: 1,
    candidate: "Sanskar Yadav",
    role: "SEO Intern",
    date: "06/12/2025",
    time: "11:30 AM",
    mode: "Video Interview",
    interviewer: "Satyam Dixit",
    meetingLink: "https://meet.google.com/seo-round",
  },
  {
    id: 2,
    candidate: "Shiva Nirapure",
    role: "AWS Engineer",
    date: "07/12/2025",
    time: "03:00 PM",
    mode: "Technical Round",
    interviewer: "Tech Panel",
    meetingLink: "https://meet.google.com/aws-round",
  },
  {
    id: 3,
    candidate: "Siddharth Awasthi",
    role: "Graphic Designer",
    date: "08/12/2025",
    time: "12:00 PM",
    mode: "HR Round",
    interviewer: "HR Team",
    meetingLink: "https://meet.google.com/design-round",
  },
];

export default function RecruitmentTalentAcquisition() {
  const [search] = useTopHeaderSearch();
  const [, setJobs] = useState<Job[]>(initialJobs);
  const [, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [interviews, setInterviews] = useState<Interview[]>(initialInterviews);

  const [showJobModal, setShowJobModal] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: "",
    type: "Full Time",
    location: "",
    department: "",
    posted: "",
    status: "Published" as JobStatus,
    description: "",
  });
  const [candidateForm, setCandidateForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    status: "Applied" as CandidateStatus,
    applied: "",
    source: "",
  });
  const [interviewForm, setInterviewForm] = useState({
    candidate: "",
    candidatePhone: "",
    role: "",
    date: "",
    time: "",
    mode: "Video Interview",
    interviewer: "",
    meetingLink: "",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadRecruitmentData() {
      try {
        const [jobsData, candidatesData, interviewsData] = await Promise.all([
          fetchRecruitmentJobs(),
          fetchRecruitmentCandidates(),
          fetchRecruitmentInterviews(),
        ]);

        if (!isMounted) return;
        setJobs(jobsData);
        setCandidates(candidatesData);
        setInterviews(interviewsData);
      } catch (error) {
        console.error("Unable to load recruitment data", error);
      }
    }

    loadRecruitmentData();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredInterviews = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return interviews;

    return interviews.filter((interview) =>
      [
        interview.candidate,
        interview.role,
        interview.date,
        interview.time,
        interview.mode,
        interview.interviewer,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [interviews, search]);

  const handlePostJob = async () => {
    if (!jobForm.title.trim() || !jobForm.location.trim() || !jobForm.department.trim()) return;

    try {
      const job = await createRecruitmentJob({
        title: jobForm.title,
        type: jobForm.type,
        location: jobForm.location,
        department: jobForm.department,
        status: jobForm.status,
        posted: jobForm.posted || new Date().toLocaleDateString("en-GB"),
        description: jobForm.description,
      });

      setJobs((prev) => [job, ...prev]);
      setJobForm({
        title: "",
        type: "Full Time",
        location: "",
        department: "",
        posted: "",
        status: "Published",
        description: "",
      });
      setShowJobModal(false);
    } catch (error) {
      console.error("Unable to publish job", error);
    }
  };

  const handleAddCandidate = async () => {
    if (!candidateForm.name.trim() || !candidateForm.email.trim() || !candidateForm.role.trim()) return;

    try {
      const candidate = await createRecruitmentCandidate({
        name: candidateForm.name,
        email: candidateForm.email,
        phone: candidateForm.phone,
        role: candidateForm.role,
        status: candidateForm.status,
        applied: candidateForm.applied || new Date().toLocaleDateString("en-GB"),
        source: candidateForm.source || "Manual",
      });

      setCandidates((prev) => [candidate, ...prev]);
      setCandidateForm({
        name: "",
        email: "",
        phone: "",
        role: "",
        status: "Applied",
        applied: "",
        source: "",
      });
      setShowCandidateModal(false);
    } catch (error) {
      console.error("Unable to add candidate", error);
    }
  };

  const handleScheduleInterview = async () => {
    if (
      !interviewForm.candidate.trim() ||
      !interviewForm.role.trim() ||
      !interviewForm.date ||
      !interviewForm.time
    )
      return;

    try {
      const payload = {
        candidate_name: interviewForm.candidate,
        candidate_phone: interviewForm.candidatePhone,
        position: interviewForm.role || "Interview Round",
        scheduled_at: `${interviewForm.date}T${interviewForm.time}:00`,
        interview_type: interviewForm.mode,
        interviewer_name: interviewForm.interviewer || "HR Team",
        zoom_link: interviewForm.meetingLink,
      };

      const interview = await createRecruitmentInterview(
        payload as unknown as Parameters<typeof createRecruitmentInterview>[0],
      );

      setInterviews((prev) => [interview, ...prev]);
      setInterviewForm({
        candidate: "",
        candidatePhone: "",
        role: "",
        date: "",
        time: "",
        mode: "Video Interview",
        interviewer: "",
        meetingLink: "",
      });
      setShowInterviewModal(false);
    } catch (error) {
      console.error("Unable to schedule interview", error);
    }
  };

  return (
    <div className={hrPageWrap}>
      <div className="max-w-[1280px] mx-auto">
        <div className="flex justify-end mb-5">
          <div className="flex flex-wrap justify-end gap-3">
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-bold mb-4" style={textPrimary}>
            Interviews ({filteredInterviews.length})
          </h2>

          <div className="rounded-lg p-4" style={card}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead style={tableHead}>
                  <tr>
                    {["Candidate", "Role", "Date", "Time", "Mode", "Interviewer", "Meeting Link"].map((column) => (
                      <th key={column} className="px-4 py-4 text-left text-xs font-semibold">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInterviews.map((interview) => (
                    <tr key={interview.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-4 py-5 text-sm font-semibold" style={textPrimary}>
                        {interview.candidate}
                      </td>
                      <td className="px-4 py-5 text-sm" style={textSecondary}>
                        {interview.role}
                      </td>
                      <td className="px-4 py-5 text-sm" style={textSecondary}>
                        {interview.date}
                      </td>
                      <td className="px-4 py-5 text-sm" style={textSecondary}>
                        {interview.time}
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className="inline-flex px-3 py-1 rounded-full text-xs font-semibold"
                          style={getStatusStyle("In Progress")}
                        >
                          {interview.mode}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-sm" style={textSecondary}>
                        {interview.interviewer}
                      </td>
                      <td className="px-4 py-5 text-sm">
                        {interview.meetingLink ? (
                          <a
                            href={interview.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold hover:underline"
                            style={{ color: "var(--accent)" }}
                          >
                            Open Link
                          </a>
                        ) : (
                          <span style={textSecondary}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredInterviews.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm" style={textSecondary}>
                        No interviews found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {showJobModal && (
          <Modal
            title="Post Job"
            subtitle="Create a role opening for the recruitment pipeline."
            onClose={() => setShowJobModal(false)}
          >
            <div className="space-y-5">
              <FormField label="Job Title" required>
                <input
                  value={jobForm.title}
                  onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })}
                  placeholder="AWS Engineer"
                  className="w-full rounded-lg px-4 py-3 outline-none"
                  style={inputMuted}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Employment Type">
                  <ConstrainedDropdown
                    value={jobForm.type}
                    onChange={(value) => setJobForm({ ...jobForm, type: value })}
                    options={["Full Time", "Part Time", "Internship", "Contract"]}
                    buttonStyle={inputMuted}
                  />
                </FormField>

                <FormField label="Status">
                  <ConstrainedDropdown
                    value={jobForm.status}
                    onChange={(value) =>
                      setJobForm({ ...jobForm, status: value as JobStatus })
                    }
                    options={["Published", "Draft", "Closed"]}
                    buttonStyle={inputMuted}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Department" required>
                  <input
                    value={jobForm.department}
                    onChange={(event) =>
                      setJobForm({ ...jobForm, department: event.target.value })
                    }
                    placeholder="Tech Team"
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>

                <FormField label="Location" required>
                  <input
                    value={jobForm.location}
                    onChange={(event) =>
                      setJobForm({ ...jobForm, location: event.target.value })
                    }
                    placeholder="Remote / Indore / Hybrid"
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>
              </div>

              <FormField label="Role Summary">
                <textarea
                  value={jobForm.description}
                  onChange={(event) =>
                    setJobForm({ ...jobForm, description: event.target.value })
                  }
                  placeholder="Add short responsibilities and hiring context..."
                  className="w-full rounded-lg px-4 py-3 outline-none min-h-28 resize-y"
                  style={inputMuted}
                />
              </FormField>

              <FormField label="Posted Date">
                <input
                  value={jobForm.posted}
                  onChange={(event) => setJobForm({ ...jobForm, posted: event.target.value })}
                  placeholder="04/12/2025"
                  className="w-full rounded-lg px-4 py-3 outline-none"
                  style={inputMuted}
                />
              </FormField>

              <button
                onClick={handlePostJob}
                className="w-full rounded-lg py-3 font-semibold inline-flex justify-center items-center gap-2"
                style={btnPrimary}
              >
                <Save size={16} />
                Publish Job
              </button>
            </div>
          </Modal>
        )}

        {showCandidateModal && (
          <Modal
            title="Add Candidate"
            subtitle="Capture candidate details and attach them to the hiring funnel."
            onClose={() => setShowCandidateModal(false)}
          >
            <div className="space-y-5">
              <FormField label="Candidate Name" required>
                <input
                  value={candidateForm.name}
                  onChange={(event) =>
                    setCandidateForm({ ...candidateForm, name: event.target.value })
                  }
                  placeholder="Sanskar Yadav"
                  className="w-full rounded-lg px-4 py-3 outline-none"
                  style={inputMuted}
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Email" required>
                  <input
                    value={candidateForm.email}
                    onChange={(event) =>
                      setCandidateForm({ ...candidateForm, email: event.target.value })
                    }
                    placeholder="candidate@email.com"
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>

                <FormField label="Phone">
                  <input
                    value={candidateForm.phone}
                    onChange={(event) =>
                      setCandidateForm({ ...candidateForm, phone: event.target.value })
                    }
                    placeholder="9876543210"
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Applied Role" required>
                  <input
                    value={candidateForm.role}
                    onChange={(event) =>
                      setCandidateForm({ ...candidateForm, role: event.target.value })
                    }
                    placeholder="SEO Intern"
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>

                <FormField label="Status">
                  <ConstrainedDropdown
                    value={candidateForm.status}
                    onChange={(value) =>
                      setCandidateForm({
                        ...candidateForm,
                        status: value as CandidateStatus,
                      })
                    }
                    options={["Accepted", "Offered", "Applied", "Rejected"]}
                    buttonStyle={inputMuted}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Source">
                  <input
                    value={candidateForm.source}
                    onChange={(event) =>
                      setCandidateForm({ ...candidateForm, source: event.target.value })
                    }
                    placeholder="LinkedIn / Referral"
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>

                <FormField label="Applied Date">
                  <input
                    value={candidateForm.applied}
                    onChange={(event) =>
                      setCandidateForm({ ...candidateForm, applied: event.target.value })
                    }
                    placeholder="04/12/2025"
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>
              </div>

              <button
                onClick={handleAddCandidate}
                className="w-full rounded-lg py-3 font-semibold inline-flex justify-center items-center gap-2"
                style={btnPrimary}
              >
                <Plus size={16} />
                Add Candidate
              </button>
            </div>
          </Modal>
        )}

        {showInterviewModal && (
          <Modal
            title="Schedule Interview"
            subtitle="Plan interview round, timing, interviewer, and meeting details."
            onClose={() => setShowInterviewModal(false)}
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Candidate Name" required>
                  <input
                    value={interviewForm.candidate}
                    onChange={(event) =>
                      setInterviewForm({ ...interviewForm, candidate: event.target.value })
                    }
                    placeholder="Sanskar Yadav"
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>

                <FormField label="WhatsApp Phone (for notifications)">
                  <input
                    value={interviewForm.candidatePhone}
                    onChange={(event) =>
                      setInterviewForm({ ...interviewForm, candidatePhone: event.target.value })
                    }
                    placeholder="+91 9876543210"
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Role" required>
                  <input
                    value={interviewForm.role}
                    onChange={(event) =>
                      setInterviewForm({ ...interviewForm, role: event.target.value })
                    }
                    placeholder="SEO Intern"
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>

                <FormField label="Round">
                  <ConstrainedDropdown
                    value={interviewForm.mode}
                    onChange={(value) =>
                      setInterviewForm({ ...interviewForm, mode: value })
                    }
                    options={["Video Interview", "Technical Round", "HR Round", "Final Round"]}
                    buttonStyle={inputMuted}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Date" required>
                  <input
                    type="date"
                    value={interviewForm.date}
                    onChange={(event) =>
                      setInterviewForm({ ...interviewForm, date: event.target.value })
                    }
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>

                <FormField label="Time" required>
                  <input
                    type="time"
                    value={interviewForm.time}
                    onChange={(event) =>
                      setInterviewForm({ ...interviewForm, time: event.target.value })
                    }
                    className="w-full rounded-lg px-4 py-3 outline-none"
                    style={inputMuted}
                  />
                </FormField>
              </div>

              <FormField label="Interviewer">
                <input
                  value={interviewForm.interviewer}
                  onChange={(event) =>
                    setInterviewForm({ ...interviewForm, interviewer: event.target.value })
                  }
                  placeholder="Satyam Dixit / Tech Panel"
                  className="w-full rounded-lg px-4 py-3 outline-none"
                  style={inputMuted}
                />
              </FormField>

              <FormField label="Meeting Link">
                <input
                  value={interviewForm.meetingLink}
                  onChange={(event) =>
                    setInterviewForm({ ...interviewForm, meetingLink: event.target.value })
                  }
                  placeholder="https://meet.google.com/..."
                  className="w-full rounded-lg px-4 py-3 outline-none"
                  style={inputMuted}
                />
              </FormField>

              <button
                onClick={handleScheduleInterview}
                className="w-full rounded-lg py-3 font-semibold inline-flex justify-center items-center gap-2"
                style={btnPrimary}
              >
                <CalendarDays size={16} />
                Schedule Interview
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-lg shadow-2xl max-h-[88vh] flex flex-col overflow-hidden" style={card}>
        <div
          className="flex items-start justify-between gap-4 px-6 py-5 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h2 className="text-lg font-bold" style={textPrimary}>
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm mt-1 leading-5" style={textSecondary}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0"
            aria-label="Close modal"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-2" style={textPrimary}>
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
