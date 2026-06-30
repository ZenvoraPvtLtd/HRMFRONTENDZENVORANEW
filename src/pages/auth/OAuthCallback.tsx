import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import api from "../../lib/axios";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import AuthLayout from "./AuthLayout";
import { getDashboardPath, getRoleFromToken, storeAuthUser } from "../../utils/auth";


const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Check if we have tokens in URL params (for direct redirect)
        const accessToken = searchParams.get("accessToken");
        const refreshToken = searchParams.get("refreshToken");

        // if (accessToken) {
        //   // Store tokens
        //   localStorage.setItem("accessToken", accessToken);
        //   localStorage.setItem("refreshToken", refreshToken);

        if (accessToken) {
          localStorage.setItem("accessToken", accessToken);
          if (refreshToken) {
            localStorage.setItem("refreshToken", refreshToken);
          }


          const role = getRoleFromToken(accessToken);

          if (role === "candidate") {
            // localStorage.setItem("candidate_accessToken", accessToken);
            // localStorage.setItem("candidate_refreshToken", refreshToken);
            localStorage.setItem("candidate_accessToken", accessToken);
            
            if (refreshToken) {
              localStorage.setItem("candidate_refreshToken", refreshToken);
            }

            if (role) localStorage.setItem("candidate_userRole", role);
          } else {
            // Store tokens based on role
          if (role === "admin") {
            // Admin specific keys
            localStorage.setItem("admin_accessToken", accessToken);
            if (refreshToken) {
              localStorage.setItem("admin_refreshToken", refreshToken);
            }
            if (role) localStorage.setItem("admin_userRole", role);
          } else {
            // Existing HR handling
            localStorage.setItem("hr_accessToken", accessToken);
            
            if (refreshToken) {
              localStorage.setItem("hr_refreshToken", refreshToken);
            }

            if (role) localStorage.setItem("hr_userRole", role);
          }
          }

          if (role) {
            localStorage.setItem("userRole", role);
          }

          // Fetch user details to store userName and userEmail
          try {
            // const userResponse = await axios.get("/api/auth/me", {
            //   headers: { Authorization: `Bearer ${accessToken}` }
            // });
            const userResponse = await api.get("/api/auth/me", {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userResponse.data.success) {
              const user = userResponse.data.user;
              if (role === "candidate") {
                if (user.name) localStorage.setItem("candidate_userName", user.name);
                if (user.email) localStorage.setItem("candidate_userEmail", user.email);
              } else {
                if (user.name) localStorage.setItem("hr_userName", user.name);
                if (user.email) localStorage.setItem("hr_userEmail", user.email);
              }
              storeAuthUser(user);
            }
          } catch (e) {
            console.error("Failed to fetch user profile in OAuth callback", e);
          }

          navigate(getDashboardPath(role), { replace: true });
          return;
        }

        // If no tokens in URL, check if user is authenticated via API
        // const response = await axios.get("/api/auth/me");
        const response = await api.get("/api/auth/me");
        if (response.data.success) {
          const user = response.data.user;
          const role = user?.role;
          if (role === "candidate") {
            if (user.name) localStorage.setItem("candidate_userName", user.name);
            if (user.email) localStorage.setItem("candidate_userEmail", user.email);
            localStorage.setItem("candidate_userRole", role);
          } else if (role) {
            if (user.name) localStorage.setItem("hr_userName", user.name);
            if (user.email) localStorage.setItem("hr_userEmail", user.email);
            localStorage.setItem("hr_userRole", role);
          }
          storeAuthUser(user);
          navigate(getDashboardPath(user?.role), { replace: true });
        } else {
          throw new Error("Authentication failed");
        }
      } catch (error) {
        console.error("OAuth callback error:", error);
        const message = axios.isAxiosError<{ message?: string }>(error)
          ? error.response?.data?.message
          : null;
        setError(message || "Authentication failed. Please try again.");
        setLoading(false);

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, [navigate, searchParams]);

  if (loading) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="mb-8">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 size={32} className="text-purple-500 animate-spin" />
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${theme.heading}`}>
              Completing Sign In...
            </h2>
            <p className={theme.subtext}>
              Please wait while we finish setting up your account
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="mb-8">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={32} className="text-red-500" />
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${theme.heading}`}>
              Authentication Failed
            </h2>
            <p className={theme.subtext}>
              {error}
            </p>
            <p className={`text-sm mt-4 ${theme.subtext}`}>
              Redirecting to login page...
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return null;
};

export default OAuthCallback;
