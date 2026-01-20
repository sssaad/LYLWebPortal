import axios from "axios";
import { getToken } from "./getToken";

const baseURL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

export const hardDeleteUser = async (id) => {
  try {
    const token = await getToken();
    if (!token) return { statusCode: 401, message: "Token missing" };

    const payload = {
      procedureName: "hardDeleteUser",
      parameters: [Number(id)], // ✅ teacher/user id
    };

    const res = await axios.post(`${baseURL}runStoredProcedure`, payload, {
      headers: { ...headers, token }, // ✅ token header me
    });

    return res.data; // backend jo bheje
  } catch (err) {
    return {
      statusCode: 500,
      message: err?.response?.data?.message || err.message || "Internal API error",
      data: err?.response?.data,
    };
  }
};
