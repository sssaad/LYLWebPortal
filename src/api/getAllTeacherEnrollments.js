// src/api/getAllTeacherEnrollments.js
import axios from "axios";
import { getToken } from "./getToken"; // make sure this returns the correct token

const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=getallenrollmentsteachers";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

export const getAllTeacherEnrollments = async () => {
  try {
    const token = await getToken();
    if (!token) return null;

    const response = await axios.post(
      baseURL,
      { token },
      { headers }
    );

    if (response.data?.statusCode === 200) {
      return response.data.data; // returns the full array of teacher enrollments
    } else {
      return null;
    }
  } catch (error) {
    console.error("❌ Error fetching teacher enrollments:", error.message);
    return null;
  }
};
