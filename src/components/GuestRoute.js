// src/components/GuestRoute.js
import { Navigate } from "react-router-dom";

const GuestRoute = ({ children }) => {
  const userId =
    localStorage.getItem("user_id") || sessionStorage.getItem("user_id");

  const sessionVersion =
    localStorage.getItem("session_version") ||
    sessionStorage.getItem("session_version");

  return userId && sessionVersion ? <Navigate to="/index" replace /> : children;
};

export default GuestRoute;