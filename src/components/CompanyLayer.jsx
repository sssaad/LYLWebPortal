import React, { useState, useEffect } from "react";
import { getTeacherProfile } from "../api/getTeacherProfile";
import { uploadFileAws } from "../api/uploadFileAws";
import { updateTeacherProfile } from "../api/updateTeacherProfile";
import Swal from "sweetalert2";

const CompanyLayer = () => {
  const [profile, setProfile] = useState({
    firstname: "",
    lastname: "",
    email: "",
    phonenumber: "",
    imagepath: ""
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // NEW

  const teacherId = localStorage.getItem("teacherid");

  useEffect(() => {
    const fetchProfile = async () => {
      const data = await getTeacherProfile(teacherId);
      if (data) setProfile(data);
      setInitialLoading(false); // loader off
    };
    fetchProfile();
  }, [teacherId]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setProfile((prev) => ({ ...prev, [id]: value }));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setLoading(true);
      const uploadedPath = await uploadFileAws(file);
      if (uploadedPath) {
        setSelectedImage(URL.createObjectURL(file));
        setProfile((prev) => ({ ...prev, imagepath: uploadedPath }));
        Swal.fire("Uploaded!", "Image uploaded successfully.", "success");
      } else {
        Swal.fire("Upload Failed", "Image could not be uploaded.", "error");
      }
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await updateTeacherProfile(teacherId, profile);
    setLoading(false);

    if (success) {
      Swal.fire({
        title: "Success",
        text: "Profile updated successfully.",
        icon: "success",
        showConfirmButton: true,
        timer: 2000,
        willClose: () => {
          window.location.reload();
        },
      });
    } else {
      Swal.fire("Error", "Something went wrong while updating.", "error");
    }
  };

  if (initialLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '6px solid #e0e0e0',
          borderTop: '6px solid #45B369',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="card h-100 p-0 radius-12 overflow-hidden">
      <div className="card-body p-40">
        <form onSubmit={handleSubmit}>
          <div className="row">

            {/* Image Preview */}
            <div className="col-12 mb-20">
              <div className="d-flex justify-content-center">
                <div style={{
                  width: "140px",
                  height: "140px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid #ccc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#f9f9f9"
                }}>
                  <img
                    src={
                      selectedImage ||
                      profile.imagepath ||
                      "https://via.placeholder.com/140?text=Preview"
                    }
                    alt="Preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              </div>
            </div>

            {/* First Name */}
            <div className="col-sm-6">
              <div className="mb-20">
                <label htmlFor="firstname" className="form-label fw-semibold text-primary-light text-sm mb-8">
                  First Name <span className="text-danger-600">*</span>
                </label>
                <input
                  type="text"
                  className="form-control radius-8"
                  id="firstname"
                  value={profile.firstname || ""}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Last Name */}
            <div className="col-sm-6">
              <div className="mb-20">
                <label htmlFor="lastname" className="form-label fw-semibold text-primary-light text-sm mb-8">
                  Last Name <span className="text-danger-600">*</span>
                </label>
                <input
                  type="text"
                  className="form-control radius-8"
                  id="lastname"
                  value={profile.lastname || ""}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Email */}
            <div className="col-sm-6">
              <div className="mb-20">
                <label htmlFor="email" className="form-label fw-semibold text-primary-light text-sm mb-8">
                  Email <span className="text-danger-600">*</span>
                </label>
                <input
                  type="email"
                  className="form-control radius-8"
                  id="email"
                  value={profile.email || ""}
                  readOnly
                />
              </div>
            </div>

            {/* Phone */}
            <div className="col-sm-6">
              <div className="mb-20">
                <label htmlFor="phonenumber" className="form-label fw-semibold text-primary-light text-sm mb-8">
                  Phone Number
                </label>
                <input
                  type="text"
                  className="form-control radius-8"
                  id="phonenumber"
                  value={profile.phonenumber || ""}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Image Upload */}
            <div className="col-sm-6">
              <div className="mb-20">
                <label htmlFor="image" className="form-label fw-semibold text-primary-light text-sm mb-8">
                  Upload Image
                </label>
                <input
                  type="file"
                  className="form-control radius-8"
                  id="image"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="d-flex align-items-center justify-content-center gap-3 mt-24">
              <button
                type="submit"
                className="btn btn-primary border border-primary-600 text-md px-24 py-12 radius-8"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Change"}
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyLayer;
