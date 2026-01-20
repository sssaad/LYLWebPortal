import axios from "axios";
import { getToken } from "./getToken"; // make sure this exists

const baseURL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_lookup_data";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const getConfirmEmail = async () => {
  try {
    const token = await getToken();
    if (!token) return null;

    const response = await axios.post(
      baseURL,
      {
        token: token,
        tablename: "emailtemplates", // fixed to emailtemplates
      },
      { headers }
    );

    if (response.data?.statusCode === 200) {
      return response.data.data; // return full list of templates
    } else {
      return null;
    }
  } catch (error) {
    console.error("❌ Error fetching confirm email templates:", error.message);
    return null;
  }
};
