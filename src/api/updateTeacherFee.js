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

export const updateTeacherFee = async (teacherid, fees) => {
  try {
    const token = await getToken();
    if (!token) {
      console.error("❌ Token not found");
      return { statusCode: 401, message: "Token missing" };
    }

    const payload = {
      token,
      tablename: "teacher_fees",
      conditions: [{ teacherid }],
      updatedata: [{ fees: fees.toString() }],
    };

    const response = await axios.post(`${baseURL}update_dynamic_data`, payload, {
      headers,
    });

    if (response.data.statusCode === 200) {
      return { statusCode: 200, message: "Fee updated successfully" };
    } else {
      return {
        statusCode: response.data.statusCode,
        message: response.data.message || "Update failed",
      };
    }
  } catch (error) {
    console.error("❌ Update Fee Error:", error.message);
    return { statusCode: 500, message: "Internal API error" };
  }
};
