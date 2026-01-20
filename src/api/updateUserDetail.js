import axios from "axios";
import { getToken } from "./getToken";

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const updateUserDetail = async (teacher, updatedData) => {
  try {
    const token = await getToken();
    if (!token) return false;

    const payload = {
      token,
      tablename: "userdetail",
      conditions: [{ userid: parseInt(teacher.userid) }],
      updatedata: [updatedData],
    };

    const response = await axios.post(baseURL, payload, { headers });

    return response.data?.statusCode === 200;
  } catch (err) {
    console.error("❌ Error updating user detail:", err.message);
    return false;
  }
};
