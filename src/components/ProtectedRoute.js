// src/components/ProtectedRoute.js
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";

const ProtectedRoute = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

  const headers = {
    projectid: "1",
    userid: "test",
    password: "test",
    "x-api-key": "abc123456789",
  };

  const clearSession = () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("teacherid");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_name");
    localStorage.removeItem("role_id");
    localStorage.removeItem("user_image");
    localStorage.removeItem("session_version");

    sessionStorage.removeItem("user_id");
    sessionStorage.removeItem("teacherid");
    sessionStorage.removeItem("user_email");
    sessionStorage.removeItem("user_name");
    sessionStorage.removeItem("role_id");
    sessionStorage.removeItem("user_image");
    sessionStorage.removeItem("session_version");
  };

  useEffect(() => {
    let mounted = true;

    const verifyPortalSession = async () => {
      const userId =
        localStorage.getItem("user_id") || sessionStorage.getItem("user_id");

      const sessionVersion =
        localStorage.getItem("session_version") ||
        sessionStorage.getItem("session_version");

      if (!userId || !sessionVersion) {
        clearSession();

        if (mounted) {
          setAllowed(false);
          setChecking(false);
        }

        return;
      }

      try {
        const formData = new FormData();
        formData.append("user_id", userId);
        formData.append("session_version", sessionVersion);

        const response = await axios.post(
          `${baseURL}portal_check_admin_session`,
          formData,
          {
            headers: {
              ...headers,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        const data = response.data;

        if (data.statusCode === 200 && data.message === "Successful") {
          if (mounted) {
            setAllowed(true);
          }
        } else {
          clearSession();

          if (mounted) {
            setAllowed(false);
          }
        }
      } catch (error) {
        console.error("Portal session check failed:", error);
        clearSession();

        if (mounted) {
          setAllowed(false);
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    };

    verifyPortalSession();

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return null;
  }

  return allowed ? children : <Navigate to="/" replace />;
};

export default ProtectedRoute;