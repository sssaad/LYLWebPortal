import axios from "axios";
import { getToken } from "./getToken";

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json"
};

export const getAllTeacherProfiles = async () => {
  try {
    const token = await getToken();
    if (!token) {
      console.error("❌ Token not found");
      return [];
    }

    const response = await axios.post(
      `${baseURL}teacher_profile_all_dashboard`,
      { token },
      { headers }
    );

    if (response.data.statusCode === 200) {
      return response.data.data;
    } else {
      console.error("❌ API error:", response.data.message);
      return [];
    }
  } catch (error) {
    console.error("❌ Fetch error:", error.message);
    return [];
  }
};
