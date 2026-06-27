import axios from 'axios';
import type { AxiosError } from 'axios';
import API_BASE_URL from '../config/apiConfig';
import { getAuthToken } from './auth';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: AxiosError | unknown) => void }> = [];

const processQueue = (error: AxiosError | unknown, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 — try refresh, then retry original request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 403) {
      const msg = error.response?.data?.detail || error.response?.data?.message || "";
      if (msg === "Your Account is Suspended by Admin." || msg === "Account Deleted by Admin.") {
        localStorage.clear();
        sessionStorage.clear();
        alert(msg);
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(
        '/api/auth/refresh-token',
        {},
        {
          baseURL: API_BASE_URL,
          withCredentials: true,
        }
      );
      const newToken = data.accessToken;
      
      const path = window.location.pathname;
      const isCandidatePath = path.startsWith('/candidatedashboard');
      const isAdminPath = path.startsWith('/admin');
      
      if (isCandidatePath) {
        localStorage.setItem('candidate_accessToken', newToken);
      } else if (isAdminPath) {
        localStorage.setItem('admin_accessToken', newToken);
      } else {
        localStorage.setItem('hr_accessToken', newToken);
      }
      localStorage.setItem('accessToken', newToken);
      
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      
      const path = window.location.pathname;
      const isCandidatePath = path.startsWith('/candidatedashboard');
      const isAdminPath = path.startsWith('/admin');
      
      if (isCandidatePath) {
        localStorage.removeItem('candidate_accessToken');
        localStorage.removeItem('candidate_userName');
        localStorage.removeItem('candidate_userEmail');
        localStorage.removeItem('candidate_userRole');
      } else if (isAdminPath) {
        localStorage.removeItem('admin_accessToken');
        localStorage.removeItem('admin_userName');
        localStorage.removeItem('admin_userEmail');
        localStorage.removeItem('admin_userRole');
      } else {
        localStorage.removeItem('hr_accessToken');
        localStorage.removeItem('hr_userName');
        localStorage.removeItem('hr_userEmail');
        localStorage.removeItem('hr_userRole');
      }
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userName');
      localStorage.removeItem('userEmail');
      
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
