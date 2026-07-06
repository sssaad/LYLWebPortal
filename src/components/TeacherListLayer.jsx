// src/layers/TeacherListLayer.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment";

import { getAllTeacherProfiles } from "../api/getAllTeacherProfiles";
import { updateTeacherStatus } from "../api/updateTeacherStatus";
import { hardDeleteUser } from "../api/hardDeleteUser";
import { getNationalities } from "../api/getNationalities";
import { getToken } from "../api/getToken";

import TeacherDetailsModal from "../components/TeacherDetailsModal";
import BankDetailModal from "../components/BankDetailModal";

const FALLBACK_AVATAR = "https://gostudy.ae/assets/invalid-square.png";

const SET_PASSWORD_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=set_password";

const TEACHER_PUBLIC_PROFILE_BASE_URL = "https://gostudy.ae/teachersdetails";

const API_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "x-api-key": "abc123456789",
  userid: "test",
  password: "test",
  projectid: "1",
};

const EYE_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg">
    <path d="M2.25 12C3.75 7.75 7.45 5 12 5C16.55 5 20.25 7.75 21.75 12C20.25 16.25 16.55 19 12 19C7.45 19 3.75 16.25 2.25 12Z"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 15.25C13.7949 15.25 15.25 13.7949 15.25 12C15.25 10.2051 13.7949 8.75 12 8.75C10.2051 8.75 8.75 10.2051 8.75 12C8.75 13.7949 10.2051 15.25 12 15.25Z"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

const EYE_OFF_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M10.6 5.14C11.06 5.05 11.53 5 12 5C16.55 5 20.25 7.75 21.75 12C21.27 13.36 20.56 14.56 19.67 15.55"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6.15 6.73C4.36 7.88 3 9.71 2.25 12C3.75 16.25 7.45 19 12 19C13.79 19 15.45 18.57 16.87 17.81"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M9.75 9.88C9.13 10.47 8.75 11.21 8.75 12C8.75 13.79 10.21 15.25 12 15.25C12.79 15.25 13.53 14.87 14.12 14.25"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const isPortalDarkMode = () => {
  return (
    document.documentElement.getAttribute("data-bs-theme") === "dark" ||
    document.documentElement.getAttribute("data-theme") === "dark" ||
    document.body.getAttribute("data-theme") === "dark" ||
    document.documentElement.classList.contains("dark") ||
    document.body.classList.contains("dark") ||
    document.body.classList.contains("dark-theme") ||
    document.body.classList.contains("theme-dark")
  );
};

const getSwalTheme = () => {
  const dark = isPortalDarkMode();

  return {
    dark,
    background: dark ? "#1f2937" : "#ffffff",
    color: dark ? "#f8fafc" : "#111827",
    popupClass: dark
      ? "reset-pass-swal reset-pass-swal-dark"
      : "reset-pass-swal reset-pass-swal-light",
  };
};

const resolveToken = (tokenRes) => {
  if (typeof tokenRes === "string") return tokenRes;

  return (
    tokenRes?.token ||
    tokenRes?.access_token ||
    tokenRes?.accessToken ||
    tokenRes?.data?.token ||
    tokenRes?.data?.access_token ||
    tokenRes?.data?.accessToken ||
    tokenRes?.data?.data?.token ||
    tokenRes?.data?.data?.access_token ||
    tokenRes?.data?.data?.accessToken ||
    tokenRes?.data?.[0]?.token ||
    tokenRes?.data?.[0]?.access_token ||
    ""
  );
};

const TeacherListLayer = () => {
  const [teachers, setTeachers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [compFilter, setCompFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [nationalityFilter, setNationalityFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  const [nationalities, setNationalities] = useState([]);

  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [subjectsModalTeacher, setSubjectsModalTeacher] = useState(null);

  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [seedTeacher, setSeedTeacher] = useState(null);

  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const teachersPerPage = 15;

  // ---------- helpers ----------
  const isIncomplete = (t) => !t?.userid;
  const getJoinDate = (t) => t?.user_createddate || t?.createddate || "";

  const displayName = (t) => {
    const name = `${t?.firstname || ""} ${t?.lastname || ""}`.trim();
    return name || t?.fullname || "-";
  };

  const getEmail = (t) =>
    isIncomplete(t) ? t?.user_email || t?.email || "-" : t?.email || "-";

  const getPhone = (t) =>
    isIncomplete(t)
      ? t?.user_phonenumber || t?.phonenumber || "-"
      : t?.phonenumber || "-";

  const getResetPasswordEmail = (t) => {
    const email = String(t?.email || t?.user_email || "").trim();
    return email;
  };

  const getAccountLabel = (t) => {
    const email = String(t?.email || t?.user_email || "").trim();
    return email || "-";
  };

  const getRawImage = (t) => {
    const raw = String(t?.imagepath || t?.user_imagepath || "").trim();

    if (!raw) return "";
    if (raw === FALLBACK_AVATAR) return "";
    if (raw.includes("invalid-square.png")) return "";
    if (!raw.startsWith("http")) return "";

    return raw;
  };

  const getTeacherImage = (t) => {
    const raw = getRawImage(t);
    return raw || FALLBACK_AVATAR;
  };

  const getTeacherSubjectsArray = (t) => {
    if (Array.isArray(t?.teacherSubjects_array)) return t.teacherSubjects_array;

    if (typeof t?.teacherSubjects === "string" && t.teacherSubjects.trim()) {
      try {
        const parsed = JSON.parse(t.teacherSubjects);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // ignore
      }
    }

    if (t?.subjectid || t?.subjectname) {
      return [
        {
          subjectid: t?.subjectid ?? null,
          subjectname: t?.subjectname ?? null,
        },
      ];
    }

    return [];
  };

  const getTeacherSubjectsText = (t) => {
    const arr = getTeacherSubjectsArray(t);
    if (arr?.length) {
      return arr
        .map((s) => s?.subjectname || (s?.subjectid ? `Subject #${s.subjectid}` : ""))
        .filter(Boolean)
        .join(", ");
    }
    return t?.subjectname || "";
  };

  const getNationalityName = (t) => {
    if (t?.nationalityname) return String(t.nationalityname);

    const nid = t?.nationalityid;
    if (nid === null || nid === undefined || nid === "") return "";

    const found = (nationalities || []).find((n) => String(n?.id) === String(nid));
    if (found?.nationality) return String(found.nationality);

    if (String(nid) === "0") return "Unknown";
    return `Nationality #${nid}`;
  };

  const getRowKey = (t) =>
    String(
      t?.uid ??
      t?.id ??
      t?.userid ??
      `${t?.email ?? t?.user_email ?? ""}-${t?.phonenumber ?? t?.user_phonenumber ?? ""}-${getJoinDate(t) ?? ""}`
    );

  const getSeedUserId = (t) => {
    const raw = t?.userid ?? t?.uid ?? t?.id ?? null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const copyTextFallback = (text) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const handleCopyTeacherLink = async (teacher) => {
  const teacherId = teacher?.userid;
  const teacherName = displayName(teacher);

  if (!teacherId) {
    Swal.fire("Error", "Incomplete teacher. Userid missing hai.", "error");
    return;
  }

  const publicLink = `${TEACHER_PUBLIC_PROFILE_BASE_URL}/${teacherId}`;
  const theme = getSwalTheme();

  const confirm = await Swal.fire({
    title: "Copy Teacher Link?",
    html: `
      <div style="text-align:left;">
        <div style="font-weight:700; margin-bottom:8px;">
          ${escapeHtml(teacherName)}
        </div>
        <div style="
          word-break: break-all;
          padding: 12px;
          border-radius: 10px;
          background: ${theme.dark ? "#111827" : "#f8fafc"};
          border: 1px solid ${theme.dark ? "rgba(148,163,184,0.35)" : "#e5e7eb"};
          font-size: 13px;
        ">
          ${escapeHtml(publicLink)}
        </div>
      </div>
    `,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Copy Link",
    cancelButtonText: "Cancel",
    buttonsStyling: false,
    background: theme.background,
    color: theme.color,
    customClass: {
      popup: theme.popupClass,
      title: "reset-pass-title",
      htmlContainer: "reset-pass-html",
      confirmButton: "btn btn-primary px-20 py-10 radius-8",
      cancelButton: "btn btn-outline-secondary px-20 py-10 radius-8 ms-2",
    },
  });

  if (!confirm.isConfirmed) return;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(publicLink);
    } else {
      copyTextFallback(publicLink);
    }

    const successTheme = getSwalTheme();

    Swal.fire({
      title: "Link Copied",
      html: `
        <div class="reset-success-text">
          Teacher profile link copied successfully.
          <br />
          <span style="word-break:break-all;">${escapeHtml(publicLink)}</span>
        </div>
      `,
      icon: "success",
      confirmButtonText: "Done",
      buttonsStyling: false,
      background: successTheme.background,
      color: successTheme.color,
      customClass: {
        popup: successTheme.popupClass,
        title: "reset-pass-title",
        htmlContainer: "reset-pass-html",
        confirmButton: "btn btn-primary px-20 py-10 radius-8",
      },
    });
  } catch (error) {
    console.error("Copy link error:", error);

    const errorTheme = getSwalTheme();

    Swal.fire({
      title: "Copy Failed",
      text: "Link copy nahi ho saka. Please try again.",
      icon: "error",
      buttonsStyling: false,
      background: errorTheme.background,
      color: errorTheme.color,
      customClass: {
        popup: errorTheme.popupClass,
        confirmButton: "btn btn-primary px-20 py-10 radius-8",
      },
    });
  }
};

  const openSubjectsModal = (teacher) => {
    const subjects = getTeacherSubjectsArray(teacher);
    setSubjectsModalTeacher({
      teacherName: displayName(teacher),
      subjects: subjects || [],
    });
    setShowSubjectsModal(true);
  };

  const closeSubjectsModal = () => {
    setShowSubjectsModal(false);
    setSubjectsModalTeacher(null);
  };

  const fetchTeachers = async () => {
    try {
      const data = await getAllTeacherProfiles();

      const activeOrInactive = (data || []).filter((t) => t.is_active !== 2);

      const formatted = activeOrInactive.map((t) => ({
        ...t,
        fees: parseFloat(t.fees) || 0,
      }));

      setTeachers(
        formatted.sort(
          (a, b) => new Date(getJoinDate(b)) - new Date(getJoinDate(a))
        )
      );
    } catch (e) {
      console.error("getAllTeacherProfiles error:", e);
      setTeachers([]);
    }
  };

  // ---------- mount fetch ----------
  useEffect(() => {
    fetchTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await getNationalities();
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setNationalities(list || []);
      } catch (e) {
        console.error("getNationalities error:", e);
        setNationalities([]);
      }
    })();
  }, []);

  const openTeacher = (t) => {
    const incomplete = isIncomplete(t);

    if (incomplete) {
      const seedId = getSeedUserId(t);

      setSeedTeacher({
        id: seedId,
        email: t?.user_email || t?.email || "",
        phonenumber: String(t?.user_phonenumber || t?.phonenumber || "").replace("-", ""),
        fullname: displayName(t),
      });

      setSelectedTeacherId(null);
    } else {
      setSelectedTeacherId(Number(t.userid));
      setSeedTeacher(null);
    }

    setShowTeacherModal(true);
  };

  const closeTeacherModal = () => {
    setShowTeacherModal(false);
    setSelectedTeacherId(null);
    setSeedTeacher(null);
  };

  // ---------- RESET PASSWORD ----------
  const handleResetPassword = async (teacher) => {
    const name = displayName(teacher) || "this teacher";
    const resetEmail = getResetPasswordEmail(teacher);
    const accountLabel = getAccountLabel(teacher);
    const profileImage = getRawImage(teacher);
    const theme = getSwalTheme();

    if (!resetEmail || resetEmail === "-") {
      Swal.fire({
        title: "Email Missing",
        text: "Teacher email is missing.",
        icon: "error",
        background: theme.background,
        color: theme.color,
        customClass: {
          popup: theme.popupClass,
          confirmButton: "btn btn-primary px-20 py-10 radius-8",
        },
        buttonsStyling: false,
      });
      return;
    }

    const imageHtml = profileImage
      ? `
        <img
          src="${escapeHtml(profileImage)}"
          alt="${escapeHtml(name)}"
          class="reset-pass-profile-img"
          onerror="this.style.display='none'"
        />
      `
      : "";

    const passwordPopup = await Swal.fire({
      title: "Add New Password",
      html: `
        <div class="reset-pass-inner">
          <div class="reset-pass-student-box ${profileImage ? "" : "no-image"}">
            ${imageHtml}

            <div class="reset-pass-student-info">
              <div class="reset-pass-student-name">${escapeHtml(name)}</div>
              <div class="reset-pass-student-account">${escapeHtml(accountLabel)}</div>
            </div>
          </div>

          <div class="reset-pass-field">
            <label>New Password</label>
            <div class="reset-pass-input-wrap">
              <input
                id="newTeacherPassword"
                type="password"
                class="reset-pass-input"
                placeholder="Enter new password"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="reset-pass-eye"
                data-target="newTeacherPassword"
                data-icon="newPasswordIcon"
                aria-label="Show password"
              >
                <span id="newPasswordIcon">${EYE_ICON}</span>
              </button>
            </div>
          </div>

          <div class="reset-pass-field">
            <label>Confirm Password</label>
            <div class="reset-pass-input-wrap">
              <input
                id="confirmTeacherPassword"
                type="password"
                class="reset-pass-input"
                placeholder="Confirm new password"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="reset-pass-eye"
                data-target="confirmTeacherPassword"
                data-icon="confirmPasswordIcon"
                aria-label="Show password"
              >
                <span id="confirmPasswordIcon">${EYE_ICON}</span>
              </button>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Continue",
      cancelButtonText: "Cancel",
      focusConfirm: false,
      buttonsStyling: false,
      background: theme.background,
      color: theme.color,
      customClass: {
        popup: theme.popupClass,
        title: "reset-pass-title",
        htmlContainer: "reset-pass-html",
        confirmButton: "btn btn-primary px-20 py-10 radius-8",
        cancelButton: "btn btn-outline-secondary px-20 py-10 radius-8 ms-2",
      },
      didOpen: () => {
        const popup = Swal.getPopup();
        if (!popup) return;

        const toggleButtons = popup.querySelectorAll(".reset-pass-eye");

        toggleButtons.forEach((btn) => {
          btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            const iconId = btn.getAttribute("data-icon");

            const input = popup.querySelector(`#${targetId}`);
            const icon = popup.querySelector(`#${iconId}`);

            if (!input || !icon) return;

            const isPassword = input.getAttribute("type") === "password";
            input.setAttribute("type", isPassword ? "text" : "password");
            icon.innerHTML = isPassword ? EYE_OFF_ICON : EYE_ICON;
          });
        });
      },
      preConfirm: () => {
        const popup = Swal.getPopup();

        const newPassword = popup
          ?.querySelector("#newTeacherPassword")
          ?.value?.trim();

        const confirmPassword = popup
          ?.querySelector("#confirmTeacherPassword")
          ?.value?.trim();

        if (!newPassword) {
          Swal.showValidationMessage("Please enter new password.");
          return false;
        }

        if (newPassword.length < 6) {
          Swal.showValidationMessage("Password must be at least 6 characters.");
          return false;
        }

        if (!confirmPassword) {
          Swal.showValidationMessage("Please confirm password.");
          return false;
        }

        if (newPassword !== confirmPassword) {
          Swal.showValidationMessage("Password and confirm password do not match.");
          return false;
        }

        return { newPassword };
      },
    });

    if (!passwordPopup.isConfirmed) return;

    const newPassword = passwordPopup.value?.newPassword;
    const confirmTheme = getSwalTheme();

    const confirm = await Swal.fire({
      title: "Confirm Password Update",
      html: `
        <div class="reset-confirm-box">
          <div class="reset-confirm-name">${escapeHtml(name)}</div>
          <div class="reset-confirm-desc">Ready to update password?</div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Update",
      cancelButtonText: "Cancel",
      buttonsStyling: false,
      background: confirmTheme.background,
      color: confirmTheme.color,
      customClass: {
        popup: confirmTheme.popupClass,
        title: "reset-pass-title",
        htmlContainer: "reset-pass-html",
        confirmButton: "btn btn-primary px-20 py-10 radius-8",
        cancelButton: "btn btn-outline-secondary px-20 py-10 radius-8 ms-2",
      },
    });

    if (!confirm.isConfirmed) return;

    try {
      const loadingTheme = getSwalTheme();

      Swal.fire({
        title: "Updating Password...",
        text: "Please wait while we update teacher password.",
        allowOutsideClick: false,
        showConfirmButton: false,
        background: loadingTheme.background,
        color: loadingTheme.color,
        customClass: {
          popup: loadingTheme.popupClass,
          title: "reset-pass-title",
        },
        didOpen: () => Swal.showLoading(),
      });

      const tokenRes = await getToken();
      const token = resolveToken(tokenRes);

      if (!token) {
        Swal.close();

        const errorTheme = getSwalTheme();
        Swal.fire({
          title: "Token Missing",
          text: "Token not found. Please try again.",
          icon: "error",
          background: errorTheme.background,
          color: errorTheme.color,
          customClass: {
            popup: errorTheme.popupClass,
            confirmButton: "btn btn-primary px-20 py-10 radius-8",
          },
          buttonsStyling: false,
        });
        return;
      }

      const payload = {
        token,
        email: resetEmail,
        newpassword: newPassword,
      };

      const res = await axios.post(SET_PASSWORD_URL, payload, {
        headers: API_HEADERS,
      });

      const result = res?.data;

      if (Number(result?.statusCode) === 200) {
        await fetchTeachers();

        const successTheme = getSwalTheme();

        Swal.fire({
          title: "Password Updated",
          html: `<div class="reset-success-text">${escapeHtml(
            name
          )}'s password has been updated successfully.</div>`,
          icon: "success",
          confirmButtonText: "Done",
          background: successTheme.background,
          color: successTheme.color,
          buttonsStyling: false,
          customClass: {
            popup: successTheme.popupClass,
            title: "reset-pass-title",
            htmlContainer: "reset-pass-html",
            confirmButton: "btn btn-primary px-20 py-10 radius-8",
          },
        });
      } else {
        const errorTheme = getSwalTheme();

        Swal.fire({
          title: "Update Failed",
          text: result?.message || "Password reset failed. Please try again.",
          icon: "error",
          background: errorTheme.background,
          color: errorTheme.color,
          customClass: {
            popup: errorTheme.popupClass,
            confirmButton: "btn btn-primary px-20 py-10 radius-8",
          },
          buttonsStyling: false,
        });
      }
    } catch (error) {
      console.error("set_password teacher error:", error);

      const errorTheme = getSwalTheme();

      Swal.fire({
        title: "Update Failed",
        text:
          error?.response?.data?.message ||
          error?.message ||
          "Something went wrong while resetting password.",
        icon: "error",
        background: errorTheme.background,
        color: errorTheme.color,
        customClass: {
          popup: errorTheme.popupClass,
          confirmButton: "btn btn-primary px-20 py-10 radius-8",
        },
        buttonsStyling: false,
      });
    }
  };

  // ✅ STATUS TOGGLE
  const handleStatusToggle = async (teacher) => {
    if (!teacher?.userid) {
      Swal.fire("Error", "Incomplete teacher (userid missing). Status change nahi ho sakta.", "error");
      return;
    }

    const newStatus = teacher.is_active === 1 ? 0 : 1;

    const confirm = await Swal.fire({
      title: "Change Status?",
      text: `Are you sure you want to ${newStatus === 1 ? "activate" : "deactivate"} this teacher?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Change it!",
    });
    if (!confirm.isConfirmed) return;

    const result = await updateTeacherStatus(teacher.userid, newStatus);

    if (result?.statusCode === 200) {
      setTeachers((prev) =>
        prev.map((t) =>
          t.userid === teacher.userid ? { ...t, is_active: newStatus } : t
        )
      );
      Swal.fire("Success", "Status updated successfully", "success");
    } else {
      Swal.fire("Error", result?.message || "Status update failed.", "error");
    }
  };

  // ----- HARD delete -----
  const handleDeleteTeacher = async (teacher) => {
    const teacherId = teacher?.uid;

    if (teacherId === null || teacherId === undefined || teacherId === "") {
      console.log("Teacher object:", teacher);
      Swal.fire("Error", "Teacher ID missing.", "error");
      return;
    }

    const confirm = await Swal.fire({
      title: "Hard Delete Teacher?",
      text: `This will permanently delete ${displayName(teacher)}. Continue?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Hard Delete",
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({
      title: "Deleting...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const result = await hardDeleteUser(teacherId);

    if (result?.statusCode === 200) {
      const updated = teachers.filter((t) => t?.uid !== teacherId);
      setTeachers(updated);
      Swal.fire("Deleted!", "Teacher hard deleted successfully.", "success");
    } else {
      Swal.fire("Error", result?.message || "Hard delete failed.", "error");
    }
  };

  // ✅ Dropdown options
  const nationalityOptions = useMemo(() => {
    const map = new Map();

    (nationalities || []).forEach((n) => {
      if (n?.id == null) return;
      map.set(String(n.id), String(n.nationality || `Nationality #${n.id}`));
    });

    (teachers || []).forEach((t) => {
      const id = t?.nationalityid;
      if (id === null || id === undefined || id === "") return;

      const key = String(id);
      if (map.has(key)) return;

      const label = t?.nationalityname || (String(id) === "0" ? "Unknown" : `Nationality #${id}`);
      map.set(key, label);
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [nationalities, teachers]);

  const subjectOptions = useMemo(() => {
    const map = new Map();

    (teachers || []).forEach((t) => {
      const arr = getTeacherSubjectsArray(t);
      (arr || []).forEach((s) => {
        const sid = s?.subjectid;
        if (sid === null || sid === undefined || sid === "") return;

        const key = String(sid);
        const name = s?.subjectname || `Subject #${sid}`;
        if (!map.has(key)) map.set(key, name);
      });
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teachers]);

  // ----- filters -----
  const filteredTeachers = teachers.filter((teacher) => {
    if (compFilter === "complete" && isIncomplete(teacher)) return false;
    if (compFilter === "incomplete" && !isIncomplete(teacher)) return false;

    const matchesStatus =
      statusFilter === "" ||
      (teacher.is_active === 1 ? "Active" : "Inactive") === statusFilter;

    const fullText = `${displayName(teacher)} ${getEmail(teacher)} ${getPhone(teacher)} ${getNationalityName(teacher)} ${getTeacherSubjectsText(teacher)}`.toLowerCase();
    const matchesSearch = fullText.includes((searchTerm || "").toLowerCase());

    const jd = getJoinDate(teacher);
    const joinDate = jd ? new Date(jd) : null;
    const afterStart = startDate ? joinDate && joinDate >= new Date(startDate) : true;
    const beforeEnd = endDate ? joinDate && joinDate <= new Date(endDate) : true;

    const matchesNationality =
      nationalityFilter === "" ||
      String(teacher?.nationalityid ?? "") === String(nationalityFilter);

    const matchesSubject =
      subjectFilter === "" ||
      getTeacherSubjectsArray(teacher).some(
        (s) => String(s?.subjectid ?? "") === String(subjectFilter)
      );

    return (
      matchesSearch &&
      matchesStatus &&
      afterStart &&
      beforeEnd &&
      matchesNationality &&
      matchesSubject
    );
  });

  // ----- paging -----
  const indexOfLastTeacher = currentPage * teachersPerPage;
  const indexOfFirstTeacher = indexOfLastTeacher - teachersPerPage;
  const currentTeachers = filteredTeachers.slice(indexOfFirstTeacher, indexOfLastTeacher);
  const totalPages = Math.ceil(filteredTeachers.length / teachersPerPage) || 1;

  const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);

  // ----- exports -----
  const exportToExcel = () => {
    const heading = [["Teacher List"]];
    const data = filteredTeachers.map((t, i) => ({
      "S.L": i + 1,
      "Join Date": getJoinDate(t) ? moment(getJoinDate(t)).format("DD MMM YYYY") : "-",
      "Teacher Name": displayName(t),
      Email: getEmail(t),
      "Phone Number": getPhone(t),
      Country: t.country || "-",
      Subject: t.subjectname || "-",
      Profile: isIncomplete(t) ? "Incomplete" : "Complete",
      Status: t.is_active === 1 ? "Active" : "Inactive",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data, { origin: -1 });
    XLSX.utils.sheet_add_aoa(worksheet, heading, { origin: "A1" });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Teachers");
    XLSX.writeFile(workbook, "teachers.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Teacher List", 14, 20);

    const tableColumn = [
      "S.L",
      "Join Date",
      "Teacher Name",
      "Email",
      "Phone",
      "Country",
      "Subject",
      "Profile",
      "Status",
    ];

    const tableRows = filteredTeachers.map((t, i) => [
      i + 1,
      getJoinDate(t) ? moment(getJoinDate(t)).format("DD MMM YYYY") : "-",
      displayName(t),
      getEmail(t),
      getPhone(t),
      t.country || "-",
      t.subjectname || "-",
      isIncomplete(t) ? "Incomplete" : "Complete",
      t.is_active === 1 ? "Active" : "Inactive",
    ]);

    autoTable(doc, { startY: 25, head: [tableColumn], body: tableRows });
    doc.save("teachers.pdf");
  };

  if (!teachers || teachers.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "300px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "6px solid #e0e0e0",
            borderTop: "6px solid #45B369",
            borderRadius: "50%",
            animation: "spin 1s ease-in-out infinite",
          }}
        />
        <style>{`@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div className="card h-100 p-0 radius-12">
      <style>{`
        .avatar-ring-danger {
          box-shadow: 0 0 0 2px #ffffff, 0 0 0 5px #dc3545;
        }

        .reset-pass-swal {
          width: min(520px, calc(100vw - 24px)) !important;
          border-radius: 18px !important;
          padding: 26px 28px !important;
          border: 1px solid rgba(148, 163, 184, 0.26) !important;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.25) !important;
        }

        .reset-pass-swal-light {
          background: #ffffff !important;
          color: #111827 !important;
        }

        .reset-pass-swal-dark {
          background: #1f2937 !important;
          color: #f8fafc !important;
          border-color: rgba(148, 163, 184, 0.25) !important;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.52) !important;
        }

        .reset-pass-swal-dark .swal2-title {
          color: #f8fafc !important;
        }

        .reset-pass-swal-dark .swal2-html-container {
          color: #cbd5e1 !important;
          opacity: 1 !important;
        }

        .reset-pass-swal-light .swal2-title {
          color: #111827 !important;
        }

        .reset-pass-swal-light .swal2-html-container {
          color: #475569 !important;
          opacity: 1 !important;
        }

        .reset-pass-title {
          font-size: 22px !important;
          font-weight: 800 !important;
          margin-bottom: 16px !important;
          color: inherit !important;
        }

        .reset-pass-html {
          margin: 0 !important;
          padding: 0 !important;
          color: inherit !important;
        }

        .reset-pass-inner {
          text-align: left;
        }

        .reset-pass-student-box {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 14px;
          margin-bottom: 18px;
        }

        .reset-pass-student-box.no-image {
          padding-left: 16px;
        }

        .reset-pass-swal-light .reset-pass-student-box {
          background: #eefaf3;
          border: 1px solid rgba(69, 179, 105, 0.22);
        }

        .reset-pass-swal-dark .reset-pass-student-box {
          background: rgba(69, 179, 105, 0.14);
          border: 1px solid rgba(69, 179, 105, 0.32);
        }

        .reset-pass-profile-img {
          width: 46px;
          height: 46px;
          min-width: 46px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(69, 179, 105, 0.55);
          background: rgba(255, 255, 255, 0.08);
        }

        .reset-pass-student-info {
          min-width: 0;
          flex: 1;
        }

        .reset-pass-student-name {
          font-size: 15px;
          font-weight: 800;
          line-height: 1.25;
          word-break: break-word;
        }

        .reset-pass-swal-light .reset-pass-student-name {
          color: #111827 !important;
        }

        .reset-pass-swal-dark .reset-pass-student-name {
          color: #f8fafc !important;
        }

        .reset-pass-student-account {
          font-size: 12px;
          font-weight: 600;
          margin-top: 4px;
          line-height: 1.35;
          word-break: break-all;
        }

        .reset-pass-swal-light .reset-pass-student-account {
          color: #64748b !important;
        }

        .reset-pass-swal-dark .reset-pass-student-account {
          color: #cbd5e1 !important;
        }

        .reset-pass-field {
          margin-top: 14px;
        }

        .reset-pass-field label {
          display: block;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 7px;
        }

        .reset-pass-swal-light .reset-pass-field label {
          color: #1f2937 !important;
        }

        .reset-pass-swal-dark .reset-pass-field label {
          color: #f1f5f9 !important;
        }

        .reset-pass-input-wrap {
          position: relative;
        }

        .reset-pass-input {
          width: 100%;
          height: 46px;
          border-radius: 10px;
          padding: 10px 48px 10px 13px;
          font-size: 14px;
          outline: none;
          transition: 0.18s ease;
        }

        .reset-pass-swal-light .reset-pass-input {
          background: #ffffff !important;
          color: #111827 !important;
          border: 1px solid #d9dee3 !important;
        }

        .reset-pass-swal-dark .reset-pass-input {
          background: #111827 !important;
          color: #f8fafc !important;
          border: 1px solid rgba(148, 163, 184, 0.34) !important;
        }

        .reset-pass-swal-light .reset-pass-input::placeholder {
          color: #9ca3af !important;
        }

        .reset-pass-swal-dark .reset-pass-input::placeholder {
          color: #94a3b8 !important;
        }

        .reset-pass-input:focus {
          border-color: #45B369 !important;
          box-shadow: 0 0 0 4px rgba(69, 179, 105, 0.16) !important;
        }

        .reset-pass-eye {
          position: absolute;
          top: 50%;
          right: 10px;
          transform: translateY(-50%);
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .reset-pass-swal-light .reset-pass-eye {
          color: #64748b !important;
        }

        .reset-pass-swal-dark .reset-pass-eye {
          color: #cbd5e1 !important;
        }

        .reset-pass-eye:hover {
          background: rgba(100, 116, 139, 0.14);
          color: #45B369 !important;
        }

        .reset-confirm-box {
          text-align: center;
          padding: 2px 4px 8px;
        }

        .reset-confirm-name {
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .reset-pass-swal-light .reset-confirm-name {
          color: #111827 !important;
        }

        .reset-pass-swal-dark .reset-confirm-name {
          color: #f8fafc !important;
        }

        .reset-confirm-desc {
          font-size: 13px;
          font-weight: 600;
        }

        .reset-pass-swal-light .reset-confirm-desc {
          color: #64748b !important;
        }

        .reset-pass-swal-dark .reset-confirm-desc {
          color: #cbd5e1 !important;
        }

        .reset-success-text {
          font-size: 14px;
          font-weight: 600;
          line-height: 1.6;
        }

        .reset-pass-swal-light .reset-success-text {
          color: #475569 !important;
        }

        .reset-pass-swal-dark .reset-success-text {
          color: #cbd5e1 !important;
        }

        .reset-pass-swal-dark .swal2-success-ring {
          border-color: rgba(69, 179, 105, 0.45) !important;
        }

        .reset-pass-swal-dark .swal2-success-line-tip,
        .reset-pass-swal-dark .swal2-success-line-long {
          background-color: #86efac !important;
        }

        .reset-pass-swal .swal2-icon-content {
          font-weight: 800 !important;
        }

        .reset-pass-swal .swal2-actions {
          margin-top: 22px !important;
        }

        .reset-pass-swal .btn-outline-secondary {
          border-color: rgba(148, 163, 184, 0.5) !important;
        }

        .reset-pass-swal-dark .btn-outline-secondary {
          color: #e5e7eb !important;
          border-color: rgba(203, 213, 225, 0.38) !important;
          background: transparent !important;
        }

        .reset-pass-swal-dark .btn-outline-secondary:hover {
          background: rgba(148, 163, 184, 0.12) !important;
        }

        .swal2-validation-message {
          border-radius: 10px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          margin-top: 14px !important;
        }

        .reset-pass-swal-dark .swal2-validation-message {
          background: rgba(127, 29, 29, 0.24) !important;
          color: #fecaca !important;
        }

        .reset-pass-swal-light .swal2-validation-message {
          background: #fff1f2 !important;
          color: #be123c !important;
        }
      `}</style>

      {/* Header */}
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between">
        <div className="d-flex align-items-center flex-wrap gap-3">
          <input
            type="text"
            className="form-control w-auto"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          <input
            type="date"
            className="form-control w-auto"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
          />
          <input
            type="date"
            className="form-control w-auto"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
          />

          <select
            className="form-select form-select-sm w-auto"
            value={compFilter}
            onChange={(e) => {
              setCompFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Profile: All</option>
            <option value="complete">Completed Profiles</option>
            <option value="incomplete">Incomplete Profiles</option>
          </select>

          <select
            className="form-select form-select-sm w-auto"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Status:All</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select
            className="form-select form-select-sm w-auto"
            value={nationalityFilter}
            onChange={(e) => {
              setNationalityFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Nationality: All</option>
            {nationalityOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>

          <select
            className="form-select form-select-sm w-auto"
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Subject: All</option>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("");
              setCompFilter("all");
              setStartDate("");
              setEndDate("");
              setNationalityFilter("");
              setSubjectFilter("");
              setCurrentPage(1);
            }}
            className="btn btn-outline-secondary btn-sm"
          >
            Reset Filters
          </button>

          <button onClick={exportToExcel} className="btn btn-success btn-sm">
            Excel Export
          </button>
          <button onClick={exportToPDF} className="btn btn-danger btn-sm">
            PDF Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card-body p-24">
        <div className="table-responsive" style={{ maxHeight: "calc(100vh - 360px)" }}>
          <table className="table bordered-table sm-table mb-0" style={{ borderCollapse: "separate" }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "#f8f9fa", zIndex: 5 }}>
                <th>S.L</th>
                <th>Join Date</th>
                <th>Teacher Name</th>
                <th>Email</th>
                <th>Phone Number</th>
                <th>Passport ID</th>
                <th>Driving License</th>
                <th>Subject</th>
                <th>Bank Detail</th>
                <th className="text-center">Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>

            <tbody>
              {currentTeachers.map((teacher, index) => {
                const incomplete = isIncomplete(teacher);
                const imgSrc = getTeacherImage(teacher);
                const rowKey = getRowKey(teacher);

                const subjectsArr = getTeacherSubjectsArray(teacher);

                return (
                  <tr key={rowKey}>
                    <td>{indexOfFirstTeacher + index + 1}</td>
                    <td>{getJoinDate(teacher) ? moment(getJoinDate(teacher)).format("DD MMM YYYY") : "-"}</td>

                    <td>
                      <div className="d-flex align-items-center">
                        <img
                          src={imgSrc}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = FALLBACK_AVATAR;
                          }}
                          alt="User"
                          className={`w-40-px h-40-px rounded-circle me-12 ${incomplete ? "avatar-ring-danger" : ""}`}
                          style={{ objectFit: "cover" }}
                        />
                        <span>{displayName(teacher)}</span>
                      </div>
                    </td>

                    <td>{getEmail(teacher)}</td>
                    <td>{getPhone(teacher)}</td>

                    <td className="text-center">
                      {teacher.passportid ? (
                        <button className="btn btn-outline-info btn-sm" onClick={() => setPreviewUrl(teacher.passportid)}>
                          <Icon icon="majesticons:eye-line" />
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="text-center">
                      {teacher.drivinglicense ? (
                        <button className="btn btn-outline-info btn-sm" onClick={() => setPreviewUrl(teacher.drivinglicense)}>
                          <Icon icon="majesticons:eye-line" />
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="text-center">
                      {subjectsArr?.length ? (
                        <button
                          className="btn btn-outline-info btn-sm"
                          onClick={() => openSubjectsModal(teacher)}
                          title="View Subjects"
                        >
                          <Icon icon="majesticons:eye-line" />
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="text-center">
                      <button
                        className="btn btn-info btn-sm"
                        onClick={() => {
                          if (!teacher?.userid) {
                            Swal.fire("Error", "Incomplete teacher (userid missing).", "error");
                            return;
                          }
                          setSelectedTeacher({
                            userid: teacher.userid,
                            firstname: teacher.firstname,
                            lastname: teacher.lastname,
                            payment_info: teacher.payment_info,
                          });
                          setShowBankModal(true);
                        }}
                      >
                        <Icon icon="majesticons:eye-line" />
                      </button>
                    </td>

                    <td className="text-center">
                      <button
                        className={`btn btn-sm ${teacher.is_active === 1 ? "btn-outline-danger" : "btn-outline-success"}`}
                        onClick={() => handleStatusToggle(teacher)}
                        disabled={!teacher?.userid}
                        title={!teacher?.userid ? "Incomplete teacher (userid missing) - status change disabled" : ""}
                      >
                        {teacher.is_active === 1 ? "Deactivate" : "Activate"}
                      </button>
                    </td>

                    <td className="text-center">
                      <div className="d-flex justify-content-center gap-2 flex-wrap">
                        <button
                          className={`btn btn-sm ${incomplete ? "btn-outline-danger" : "btn-primary"}`}
                          onClick={() => openTeacher(teacher)}
                          title={incomplete ? "Add Details" : "View / Edit"}
                        >
                          <Icon icon="majesticons:eye-line" />
                        </button>

                        <button
                          className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                          onClick={() => handleCopyTeacherLink(teacher)}
                          disabled={!teacher?.userid}
                          title={
                            !teacher?.userid
                              ? "Incomplete teacher userid missing"
                              : `Copy https://gostudy.ae/teachersdetails/${teacher.userid}`
                          }
                        >
                          <Icon icon="mdi:link-variant" />
                          Copy Link
                        </button>

                        <button
                          className="btn btn-warning btn-sm"
                          onClick={() => handleResetPassword(teacher)}
                          title="Reset Password"
                        >
                          <Icon icon="mdi:lock-reset" />
                        </button>

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteTeacher(teacher)}
                          title="Hard Delete"
                        >
                          <Icon icon="fluent:delete-24-regular" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="d-flex justify-content-between mt-3">
          <span>
            Showing {filteredTeachers.length === 0 ? 0 : indexOfFirstTeacher + 1} to{" "}
            {Math.min(indexOfLastTeacher, filteredTeachers.length)} of {filteredTeachers.length} entries
          </span>

          <ul className="pagination">
            {Array.from({ length: totalPages }).map((_, i) => (
              <li key={i} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                <button onClick={() => handlePageChange(i + 1)} className="page-link">
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Teacher Add/Edit Modal */}
      {showTeacherModal && (
        <TeacherDetailsModal
          show={showTeacherModal}
          onClose={closeTeacherModal}
          userid={selectedTeacherId}
          seed={seedTeacher}
          onSave={() => fetchTeachers()}
        />
      )}

      {showBankModal && selectedTeacher && (
        <BankDetailModal
          teacherId={selectedTeacher.userid}
          teacherName={`${selectedTeacher.firstname || ""} ${selectedTeacher.lastname || ""}`.trim()}
          paymentInfo={selectedTeacher.payment_info}
          onClose={() => setShowBankModal(false)}
          onSaved={() => fetchTeachers()}
        />
      )}

      {/* Subjects Modal */}
      {showSubjectsModal && subjectsModalTeacher && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Subjects{subjectsModalTeacher?.teacherName ? ` - ${subjectsModalTeacher.teacherName}` : ""}
                </h5>
                <button type="button" className="btn-close" onClick={closeSubjectsModal}></button>
              </div>

              <div className="modal-body">
                {subjectsModalTeacher?.subjects?.length ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: "80px" }}>S.L</th>
                          <th>Subject</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjectsModalTeacher.subjects.map((s, idx) => (
                          <tr key={`${s?.subjectid ?? idx}`}>
                            <td>{idx + 1}</td>
                            <td>{s?.subjectname || (s?.subjectid ? `Subject #${s.subjectid}` : "-")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted">No subjects found.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {previewUrl && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Document Preview</h5>
                <button type="button" className="btn-close" onClick={() => setPreviewUrl(null)}></button>
              </div>

              <div className="modal-body text-center">
                {String(previewUrl).toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                    title="PDF Preview"
                    width="100%"
                    height="600px"
                    frameBorder="0"
                  />
                ) : (
                  <img src={previewUrl} alt="Preview" style={{ maxWidth: "100%", maxHeight: "600px" }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherListLayer;