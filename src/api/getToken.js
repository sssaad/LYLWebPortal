// src/api/getToken.js
import axios from "axios";

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const getToken = async () => {
  try {
    const response = await axios.get(`${baseURL}get_token`, {
      headers,
    });

    console.log("🟢 getToken Response:", response.data);

    // Fix: Capital T in "Token"
    const token = response?.data?.Token;

    if (token) {
      return token;
    } else {
      console.error("❌ Token not found:", response.data);
      return null;
    }
  } catch (error) {
    console.error("❌ Error getting token:", error);
    return null;
  }
};
