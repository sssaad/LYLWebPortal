import axios from "axios";
import { getToken } from "./getToken";

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_portal_lists";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const getAllBookings = async () => {
  try {
    const token = await getToken();
    if (!token) {
      console.error("❌ No token found");
      return [];
    }

    const response = await axios.post(
      baseURL,
      {
        token: token,
        lists: "getallbookings",
      },
      { headers }
    );

    return response?.data?.getallbookings || [];
  } catch (error) {
    console.error("❌ Error fetching bookings:", error.message);
    return [];
  }
};
