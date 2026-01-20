// src/api/getTeacherProfile.js
import axios from "axios";
import { getToken } from "./getToken"; // ensure this exists and works

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=teacher_profile";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const getTeacherProfile = async (teacherId) => {
  try {
    const token = await getToken();
    if (!token) return null;

    const response = await axios.post(
      baseURL,
      {
        token: token,
        teacherid: teacherId,
      },
      { headers }
    );

    if (response.data?.statusCode === 200) {
      return response.data.data.profile[0]; // directly returning the profile object
    } else {
      return null;
    }
  } catch (error) {
    console.error("❌ Error fetching teacher profile:", error.message);
    return null;
  }
};
