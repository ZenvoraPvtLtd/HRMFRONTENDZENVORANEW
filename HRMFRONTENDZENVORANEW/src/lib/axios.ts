import axios from "axios";
import { getApiBaseUrl } from "../config/apiConfig";

const api = axios.create({
    baseURL: getApiBaseUrl(),
    withCredentials: true,
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 403) {
            const data = error.response?.data;
            const rawMessage = String(data?.detail || data?.message || "").toLowerCase();
            if (rawMessage.includes("suspended")) {
                // Wipe all role-specific auth tokens so ProtectedRoute redirects immediately
                [
                    "accessToken", "refreshToken",
                    "userEmail", "userName", "userRole", "userPhone", "userLocation", "userJoinDate", "employeeId",
                    "admin_accessToken", "admin_refreshToken", "admin_userRole", "admin_userName", "admin_userEmail",
                    "hr_accessToken", "hr_refreshToken", "hr_userRole", "hr_userName", "hr_userEmail",
                    "candidate_accessToken", "candidate_refreshToken", "candidate_userRole", "candidate_userName", "candidate_userEmail",
                    "manager_accessToken", "manager_userRole", "manager_userName", "manager_userEmail",
                ].forEach((key) => localStorage.removeItem(key));

                // Persist the exact message across the redirect so Login can display it
                sessionStorage.setItem("suspensionMessage", "Your Account is Suspended by Admin.");
                window.location.replace("/login");
            }
        }
        return Promise.reject(error);
    },
);

export default api;
