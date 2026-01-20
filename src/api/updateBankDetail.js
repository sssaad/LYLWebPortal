import axios from "axios";
import { getToken } from "./getToken";

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const updateBankDetail = async (teacherId, bankData) => {
  try {
    const token = await getToken();
    if (!token) return false;

    const payload = {
      token,
      tablename: "teacherpaymentinformation",
      conditions: [{ userid: parseInt(teacherId) }],
      updatedata: [bankData],
    };

    const response = await axios.post(baseURL, payload, { headers });

    if (response.data?.statusCode === 200) {
      return {
        success: true,
        data: response.data.data,
      };
    } else {
      return { success: false, message: response.data?.message || "Failed" };
    }
  } catch (err) {
    console.error("❌ Error updating bank detail:", err.message);
    return { success: false, message: err.message };
  }
};
