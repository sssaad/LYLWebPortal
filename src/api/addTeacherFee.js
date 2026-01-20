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

export const addTeacherFee = async ({ teacherid, fees }) => {
  try {
    const token = await getToken();
    if (!token) {
      console.error("❌ Token not found");
      return { success: false, message: "Token not found" };
    }

    const body = {
      token,
      tablename: "teacher_fees",
      teacherid,
      fees: fees.toString(),
    };

    const response = await axios.post(`${baseURL}add_dynamic_data`, body, {
      headers,
    });

    if (response.data.statusCode === 200) {
      return {
        success: true,
        message: "Fee added",
        id: response.data.data?.id,
      };
    } else {
      return {
        success: false,
        message: response.data.message || "Failed to add fee",
      };
    }
  } catch (err) {
    console.error("❌ Error adding fee:", err.message);
    return {
      success: false,
      message: "API error occurred",
    };
  }
};
