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

export const getTimezonesLookup = async () => {
  try {
    const token = await getToken();
    if (!token) return { statusCode: 401, message: "Token missing" };

    const payload = { tablename: "timezones" };

    const res = await axios.post(`${baseURL}get_lookup_data`, payload, {
      headers: { ...headers, token },
    });

    return res.data; // {statusCode, message, data:[{id, timezone}, ...]}
  } catch (err) {
    return {
      statusCode: 500,
      message: err?.response?.data?.message || err.message || "Internal API error",
      data: err?.response?.data,
    };
  }
};
