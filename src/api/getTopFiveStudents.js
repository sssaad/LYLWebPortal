import axios from "axios";
import { getToken } from "./getToken";

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const getTopFiveStudents = async () => {
  try {
    const token = await getToken();
    if (!token) {
      console.error("❌ No token found");
      return [];
    }

    const response = await axios.post(
      `${baseURL}get_portal_lists`,
      {
        token: token,
        lists: "get_topfive_students",
      },
      { headers }
    );

    return response?.data?.get_topfive_students || [];
  } catch (error) {
    console.error("❌ Error fetching top students:", error.message);
    return [];
  }
};
