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

/**
 * Soft delete a student by ID (sets active = 2)
 * @param {number} studentId - ID of the student to soft delete
 * @returns {object} API response
 */
export const softDeleteStudent = async (studentId) => {
  try {
    const token = await getToken();
    if (!token) {
      console.error("❌ Token not found");
      return { statusCode: 401, message: "Token missing" };
    }

    const payload = {
      token,
      tablename: "users",
      conditions: [{ id: studentId }],
      updatedata: [{ active: 2 }], // soft delete
    };

    const response = await axios.post(`${baseURL}update_dynamic_data`, payload, {
      headers,
    });

    if (response.data.statusCode === 200) {
      return { statusCode: 200, message: "Student soft deleted successfully" };
    } else {
      return {
        statusCode: response.data.statusCode,
        message: response.data.message || "Soft delete failed",
      };
    }
  } catch (error) {
    console.error("❌ Soft Delete Error:", error.message);
    return { statusCode: 500, message: "Internal API error" };
  }
};
