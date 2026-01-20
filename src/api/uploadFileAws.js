// src/api/uploadFileAws.js
import axios from "axios";
import { getToken } from "./getToken"; // token generator

const API_URL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=upload_files_aws";

export const uploadFileAws = async (file) => {
  try {
    const token = await getToken();
    const formData = new FormData();
    formData.append("uploadfile", file);

    const headers = {
      "Content-Type": "multipart/form-data",
      "x-api-key": "abc123456789",
      userid: "test",
      password: "test",
      projectid: "1",
      token,
    };

    const response = await axios.post(API_URL, formData, { headers });

    if (response.data?.statusCode === 200) {
      return response.data.data.file_path;
    } else {
      return null;
    }
  } catch (err) {
    console.error("❌ File Upload Error:", err.message);
    return null;
  }
};
