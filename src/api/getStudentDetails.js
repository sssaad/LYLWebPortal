// src/api/getStudentDetails.js
import axios from "axios";
import { getToken } from "./getToken";

const baseURL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const getStudentDetails = async (userid) => {
  try {
    const token = await getToken();
    console.log("🟢 Token for StudentDetails:", token);

    if (!token) {
      console.error("❌ Token not found");
      return null;
    }

    const response = await axios.post(
      `${baseURL}get_student_details`,
      {
        token: token,
        userid: userid,
      },
      { headers }
    );

    console.log("🟢 StudentDetails Response:", response.data);

    if (response.data.statusCode === 200) {
      // 👇 same response return
      return response.data.data;
    } else {
      console.error("❌ API Error:", response.data.message);
      return null;
    }
  } catch (error) {
    console.error(
      "❌ Error in getStudentDetails:",
      error.response?.data || error.message
    );
    return null;
  }
};
