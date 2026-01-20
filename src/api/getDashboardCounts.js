// src/api/getDashboardCounts.js
import axios from "axios";
import { getToken } from "./getToken"; // Importing token generator

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const getDashboardCounts = async () => {
  try {
    // ✅ Get token dynamically
    const token = await getToken();
    console.log("🟢 Token for Dashboard Counts:", token);

    if (!token) {
      console.error("❌ No token received");
      return null;
    }

    // ✅ Make the API call with token
    const response = await axios.post(
      `${baseURL}get_portal_lists`,
      {
        token: token, // ✅ Token passed from getToken
        lists: "get_dashboardcounts",
      },
      { headers }
    );

    console.log("🟢 Dashboard Data:", response.data);
    return response?.data?.get_dashboardcounts;
  } catch (error) {
    console.error("❌ Error in getDashboardCounts:", error.response?.data || error.message || error);
    return null;
  }
};
