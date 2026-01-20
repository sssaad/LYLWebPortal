// src/components/ProtectedRoute.js
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const isLoggedIn = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
  return isLoggedIn ? children : <Navigate to="/" replace />;
};

export default ProtectedRoute;
