import React, { useEffect, useState } from "react";
import axios from "axios";
import { Icon } from "@iconify/react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import Swal from "sweetalert2";
import { getToken } from "../api/getToken";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

const ADD_USER_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=add_user";

const getInitialForm = () => ({
  fullname: "",
  noEmail: false,
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
  phone: "",
  parentemail: "",
});

const RegisterStudentModal = ({ show, onClose, onSave }) => {
  const [form, setForm] = useState(getInitialForm());
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!show) {
      document.body.style.overflow = "";
      return;
    }

    setForm(getInitialForm());
    setShowPassword(false);
    setShowConfirmPassword(false);
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [show]);

  const handleModalClose = () => {
    if (saving) return;
    onClose?.();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleToggleNoEmail = () => {
    setForm((prev) => {
      const nextNoEmail = !prev.noEmail;

      return {
        ...prev,
        noEmail: nextNoEmail,
        email: nextNoEmail ? "" : prev.email,
        username: nextNoEmail ? prev.username : "",
      };
    });
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateForm = () => {
    if (!form.fullname.trim()) return "Please enter your name";

    if (form.noEmail) {
      if (!form.username.trim()) return "Please enter username";
    } else {
      if (!form.email.trim()) return "Please enter email";
      if (!validateEmail(form.email.trim())) return "Please enter a valid email";
    }

    if (!form.password.trim()) return "Please enter password";
    if (!form.confirmPassword.trim()) return "Please enter confirm password";

    if (form.password !== form.confirmPassword) {
      return "Password and confirm password do not match";
    }

    if (!form.phone.trim()) return "Please enter phone number";
    if (!form.parentemail.trim()) return "Please enter parent email";

    if (!validateEmail(form.parentemail.trim())) {
      return "Please enter a valid parent email";
    }

    return null;
  };

  const buildBody = (token) => {
    const cleanedPhone = String(form.phone || "").replace(/\D/g, "");

    return {
      token,
      roleid: 3,
      fullname: form.fullname.trim(),
      email: form.noEmail ? "" : form.email.trim(),
      username: form.noEmail ? form.username.trim() : "",
      password: form.password,
      confirmPassword: form.confirmPassword,
      phonenumber: cleanedPhone,
      parentemail: form.parentemail.trim(),
      isEmailVerified: 1,
      loginWithUsername: form.noEmail,
    };
  };

  const isSuccessResponse = (data) => {
    return (
      data?.statusCode === 200 ||
      data?.status === 200 ||
      data?.success === true ||
      String(data?.message || "").toLowerCase().includes("success") ||
      String(data?.msg || "").toLowerCase().includes("success")
    );
  };

  const handleSave = async () => {
    const validationMessage = validateForm();

    if (validationMessage) {
      await Swal.fire({
        icon: "warning",
        title: "Validation",
        text: validationMessage,
      });
      return;
    }

    const confirmResult = await Swal.fire({
      icon: "question",
      title: "Are you sure?",
      text: "Do you want to register this student?",
      showCancelButton: true,
      confirmButtonText: "Yes, Register",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!confirmResult.isConfirmed) return;

    try {
      setSaving(true);

      Swal.fire({
        title: "Registering...",
        text: "Please wait while student is being registered.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const token = await getToken();
      console.log("getToken register response =>", token);

      if (!token) throw new Error("Token not found");

      const body = buildBody(token);
      console.log("Register request body =>", body);

      const res = await axios.post(ADD_USER_URL, body, { headers });
      console.log("Register API response =>", res?.data);

      if (isSuccessResponse(res?.data)) {
        await Swal.fire({
          icon: "success",
          title:
            res?.data?.message ||
            res?.data?.msg ||
            "Student registered successfully!",
          timer: 1800,
          showConfirmButton: false,
        });

        if (onSave) {
          await onSave(res?.data);
        } else {
          onClose?.();
        }
      } else {
        await Swal.fire({
          icon: "error",
          title: "Registration Failed",
          text:
            res?.data?.message ||
            res?.data?.msg ||
            "Unknown error occurred while registering student",
        });
      }
    } catch (e) {
      console.error("add_user error =>", e);
      console.error("add_user error response =>", e?.response?.data);

      await Swal.fire({
        icon: "error",
        title: "Error",
        text:
          e?.response?.data?.message ||
          e?.response?.data?.msg ||
          (typeof e?.response?.data === "string" ? e.response.data : "") ||
          e?.message ||
          "Error registering student",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <>
      <style>{`
        .rsm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(8, 15, 30, 0.78);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .rsm-modal {
          position: relative;
          z-index: 10000;
          width: 100%;
          max-width: 560px;
          background: #18253b;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.45);
          overflow: visible;
        }

        .rsm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: #162238;
          border-radius: 14px 14px 0 0;
        }

        .rsm-title {
          margin: 0;
          color: #fff;
          font-size: 18px;
          font-weight: 700;
        }

        .rsm-close {
          border: none;
          background: transparent;
          color: #9eb0ca;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
        }

        .rsm-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .rsm-body {
          padding: 18px;
          background: #18253b;
          border-radius: 0 0 14px 14px;
        }

        .rsm-field {
          margin-bottom: 14px;
        }

        .rsm-input {
          width: 100%;
          height: 50px;
          background: #22314d;
          border: 1px solid #364866;
          border-radius: 8px;
          color: #fff;
          padding: 0 16px;
          outline: none;
          font-size: 16px;
          transition: all 0.2s ease;
        }

        .rsm-input::placeholder {
          color: #aeb8ca;
        }

        .rsm-input:focus {
          border-color: #4b89ff;
          box-shadow: 0 0 0 3px rgba(75, 137, 255, 0.16);
        }

        .rsm-toggle-card {
          min-height: 62px;
          border: 1px solid #364866;
          border-radius: 8px;
          background: #22314d;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
        }

        .rsm-switch {
          position: relative;
          width: 44px;
          height: 24px;
          flex-shrink: 0;
        }

        .rsm-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .rsm-slider {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: #6b7280;
          transition: 0.25s ease;
          cursor: pointer;
        }

        .rsm-slider::before {
          content: "";
          position: absolute;
          width: 20px;
          height: 20px;
          left: 2px;
          top: 2px;
          border-radius: 50%;
          background: #ffffff;
          transition: 0.25s ease;
        }

        .rsm-switch input:checked + .rsm-slider {
          background: #2f9bff;
        }

        .rsm-switch input:checked + .rsm-slider::before {
          transform: translateX(20px);
        }

        .rsm-toggle-title {
          margin: 0 0 4px;
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
        }

        .rsm-toggle-subtitle {
          margin: 0;
          font-size: 13px;
          color: #aab5c8;
        }

        .rsm-password-wrap {
          position: relative;
        }

        .rsm-password-input {
          padding-right: 48px;
        }

        .rsm-eye-btn {
          position: absolute;
          top: 50%;
          right: 14px;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          color: #9eabc2;
          cursor: pointer;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .rsm-footer {
          margin-top: 18px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .rsm-submit {
          min-width: 180px;
          height: 46px;
          border: none;
          border-radius: 8px;
          background: #7ac70c;
          color: #ffffff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s ease;
          padding: 0 22px;
        }

        .rsm-submit:hover {
          filter: brightness(1.05);
        }

        .rsm-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .rsm-phone {
          width: 100% !important;
          position: relative !important;
        }

        .rsm-phone .form-control {
          width: 100% !important;
          height: 50px !important;
          background: #22314d !important;
          border: 1px solid #364866 !important;
          border-radius: 8px !important;
          color: #fff !important;
          padding-left: 70px !important;
          padding-right: 16px !important;
          font-size: 16px !important;
          box-shadow: none !important;
        }

        .rsm-phone .form-control::placeholder {
          color: #aeb8ca !important;
        }

        .rsm-phone .form-control:focus {
          border-color: #4b89ff !important;
          box-shadow: 0 0 0 3px rgba(75, 137, 255, 0.16) !important;
        }

        .rsm-phone .flag-dropdown {
          background: #22314d !important;
          border: 1px solid #364866 !important;
          border-radius: 8px 0 0 8px !important;
          width: 58px !important;
        }

        .rsm-phone .selected-flag {
          width: 58px !important;
          height: 48px !important;
          padding: 0 0 0 14px !important;
          background: #22314d !important;
          border-radius: 8px 0 0 8px !important;
        }

        .rsm-phone .selected-flag:hover,
        .rsm-phone .selected-flag:focus,
        .rsm-phone .flag-dropdown.open,
        .rsm-phone .flag-dropdown.open .selected-flag {
          background: #22314d !important;
        }

        .rsm-phone .selected-flag .arrow {
          left: 38px !important;
          border-top: 4px solid #b7c2d6 !important;
        }

        .rsm-phone .country-list {
          width: 320px !important;
          max-width: 320px !important;
          background: #22314d !important;
          color: #fff !important;
          border: 1px solid #364866 !important;
          border-radius: 10px !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.35) !important;
          padding: 8px 0 !important;
          left: 0 !important;
          top: auto !important;
          bottom: calc(100% + 8px) !important;
          z-index: 10050 !important;
        }

        .rsm-phone .country-list .search {
          position: sticky !important;
          top: 0 !important;
          background: #22314d !important;
          padding: 10px !important;
          z-index: 2 !important;
        }

        .rsm-phone .country-list .search-box {
          width: 100% !important;
          margin: 0 !important;
          height: 38px !important;
          background: #18243b !important;
          border: 1px solid #364866 !important;
          border-radius: 8px !important;
          color: #fff !important;
          padding: 0 12px !important;
        }

        .rsm-phone .country-list .search-box::placeholder {
          color: #9fb0c7 !important;
        }

        .rsm-phone .country-list .search-emoji {
          display: none !important;
        }

        .rsm-phone .country-list .country {
          color: #fff !important;
          background: #22314d !important;
          padding: 10px 12px !important;
        }

        .rsm-phone .country-list .country:hover,
        .rsm-phone .country-list .country.highlight {
          background: #2a3b5d !important;
        }

        .rsm-phone .country-list .country .dial-code {
          color: #b8c4d8 !important;
        }

        .swal2-container {
          z-index: 20000 !important;
        }

        .swal2-popup {
          border-radius: 14px !important;
        }

        @media (max-width: 576px) {
          .rsm-overlay {
            padding: 12px;
          }

          .rsm-modal {
            max-width: 100%;
          }

          .rsm-phone .country-list {
            width: 280px !important;
            max-width: 280px !important;
          }

          .rsm-submit {
            width: 100%;
          }
        }
      `}</style>

      <div className="rsm-overlay">
        <div className="rsm-modal">
          <div className="rsm-header">
            <h5 className="rsm-title">Register Student</h5>
            <button
              type="button"
              className="rsm-close"
              onClick={handleModalClose}
              disabled={saving}
            >
              <Icon icon="mdi:close" width="22" />
            </button>
          </div>

          <div className="rsm-body">
            <div className="rsm-field">
              <input
                type="text"
                name="fullname"
                className="rsm-input"
                placeholder="Student Name"
                value={form.fullname}
                onChange={handleChange}
              />
            </div>

            <div className="rsm-field">
              <div className="rsm-toggle-card">
                <label className="rsm-switch">
                  <input
                    type="checkbox"
                    checked={form.noEmail}
                    onChange={handleToggleNoEmail}
                  />
                  <span className="rsm-slider" />
                </label>

                <div>
                  <p className="rsm-toggle-title">I don't have an email</p>
                  <p className="rsm-toggle-subtitle">
                    {form.noEmail
                      ? "Student will register using username"
                      : "Student will register using email"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rsm-field">
              {form.noEmail ? (
                <input
                  type="text"
                  name="username"
                  className="rsm-input"
                  placeholder="Student Username"
                  value={form.username}
                  onChange={handleChange}
                />
              ) : (
                <input
                  type="email"
                  name="email"
                  className="rsm-input"
                  placeholder="Student Email"
                  value={form.email}
                  onChange={handleChange}
                />
              )}
            </div>

            <div className="rsm-field rsm-password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className="rsm-input rsm-password-input"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="rsm-eye-btn"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                <Icon
                  icon={
                    showPassword ? "mdi:eye-outline" : "mdi:eye-off-outline"
                  }
                  width="20"
                />
              </button>
            </div>

            <div className="rsm-field rsm-password-wrap">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                className="rsm-input rsm-password-input"
                placeholder="Confirm Password"
                value={form.confirmPassword}
                onChange={handleChange}
              />
              <button
                type="button"
                className="rsm-eye-btn"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
              >
                <Icon
                  icon={
                    showConfirmPassword
                      ? "mdi:eye-outline"
                      : "mdi:eye-off-outline"
                  }
                  width="20"
                />
              </button>
            </div>

            <div className="rsm-field">
              <PhoneInput
                country="ae"
                value={form.phone}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    phone: value,
                  }))
                }
                enableSearch
                disableSearchIcon
                preferredCountries={["ae", "gb", "us"]}
                countryCodeEditable={false}
                inputProps={{
                  name: "phone",
                  required: true,
                  placeholder: "Phone Number",
                  autoComplete: "off",
                }}
                containerClass="rsm-phone"
                dropdownStyle={{
                  top: "auto",
                  bottom: "calc(100% + 8px)",
                  zIndex: 10050,
                }}
              />
            </div>

            <div className="rsm-field">
              <input
                type="email"
                name="parentemail"
                className="rsm-input"
                placeholder="Parent Email"
                value={form.parentemail}
                onChange={handleChange}
              />
            </div>

            <div className="rsm-footer">
              <button
                type="button"
                className="rsm-submit"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Registering..." : "Register Now"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RegisterStudentModal;