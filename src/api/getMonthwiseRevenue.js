// src/api/getMonthwiseRevenue.js
import axios from "axios";
import { getToken } from "./getToken"; // Token dynamic hai yahan se mil raha hai

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

// ✅ Named export
export const getMonthwiseRevenue = async () => {
  try {
    const token = await getToken();
    console.log("🟢 Token for Monthwise Revenue:", token);

    if (!token) {
      console.error("❌ Token not found");
      return null;
    }

    const response = await axios.post(
      `${baseURL}get_portal_lists`,
      {
        token: token,
        lists: "get_monthwise_revenue",
      },
      { headers }
    );

    console.log("🟢 Monthwise Revenue Response:", response.data);

    return response?.data?.get_monthwise_revenue;
  } catch (error) {
    console.error("❌ Error in getMonthwiseRevenue:", error.response?.data || error.message);
    return null;
  }
};
