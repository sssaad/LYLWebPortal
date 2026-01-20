// src/api/getPendingBookings.js
import axios from "axios";
import { getToken } from "./getToken";

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const getPendingBookings = async () => {
  try {
    const token = await getToken();
    console.log("🟢 Token for Pending Bookings:", token);

    if (!token) {
      console.error("❌ Token not found");
      return null;
    }

    const response = await axios.post(
      `${baseURL}get_portal_lists`,
      {
        token: token,
        lists: "getall_pending_bookings",
      },
      { headers }
    );

    console.log("🟢 Pending Bookings Response:", response.data);

    return response?.data?.getall_pending_bookings;
  } catch (error) {
    console.error("❌ Error in getPendingBookings:", error.response?.data || error.message);
    return null;
  }
};
