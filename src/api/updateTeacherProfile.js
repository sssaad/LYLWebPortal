import axios from "axios";
import { getToken } from "./getToken";

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const updateTeacherProfile = async (teacherId, updatedData) => {
  try {
    const token = await getToken();
    if (!token) return null;

    const payload = {
      token: token,
      tablename: "userdetail",
      conditions: [{ userid: parseInt(teacherId) }],
      updatedata: [updatedData],
    };

    const response = await axios.post(baseURL, payload, { headers });

    if (response.data?.statusCode === 200) {
      return true;
    } else {
      console.error("Update failed:", response.data.message);
      return false;
    }
  } catch (err) {
    console.error("❌ Error updating teacher profile:", err.message);
    return false;
  }
};
