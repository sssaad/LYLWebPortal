import axios from "axios";
import { getToken } from "./getToken"; // make sure this function returns a token string

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const getAllTeachers = async () => {
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
        lists: "getallteacherlist",
      },
      { headers }
    );

    return response?.data?.getallteacherlist || [];
  } catch (error) {
    console.error("❌ Error fetching teacher list:", error.message);
    return [];
  }
};
