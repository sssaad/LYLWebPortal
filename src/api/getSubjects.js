import axios from "axios";
import { getToken } from "./getToken"; // ✅ token import

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_lookup_data";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const getSubjects = async () => {
  try {
    const token = await getToken(); // ✅ token generate

    if (!token) {
      console.error("❌ Token not found");
      return [];
    }

    const response = await axios.post(
      baseURL,
      {
        token: token,
        tablename: "subjects",
      },
      { headers }
    );

    if (response?.data?.statusCode === 200) {
      return response.data.data;
    } else {
      console.error("❌ Unexpected response:", response.data);
      return [];
    }
  } catch (error) {
    console.error("❌ Error fetching subjects:", error);
    return [];
  }
};
