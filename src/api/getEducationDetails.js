// src/api/getEducationDetails.js
import axios from "axios";
import { getToken } from "./getToken"; // 👈 dynamic token function

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

// ✅ Named export
export const getEducationDetails = async (userid) => {
  try {
    const token = await getToken();
    console.log("🟢 Token for EducationDetails:", token);

    if (!token) {
      console.error("❌ Token not found");
      return [];
    }

    const response = await axios.post(
      `${baseURL}get_lookup_data`,
      {
        token: token,
        tablename: "educationdetails",
        conditions: [
          {
            userid: userid,
          },
        ],
      },
      { headers }
    );

    console.log("🟢 EducationDetails Response:", response.data);

    if (response.data.statusCode === 200) {
      return response.data.data; // 👈 array of education objects
    } else {
      console.error("❌ API Error:", response.data.message);
      return [];
    }
  } catch (error) {
    console.error("❌ Error in getEducationDetails:", error.response?.data || error.message);
    return [];
  }
};
