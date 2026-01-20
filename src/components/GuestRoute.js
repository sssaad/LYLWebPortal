// src/components/GuestRoute.js
import { Navigate } from "react-router-dom";

const GuestRoute = ({ children }) => {
  const isLoggedIn = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
  return !isLoggedIn ? children : <Navigate to="/index" replace />;
};

export default GuestRoute;
