import axios from "axios";
import { getToken } from "./getToken";
import { API_URL } from "../constant/api";

const baseURL = API_URL;

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const addCategory = async (categoryname) => {
  try {
    const token = await getToken();
    if (!token) {
      console.error("❌ No token found");
      return { success: false, message: "Token not found" };
    }

    const response = await axios.post(
      `${baseURL}add_dynamic_data`,
      {
        token,
        tablename: "subjectcategories",
        categoryname,
      },
      { headers }
    );

    if (response.data.statusCode === 200) {
      return {
        success: true,
        message: response.data.message,
        id: response.data.data?.id,
      };
    } else {
      return {
        success: false,
        message: response.data.message || "Unknown error",
      };
    }
  } catch (error) {
    console.error("❌ Error adding category:", error.message);
    return {
      success: false,
      message: "API call failed",
    };
  }
};
