# HRM Migration Parity Contract (Express -> FastAPI)

This document captures the current **effective API contract** of the HRM Management System so the FastAPI migration can preserve behavior (routes, auth rules, validation messages, response shapes, and MongoDB compatibility).

## 1) MongoDB / Collections Used

### 1.1 HRM Node/Express API (Mongoose models)
Node uses Mongoose model names:

| Mongoose model | Schema file | Default Mongoose collection (by model pluralization) |
|---|---|---|
| `User` | [`backend/src/models/user.model.ts`](backend/src/models/user.model.ts) | `users` |
| `Job` | [`backend/src/models/job.model.ts`](backend/src/models/job.model.ts) | `jobs` |
| `Candidate` | [`backend/src/models/candidate.model.ts`](backend/src/models/candidate.model.ts) | `candidates` |
| `Application` | [`backend/src/models/application.model.ts`](backend/src/models/application.model.ts) | `applications` |
| `Notification` | [`backend/src/models/notification.model.ts`](backend/src/models/notification.model.ts) | `notifications` |

Notes:
- Mongoose defaults to pluralized, lowercased collection names unless overridden.
- JWT subject/`id` values are MongoDB `_id` strings.

### 1.2 Python AI/analytics service (pymongo)
Python uses `database.py`:
- Database name: `zenvora_ai`
- Resume collection: `parsed_resumes` (configurable via `COLLECTION_NAME`, default `parsed_resumes`)
- Jobs collection for parsing/matching: `Jobs` (literal string)

Source: [`database.py`](database.py)

## 2) Express (Node) HRM API Contract

### 2.1 App mount points (base paths)
Express mounts routes from [`backend/src/app.ts`](backend/src/app.ts):

| Base path | Routes file |
|---|---|
| `/api/oauth` | [`backend/src/routes/oauth.routes.ts`](backend/src/routes/oauth.routes.ts) |
| `/api/auth` | [`backend/src/routes/auth.routes.ts`](backend/src/routes/auth.routes.ts) |
| `/api/jobs` | [`backend/src/routes/job.routes.ts`](backend/src/routes/job.routes.ts) |
| `/api/candidate` | [`backend/src/routes/candidate.routes.ts`](backend/src/routes/candidate.routes.ts) |
| `/api/applications` | [`backend/src/routes/application.routes.ts`](backend/src/routes/application.routes.ts) |
| `/api/notifications` | [`backend/src/routes/notification.routes.ts`](backend/src/routes/notification.routes.ts) |
| `/api/whatsapp` | [`backend/src/routes/whatsapp.routes.ts`](backend/src/routes/whatsapp.routes.ts) |

`requireDatabase` middleware guards every mounted `/api/*` route group (returns HTTP 503 when Mongo is not connected):
- Response: `{ success: false, message: "Database is not connected. Please check MONGO_URI/MONGODB_URI and MongoDB network access." }`

### 2.2 Authentication middleware behavior
`protect` (in [`backend/src/middlewares/auth.middleware.ts`](backend/src/middlewares/auth.middleware.ts)):
- Requires header `Authorization: Bearer <accessToken>`
- If missing/invalid prefix:
  - `401` + `{ message: "No token provided" }`
- If JWT verification fails:
  - `401` + `{ message: "Invalid or expired token" }`
- On success, decoded JWT payload becomes `req.user` and must include `id` and `role`.

Role enforcement: `authorizeRoles(...roles)` (in [`backend/src/middlewares/role.middleware.ts`](backend/src/middlewares/role.middleware.ts)):
- If `req.user` missing or `req.user.role` not in allowed list:
  - `403` + `{ message: "Access denied" }`

### 2.3 Auth endpoints (`/api/auth/*`)
All endpoints are defined in [`backend/src/routes/auth.routes.ts`](backend/src/routes/auth.routes.ts).

#### `POST /api/auth/register`
Controller: [`backend/src/controllers/auth.controller.ts`](backend/src/controllers/auth.controller.ts)
- Validates request body with Zod (`registerSchema`):
  - `fullName`: letters and spaces, length 3..50
  - `email`: valid email, lowercased
  - `password`: length 8..20
  - `role`: enum `hr|employee|candidate` default `employee`
  - `phoneNumber`: exactly 10 digits
- Duplicate email:
  - `400` + `{ success:false, message:"User already exists with this email" }`
- On success:
  - `201` + `{ success:true, accessToken, user }`
- Zod validation errors:
  - `400` + `{ success:false, errors:[{ field, message }] }`

#### `POST /api/auth/login`
- Validates with Zod (`loginSchema`):
  - `email` required, email format, lowercased
  - `password` min 8 chars
- User not found OR missing password OR password mismatch:
  - `400` + `{ success:false, message:"Invalid email or password" }`
- On success:
  - sets refresh token cookie `refreshToken` (httpOnly, sameSite strict, secure false)
  - returns `200` + `{ success:true, accessToken: <generated>, user }`
- Legacy role normalization:
  - if stored `user.role === "admin"`, response `user.role` and issued token role are `"hr"`.

#### `GET /api/auth/me` (protected)
- Requires JWT
- If user not found:
  - `404` + `{ success:false, message:"User not found" }`
- Role normalization:
  - if role is `"admin"` it is returned as `"hr"`.
- On success:
  - `200` + `{ success:true, user: <user-without-password> }`

#### `PUT /api/auth/me` (protected)
- Prevents updating `password`, `role`, `resetPasswordToken`, `resetPasswordExpire`
- If user not found:
  - `404` + `{ success:false, message:"User not found" }`
- On success:
  - `200` + `{ success:true, user: <updated-without-password> }`

#### `POST /api/auth/refresh-token`
- Reads refresh token from cookie `refreshToken`
- If missing:
  - `401` + `{ message:"No refresh token" }`
- If invalid/expired:
  - `401` + `{ message:"Invalid or expired refresh token" }`
- On success:
  - `200` + `{ accessToken: <newAccessToken> }`

#### `POST /api/auth/forgot-password`
- Validates body email with Zod
- If user not found:
  - `404` + `{ success:false, message:"User not found" }`
- Always generates OTP (6 digits), stores hashed OTP + 5 min expiry, sets `isOtpVerified=false`
- Sends email using nodemailer (gmail) with `EMAIL_USER`/`EMAIL_PASS`
- On success:
  - `200` + `{ success:true, message:"OTP sent successfully" }`
- On unexpected error:
  - `500` + `{ success:false, message:"Something went wrong" }`

#### `POST /api/auth/verify-otp`
- Body: `{ email, otp }`
- If user not found:
  - `404` + `{ success:false, message:"User not found" }`
- If OTP fields missing:
  - `400` + `{ success:false, message:"OTP not found" }`
- If OTP expired:
  - `400` + `{ success:false, message:"OTP expired" }`
- If OTP invalid:
  - `400` + `{ success:false, message:"Invalid OTP" }`
- On success:
  - `200` + `{ success:true, message:"OTP verified successfully" }`

#### `PUT /api/auth/reset-password`
- Validates body with Zod (`resetPasswordSchema`):
  - `email`: valid
  - `password`: 8..20, must include uppercase, lowercase, and special char
- If user not found:
  - `404` + `{ success:false, message:"User not found" }`
- If OTP verification not complete:
  - `400` + `{ success:false, message:"OTP verification required" }`
- On success:
  - `200` + `{ success:true, message:"Password reset successfully" }`
- Zod errors:
  - `400` + `{ success:false, errors:[{ field, message }] }`

### 2.4 OAuth endpoints (`/api/oauth/*`)
Defined in [`backend/src/routes/oauth.routes.ts`](backend/src/routes/oauth.routes.ts).

#### `GET /api/oauth/google`
- Requires env:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- If not configured:
  - `503` + `{ success:false, message:"google OAuth is not configured on this server" }`

#### `GET /api/oauth/google/callback`
- On success, controller [`backend/src/controllers/oauth.controller.ts`](backend/src/controllers/oauth.controller.ts) redirects to:
  - `${FRONTEND_URL}/oauth/callback?accessToken=<access>&refreshToken=<refresh>`
- On failure:
  - redirects to `${FRONTEND_URL}/login?error=authentication_failed` or `oauth_failed`

#### `GET /api/oauth/microsoft` and `/api/oauth/microsoft/callback`
- Same pre-check behavior as Google via `requireOAuthConfig("microsoft")`.
- Note: Node code uses `passport.authenticate("microsoft")` but the Microsoft passport strategy may not be configured in `backend/src/config/passport.ts` (only Google is defined).

### 2.5 Jobs endpoints (`/api/jobs/*`)
Defined in [`backend/src/routes/job.routes.ts`](backend/src/routes/job.routes.ts) and implemented in [`backend/src/controllers/job.controller.ts`](backend/src/controllers/job.controller.ts).

Routes:
- `GET /api/jobs` (protected): `authorize` not applied beyond JWT
  - `200` + `{ success:true, jobs }` ordered by `createdAt: -1`, populated `createdBy`
  - `500` + `{ success:false, message:"Failed to fetch jobs", error }`
- `GET /api/jobs/:id` (protected)
  - if not found: `404` + `{ success:false, message:"Job not found" }`
  - `200` + `{ success:true, job }`
  - `500` + `{ success:false, message:"Failed to fetch job", error }`
- `POST /api/jobs` (protected, roles: `hr` or `employee`)
  - Payload normalization performed by `buildJobPayload`
  - Creates notification for candidates and HR user
  - `201` + `{ success:true, job }`
  - Validation errors thrown with message; `getStatusCode` maps invalid/please* to `400`
- `PUT /api/jobs/:id` (protected, roles: `hr` or `employee`)
  - `200` + `{ success:true, job }` or `404` + `{ success:false, message:"Job not found" }`
  - triggers "job_updated" notification
- `DELETE /api/jobs/:id` (protected, roles: `hr` or `employee`)
  - `200` + `{ success:true, message:"Job deleted successfully" }`
  - if not found: `404` + `{ success:false, message:"Job not found" }`
  - triggers "job_deleted" notification

### 2.6 Candidate resume + applications endpoints (`/api/candidate/*`)
Defined in [`backend/src/routes/candidate.routes.ts`](backend/src/routes/candidate.routes.ts) and implemented in [`backend/src/controllers/candidate.controller.ts`](backend/src/controllers/candidate.controller.ts).

Routes:
- `GET /api/candidate/applications` (protected, role: `hr`)
  - `200` + `{ success:true, candidates:[ ... ] }`
  - candidate rows contain fields like `id, name, email, avatar, role, appliedDate, matchScore, status, detectedSkills, detectedExperience, riskAnalysis, rankingResult, analysis`
  - `500` + `{ success:false, message:error.message }`
- `DELETE /api/candidate/applications/all` (protected, role: `hr`)
  - `200` + `{ success:true, message:"Deleted X candidate(s) and Y application(s)" }`
- `POST /api/candidate/applications` (protected, role: `candidate`, multipart upload `resume`)
  - delegates to `submitCandidateApplication`
  - `201` + `{ success:true, message, application, candidate, resume, analysis, extracted }`
- `POST /api/candidate/resume` (protected, role: `candidate`, multipart upload `resume`)
  - delegates to `uploadCandidateResume`
- `GET /api/candidate/resume` (protected, role: `candidate`)
  - `200` + `{ success:true, resume:{...}, extracted:{...} }`
- `DELETE /api/candidate/resume` (protected, role: `candidate`)
  - `200` + `{ success:true, message:"Resume deleted successfully" }` or `404` + `{ message:"No resume found" }`

AI integration details (must be preserved in FastAPI migration):
- Express Node controller calls Python AI endpoint `/analyze_application` (configurable via `FASTAPI_BASE_URL`, default `http://localhost:8000`).
- On errors/unreachability, controller falls back to local MERN heuristic analysis (`getMernFallbackAnalysis`).

Upload constraints (middleware: `uploadResume`):
- Allowed MIME types:
  - `application/pdf`
  - `application/msword`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- File size limit: 5 MB
- Stored on disk under: `uploads/resumes/` with naming `resume-<timestamp>-<random>.<ext>`

### 2.7 Applications endpoints (`/api/applications/*`)
Defined in [`backend/src/routes/application.routes.ts`](backend/src/routes/application.routes.ts) and implemented in [`backend/src/controllers/application.controller.ts`](backend/src/controllers/application.controller.ts).

Routes:
- `POST /api/applications/` (protected, role: `candidate`, multipart upload `resume`)
  - Validates required fields and duplicates:
    - missing required: `400` + `{ message:"Required fields missing" }`
    - duplicate: `409` + `{ message:"You have already applied for this job" }`
  - If resume missing: `400` + `{ message:"Resume is required to apply" }`
  - On success: `201` + `{ success:true, message:"Application submitted successfully", application }`
- `GET /api/applications/my` (protected, role: `candidate`)
  - `200` + `{ success:true, applications }`

### 2.8 Notifications endpoints (`/api/notifications/*`)
Defined in [`backend/src/routes/notification.routes.ts`](backend/src/routes/notification.routes.ts) and implemented in [`backend/src/controllers/notification.controller.ts`](backend/src/controllers/notification.controller.ts).

Routes:
- `GET /api/notifications` (protected)
  - `200` + `{ success:true, notifications:[{ id,title,message,type,read,createdAt }] }`
- `POST /api/notifications` (protected)
  - `201` + `{ success:true, message:"Notification created successfully" }`
  - body requires `title` and `message`; else `400`
- `PUT /api/notifications/read-all` (protected)
  - `200` + `{ success:true, message:"All notifications marked as read" }`
- `PUT /api/notifications/:id/read` (protected)
  - `200` + `{ success:true, message:"Notification marked as read" }` or `404` + `{ success:false, message:"Notification not found" }`
- `DELETE /api/notifications/:id` (protected)
  - `200` + `{ success:true, message:"Notification deleted successfully" }`

### 2.9 WhatsApp endpoint (`/api/whatsapp/send`)
Defined in [`backend/src/routes/whatsapp.routes.ts`](backend/src/routes/whatsapp.routes.ts) and implemented in [`backend/src/controllers/whatsapp.controller.ts`](backend/src/controllers/whatsapp.controller.ts).

Route:
- `POST /api/whatsapp/send`
- Body:
  - required: `phone`, `message`
  - optional: `twilioSid`, `twilioToken`, `twilioFrom` (defaults used)
- Missing phone/message:
  - `400` + `{ success:false, message:"Missing phone or message in request body" }`
- If Twilio keys present and not sandbox masked:
  - uses Twilio REST gateway and returns:
    - `200` + `{ success:true, message, gatewayId:data.sid, status:data.status, recipient }`
  - On gateway error:
    - forwards response status + `{ success:false, message:data.message||..., error:data }`
- If keys are absent or masked:
  - returns simulated sandbox success:
    - `200` + `{ success:true, message:"Sandbox simulator: Message mock dispatched successfully", gatewayId:<SMmock_...>, status:"queued", recipient, simulated:true }`

## 3) Python FastAPI AI/analytics Contract

These endpoints must remain available exactly as used by the Node controller (`FASTAPI_BASE_URL`) and the frontend.

### 3.1 AI service (root `main.py`)
Defined in `main.py`:
- `GET /health`
  - `{ success:true, service:"fastapi-ai", status:"ok" }`
- `POST /create_job_opening`
  - body fields: `job_title`, `required_skills[]`, `experience_required`, `department`, `location`, `job_description`
  - returns `{ success:true, message:"Job created successfully", job_id }`
- `POST /smart_job_match`
  - multipart fields expected: `file: UploadFile`
  - returns:
    - `{ candidate_name, candidate_skills, candidate_experience, recommended_jobs }`
- `POST /risk_analysis` (multipart)
  - `resume: UploadFile`, `jd: UploadFile`
  - returns `{ candidate_data, jd_data, risk_analysis }`
- `POST /candidate_ranking` (multipart)
  - `resume: UploadFile`, `jd: UploadFile`
  - returns `{ candidate_data, jd_data, ranking_result }`
- `POST /parse_resume`
  - `file: UploadFile`
  - returns:
    - message, parsed_resume_id, detected_skills, detected_experience, data: parsed_data
- `POST /analyze_application`
  - multipart:
    - `resume: UploadFile`
    - `job_title` (Form)
    - additional optional fields: `required_skills`, `experience_required`, `department`, `location`, `job_description`
  - returns (when success):
    - `{ success:true, message, parsed_resume_id, candidate_data, detected_skills, detected_experience, jd_data, recommended_jobs, risk_analysis, ranking_result }`

### 3.2 Productivity service (`productivity/main.py`)
Defined in `productivity/main.py`:
- `GET /` => `{ message:"Employee & Team Productivity API Running" }`
- `POST /activity/log`
  - body model `EmployeeActivity`
  - returns `{ message:"Employee activity recorded", employee_productivity_score }`
- `GET /employee/productivity`
  - returns list of employee productivity objects
- `GET /team/weekly_score`
  - returns `{ weekly_team_score: ... }`
- `GET /dashboard/analytics`
  - returns analytics payload (kpi_metrics, performance_index, attrition_data, attendance_data, workforce_data, team_heatmap_data)

### 3.3 Frontend dependencies
- Candidate AI flow relies on Node -> Python call to `/analyze_application` at `FASTAPI_BASE_URL` (default `http://localhost:8000`).
- Dashboard analytics page calls `http://127.0.0.1:8000/dashboard/analytics` directly:
  - [`frontend/src/features/dashboard/analytics/PredictiveAnalyticsPage.tsx`](frontend/src/features/dashboard/analytics/PredictiveAnalyticsPage.tsx)

