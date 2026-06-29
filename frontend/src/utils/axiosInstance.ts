import axios from 'axios';
import API_BASE_URL from '../config/apiConfig';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Attach active token to every outgoing request
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('accessToken') ||
    localStorage.getItem('hr_accessToken') ||
    localStorage.getItem('admin_accessToken') ||
    localStorage.getItem('manager_accessToken') ||
    localStorage.getItem('candidate_accessToken');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: pass through errors to components without wiping auth storage
api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
