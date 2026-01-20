import axios from "axios";
import { getToken } from "./getToken"; // ✅ using centralized token logic

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=delete_dynamic";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const deleteSubject = async (subjectname) => {
  try {
    const token = await getToken(); // ✅ centralized token
    if (!token) {
      console.error("❌ Token not found via getToken()");
      return { success: false, message: "Token missing" };
    }

    const payload = {
      token: token,
      tablename: "subjects",
      conditions: [
        { subjectname: subjectname }
      ]
    };

    const response = await axios.post(baseURL, payload, { headers });

    if (response.data?.statusCode === 200) {
      return { success: true, message: "Deleted successfully", data: response.data?.data };
    } else {
      return { success: false, message: response.data?.message || "Failed to delete" };
    }

  } catch (error) {
    console.error("❌ Delete Subject API Error:", error.message);
    return { success: false, message: "API Error" };
  }
};
