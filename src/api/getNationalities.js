// src/api/getNationalities.js
import axios from "axios";
import { getToken } from "./getToken"; // Token dynamic hai yahan se mil raha hai

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

// ✅ Named export
export const getNationalities = async () => {
  try {
    const token = await getToken();
    console.log("🟢 Token for Nationalities:", token);

    if (!token) {
      console.error("❌ Token not found");
      return [];
    }

    const response = await axios.post(
      `${baseURL}get_lookup_data`,
      {
        token: token,
        tablename: "nationalities",
      },
      { headers }
    );

    console.log("🟢 Nationalities Response:", response.data);

    if (response.data.statusCode === 200) {
      return response.data.data; // 👈 array of { id, nationality }
    } else {
      console.error("❌ API Error:", response.data.message);
      return [];
    }
  } catch (error) {
    console.error("❌ Error in getNationalities:", error.response?.data || error.message);
    return [];
  }
};
