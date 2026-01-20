import axios from "axios";
import { getToken } from "./getToken";

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

export const updateTeacherStatus = async (teacherid, is_active) => {
  try {
    const token = await getToken();
    if (!token) {
      console.error("❌ Token not found");
      return { statusCode: 401, message: "Token missing" };
    }

    const payload = {
      token,
      tablename: "teachingprofile",
      conditions: [{ teacherid }],
      updatedata: [{ is_active }],
    };

    const response = await axios.post(`${baseURL}update_dynamic_data`, payload, {
      headers,
    });

    if (response.data.statusCode === 200) {
      return { statusCode: 200, message: "Status updated successfully" };
    } else {
      return {
        statusCode: response.data.statusCode,
        message: response.data.message || "Status update failed",
      };
    }
  } catch (error) {
    console.error("❌ Status Update Error:", error.message);
    return { statusCode: 500, message: "Internal API error" };
  }
};
