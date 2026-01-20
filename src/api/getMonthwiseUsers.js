// src/api/getMonthwiseUsers.js
import axios from "axios";
import { getToken } from "./getToken"; // Token le raha hai dynamic tarike se

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

// ✅ Named export
export const getMonthwiseUsers = async () => {
  try {
    const token = await getToken();
    console.log("🟢 Token for Monthwise Users:", token);

    if (!token) {
      console.error("❌ Token not found");
      return null;
    }

    const response = await axios.post(
      `${baseURL}get_portal_lists`,
      {
        token: token,
        lists: "get_monthwise_users",
      },
      { headers }
    );

    console.log("🟢 Monthwise Users Response:", response.data);

    // ✅ Data return kar rahe hain
    return response?.data?.get_monthwise_users;
  } catch (error) {
    console.error("❌ Error in getMonthwiseUsers:", error.response?.data || error.message);
    return null;
  }
};
