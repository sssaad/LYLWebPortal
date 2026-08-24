import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import Swal from "sweetalert2";
import axios from "axios";
import moment from 'moment';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ParentDetailsModal from './ParentDetailsModal';
import RegisterParentModal from './RegisterParentModal';
import { getNationalities } from '../api/getNationalities';
import { getToken } from "../api/getToken";

// ✅ HARD DELETE API (same as teacher/student)
import { hardDeleteUser } from '../api/hardDeleteUser';

const API_URL = 'https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_profiles';
const PORTAL_RESET_PASSWORD_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=portal_reset_user_password";

const API_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'x-api-key': 'abc123456789',
  userid: 'test',
  password: 'test',
  projectid: '1',
};

const DEFAULT_AVATAR =
  'https://gostudy.ae/assets/invalid-square.png';

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

// ---------- helpers ----------
function safeStr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t || t === 'null' || t === 'NULL' || t === 'undefined') return '';
    return t;
  }
  return String(v);
}

function cleanDate(v) {
  const s = safeStr(v);
  if (!s || s.startsWith('0000-00-00')) return '';
  const d = new Date(s.replace('.000000', ''));
  return isNaN(d.getTime()) ? '' : moment(d).format('DD MMM YYYY');
}

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

// force -> id string or ""
const getNatId = (val) => {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (s === '') return '';
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? String(n) : '';
};

const addr = (p) =>
  `${p.street || ''}, ${p.area || ''}, ${p.city || ''} - ${p.postcode || ''}`
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/(^,\s*)|(\s*,-?$)/g, '');

const fileStamp = () => moment().format('YYYY-MM-DD_HHmm');

const getRowKey = (p) =>
  String(p?.id ?? `${p?.email ?? ''}-${p?.phonenumber ?? ''}-${p?.createddate ?? ''}`);

const getHardDeleteId = (row) => {
  const raw = row?.id ?? row?.userdetails?.userid ?? null;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
};

const getChildrenArr = (row) => (Array.isArray(row?.bachy) ? row.bachy : []);
const getChildrenCount = (row) => getChildrenArr(row).length;

// ---------- mapping ----------
function mapRow(apiRow) {
  const ud = apiRow.userdetails || null;
  const isProfileComplete = Number(apiRow.detail_status) === 1;

  const name = ud
    ? `${safeStr(ud.firstname)} ${safeStr(ud.lastname)}`.trim() || safeStr(apiRow.fullname)
    : safeStr(apiRow.fullname);

  const natIdRaw = ud ? (ud.nationalityid ?? ud.nationality ?? '') : '';
  const nationalityid = getNatId(natIdRaw);

  const dob = ud ? cleanDate(ud.dob) : '';
  const gender = ud ? safeStr(ud.gender) : '';
  const street = ud ? safeStr(ud.street) : '';
  const area = ud ? safeStr(ud.area) : '';
  const city = ud ? safeStr(ud.city) : '';
  const postcode = ud ? safeStr(ud.postcode) : '';
  const address = [street, area, city, postcode].filter(Boolean).join(', ');

  const imagepathRaw = ud ? safeStr(ud.imagepath) : '';
  const avatar = isProfileComplete && imagepathRaw ? imagepathRaw : DEFAULT_AVATAR;

  return {
    id: apiRow.id,
    createddate: apiRow.createddate,
    parentName: name || '-',
    email: safeStr(apiRow.email) || '-',
    phonenumber: safeStr(apiRow.phonenumber) || '-',

    nationalityid,
    nationalityName: '-',

    dob: dob || '-',
    gender: gender || '-',
    street,
    area,
    city,
    postcode,
    address: address || '-',
    avatar,
    rawImage: imagepathRaw,
    isProfileComplete,
    seed: {
      id: apiRow.id,
      email: apiRow.email,
      phonenumber: apiRow.phonenumber,
      fullname: apiRow.fullname,
    },

    userdetails: apiRow.userdetails || null,
    bachy: Array.isArray(apiRow?.bachy) ? apiRow.bachy : [],
  };
}

const ParentListLayer = ({ useApi = true }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 15;

  const [showModal, setShowModal] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [seedRow, setSeedRow] = useState(null);

  const [showRegisterParentModal, setShowRegisterParentModal] = useState(false);

  const [nationalityFilter, setNationalityFilter] = useState('');

  const [showChildrenModal, setShowChildrenModal] = useState(false);
  const [childrenModalData, setChildrenModalData] = useState(null);

  const [natMap, setNatMap] = useState({});
  const [natLoaded, setNatLoaded] = useState(false);

  const getRawParentImage = (row) => {
    const raw = safeStr(row?.rawImage || row?.avatar || row?.userdetails?.imagepath || "");

    if (!raw) return "";
    if (raw === DEFAULT_AVATAR) return "";
    if (raw.includes("invalid-square.png")) return "";
    if (!raw.startsWith("http")) return "";

    return raw;
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await getNationalities();
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        const m = {};
        (list || []).forEach((n) => {
          m[String(n.id)] = n.nationality;
        });
        setNatMap(m);
      } catch (e) {
        console.error('getNationalities failed', e);
      } finally {
        setNatLoaded(true);
      }
    })();
  }, []);

  const fetchParents = useCallback(async () => {
    if (!useApi) return;

    try {
      setLoading(true);
      setError('');

      const res = await fetch(API_URL, { method: 'GET', headers: API_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      if (json.statusCode !== 200 || !Array.isArray(json.data)) {
        throw new Error(json.message || 'Unexpected API response');
      }

      const mapped = json.data
        .map(mapRow)
        .sort((a, b) => new Date(b.createddate) - new Date(a.createddate));

      setRows(mapped);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [useApi]);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  const rowsWithNationality = useMemo(() => {
    if (!natLoaded) return rows;
    return rows.map((r) => ({
      ...r,
      nationalityName: r.nationalityid ? (natMap[r.nationalityid] || '-') : '-',
    }));
  }, [rows, natMap, natLoaded]);

  const nationalityOptions = useMemo(() => {
    const map = new Map();

    Object.entries(natMap || {}).forEach(([id, name]) => {
      if (!id) return;
      map.set(String(id), String(name || `Nationality #${id}`));
    });

    (rowsWithNationality || []).forEach((r) => {
      const id = r?.nationalityid;
      if (!id) return;
      const key = String(id);
      if (map.has(key)) return;

      const label =
        r?.userdetails?.nationalityname ||
        (String(id) === '0' ? 'Unknown' : `Nationality #${id}`);
      map.set(key, String(label));
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [natMap, rowsWithNationality]);

  const filteredParents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return rowsWithNationality.filter((p) => {
      const hay = `${p.parentName} ${p.email} ${p.nationalityName}`.toLowerCase();
      const okSearch = term ? hay.includes(term) : true;

      const profileText = p.isProfileComplete ? 'Complete' : 'Incomplete';
      const okProfile = profileFilter ? profileText === profileFilter : true;

      const joined = p.createddate ? new Date(p.createddate) : null;
      const okStart = startDate && joined ? joined >= new Date(startDate) : !startDate;
      const okEnd = endDate && joined ? joined <= new Date(endDate) : !endDate;

      const okNat =
        nationalityFilter === '' ||
        String(p?.nationalityid ?? '') === String(nationalityFilter);

      return okSearch && okProfile && okStart && okEnd && okNat;
    });
  }, [rowsWithNationality, searchTerm, profileFilter, startDate, endDate, nationalityFilter]);

  const indexOfLast = currentPage * perPage;
  const indexOfFirst = indexOfLast - perPage;
  const currentParents = filteredParents.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredParents.length / perPage) || 1;

  const handlePageChange = (n) => setCurrentPage(n);

  const resetFilters = () => {
    setSearchTerm('');
    setProfileFilter('');
    setStartDate('');
    setEndDate('');
    setNationalityFilter('');
    setCurrentPage(1);
  };

  const openView = (row) => {
    setSelectedParentId(row.isProfileComplete ? row.id : null);
    setSeedRow(row.seed);
    setShowModal(true);
  };

  const openChildrenModal = (row) => {
    const kids = getChildrenArr(row);

    setChildrenModalData({
      parentName: row?.parentName || '-',
      count: kids.length,
      children: kids.map((c) => ({
        id: safeStr(c?.id || c?.userid) || '-',
        name:
          safeStr(c?.fullname) ||
          `${safeStr(c?.firstname)} ${safeStr(c?.lastname)}`.trim() ||
          '-',
      })),
    });

    setShowChildrenModal(true);
  };

  const closeChildrenModal = () => {
    setShowChildrenModal(false);
    setChildrenModalData(null);
  };

  // ✅ RESET PASSWORD
  const handleResetPassword = async (row) => {
    const name = row?.parentName || "this parent";
    const resetEmail = safeStr(row?.email);
    const accountLabel = resetEmail || "-";
    const profileImage = getRawParentImage(row);
    const theme = getSwalTheme();
    const targetUserId = getHardDeleteId(row);

    if (!targetUserId) {
      Swal.fire({
        title: "Update Failed",
        text: "Parent user ID is missing.",
        icon: "error",
      });
      return;
    }

    if (!resetEmail || resetEmail === "-") {
      Swal.fire({
        title: "Email Missing",
        text: "Parent email is missing.",
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
                id="newParentPassword"
                type="password"
                class="reset-pass-input"
                placeholder="Enter new password"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="reset-pass-eye"
                data-target="newParentPassword"
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
                id="confirmParentPassword"
                type="password"
                class="reset-pass-input"
                placeholder="Confirm new password"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="reset-pass-eye"
                data-target="confirmParentPassword"
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
          ?.querySelector("#newParentPassword")
          ?.value?.trim();

        const confirmPassword = popup
          ?.querySelector("#confirmParentPassword")
          ?.value?.trim();

        if (!newPassword) {
          Swal.showValidationMessage("Please enter new password.");
          return false;
        }

        if (
          newPassword.length < 8 ||
          !/[A-Z]/.test(newPassword) ||
          !/\d/.test(newPassword) ||
          !/[a-zA-Z]/.test(newPassword)
        ) {
          Swal.showValidationMessage(
            "Password must be at least 8 characters long and include an uppercase letter and a number."
          );
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
        text: "Please wait while we update parent password.",
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
        target_user_id: targetUserId,
        newpassword: newPassword,
        admin_user_id: Number(localStorage.getItem("user_id")),
        session_version: localStorage.getItem("session_version"),
      };

      const res = await axios.post(PORTAL_RESET_PASSWORD_URL, payload, {
        headers: API_HEADERS,
      });

      const result = res?.data;

      if (Number(result?.statusCode) === 200) {
        await fetchParents();

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
      console.error("set_password parent error:", error);

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

  const handleHardDelete = async (row) => {
    const parentId = getHardDeleteId(row);

    if (!parentId) {
      console.log('Parent row:', row);
      Swal.fire('Error', 'Parent ID missing.', 'error');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Hard Delete Parent?',
      text: `This will permanently delete ${row.parentName || 'this parent'}. Continue?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Hard Delete',
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({
      title: 'Deleting...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const result = await hardDeleteUser(parentId);

    if (result?.statusCode === 200) {
      setRows((prev) => prev.filter((r) => getHardDeleteId(r) !== parentId));
      Swal.fire('Deleted!', 'Parent hard deleted successfully.', 'success');
    } else {
      Swal.fire('Error', result?.message || 'Hard delete failed.', 'error');
    }
  };

  const handleSaved = (updated) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === updated.userid || r.id === updated.id
          ? {
            ...r,
            parentName:
              `${updated.firstname || ''} ${updated.lastname || ''}`.trim() || r.parentName,
            email: updated.email || r.email,
            phonenumber: updated.phonenumber || r.phonenumber,
            nationalityid: updated.nationalityid ? String(updated.nationalityid) : r.nationalityid,
            nationalityName: updated.nationality_name || r.nationalityName,
            dob: updated.dob || r.dob,
            street: updated.street ?? r.street,
            area: updated.area ?? r.area,
            city: updated.city ?? r.city,
            postcode: updated.postcode ?? r.postcode,
            address:
              [updated.street, updated.area, updated.city, updated.postcode]
                .filter(Boolean)
                .join(', ') || r.address,
            avatar: updated.imagepath ? updated.imagepath : r.avatar,
            rawImage: updated.imagepath ? updated.imagepath : r.rawImage,
            isProfileComplete: true,
          }
          : r
      )
    );
  };

  // ---------- EXPORTS ----------
  const exportParentsToExcel = () => {
    const heading = [['Parent List']];
    const data = filteredParents.map((p, i) => ({
      'S.L': i + 1,
      'Joined Date': p.createddate ? moment(p.createddate).format('DD MMM YYYY') : '-',
      'Parent Name': p.parentName || '-',
      Email: p.email || '-',
      'Phone Number': p.phonenumber || '-',
      Nationality: p.nationalityName || '-',
      'Date of Birth': p.dob || '-',
      Gender: p.gender || '-',
      Address: addr(p) || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(data, { origin: -1 });
    XLSX.utils.sheet_add_aoa(ws, heading, { origin: 'A1' });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parents');
    XLSX.writeFile(wb, `parents_${fileStamp()}.xlsx`);
  };

  const exportParentsToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Parent List', 14, 18);

    const head = [[
      'S.L', 'Joined Date', 'Parent Name', 'Email', 'Phone',
      'Nationality', 'DOB', 'Gender', 'Address',
    ]];

    const body = filteredParents.map((p, i) => ([
      i + 1,
      p.createddate ? moment(p.createddate).format('DD MMM YYYY') : '-',
      p.parentName || '-',
      p.email || '-',
      p.phonenumber || '-',
      p.nationalityName || '-',
      p.dob || '-',
      p.gender || '-',
      addr(p) || '-',
    ]));

    autoTable(doc, {
      startY: 24,
      head,
      body,
      styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [69, 179, 105] },
      columnStyles: {
        2: { cellWidth: 32 },
        3: { cellWidth: 38 },
        8: { cellWidth: 50 },
      },
    });

    doc.save(`parents_${fileStamp()}.pdf`);
  };

  return (
    <div className="card h-100 p-0 radius-12">
      <style>{`
        .avatar-ring-danger {
          box-shadow: 0 0 0 2px #ffe3e6, 0 0 0 4px #dc3545;
        }

        /* ===== Reset Password SweetAlert Theme ===== */
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

        /* ===== Theme-aware child modal helpers ===== */
        :root {
          --child-muted: rgba(33, 37, 41, 0.65);

          --child-modal-bg: #ffffff;
          --child-modal-text: #212529;
          --child-modal-border: rgba(0,0,0,0.12);

          --child-modal-head-bg: #f8f9fa;

          --child-table-head-bg: #f1f3f5;
          --child-table-row-bg: #ffffff;
          --child-table-hover-bg: #f6f7f9;

          --child-close-filter: none;
        }

        [data-bs-theme="dark"],
        [data-theme="dark"],
        .dark {
          --child-muted: rgba(255,255,255,0.75);

          --child-modal-bg: #0f172a;
          --child-modal-text: #e5e7eb;
          --child-modal-border: rgba(255,255,255,0.12);

          --child-modal-head-bg: #111827;

          --child-table-head-bg: #111827;
          --child-table-row-bg: #0f172a;
          --child-table-hover-bg: #162033;

          --child-close-filter: invert(1) grayscale(100%);
        }

        .child-empty-text{
          color: var(--child-muted) !important;
          font-weight: 500;
        }

        .child-modal .modal-content{
          background: var(--child-modal-bg) !important;
          color: var(--child-modal-text) !important;
          border: 1px solid var(--child-modal-border) !important;
        }
        .child-modal .modal-header{
          background: var(--child-modal-head-bg) !important;
          border-bottom: 1px solid var(--child-modal-border) !important;
        }
        .child-modal .modal-body{
          background: var(--child-modal-bg) !important;
        }
        .child-modal .btn-close{
          filter: var(--child-close-filter);
        }

        .child-modal .table-responsive{
          background: var(--child-modal-bg) !important;
        }

        .child-modal .table{
          --bs-table-bg: var(--child-table-row-bg) !important;
          --bs-table-color: var(--child-modal-text) !important;
          --bs-table-border-color: var(--child-modal-border) !important;
          background: var(--child-table-row-bg) !important;
          color: var(--child-modal-text) !important;
        }

        .child-modal .table > :not(caption) > * > *{
          background-color: var(--child-table-row-bg) !important;
          color: var(--child-modal-text) !important;
          border-color: var(--child-modal-border) !important;
        }

        .child-modal .table thead th{
          background-color: var(--child-table-head-bg) !important;
          color: var(--child-modal-text) !important;
        }

        .child-modal .table tbody tr:hover > *{
          background-color: var(--child-table-hover-bg) !important;
        }
      `}</style>

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
            value={profileFilter}
            onChange={(e) => {
              setProfileFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Profile: All</option>
            <option value="Complete">Completed Profiles</option>
            <option value="Incomplete">Incomplete Profiles</option>
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

          <button onClick={resetFilters} className="btn btn-outline-secondary btn-sm">
            Reset Filters
          </button>

          <button onClick={exportParentsToExcel} className="btn btn-success btn-sm">
            Excel Export
          </button>

          <button onClick={exportParentsToPDF} className="btn btn-danger btn-sm">
            PDF Export
          </button>

          <button
            onClick={() => setShowRegisterParentModal(true)}
            className="btn btn-primary btn-sm d-flex align-items-center gap-1"
          >
            <Icon icon="ic:round-person-add" />
            Register Parent
          </button>
        </div>
      </div>

      <div className="card-body p-24">
        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        {loading ? (
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ height: '220px' }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                border: '6px solid #e0e0e0',
                borderTop: '6px solid #45B369',
                borderRadius: '50%',
                animation: 'spin 1s ease-in-out infinite',
              }}
            />
            <style>{`@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <>
            <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 360px)' }}>
              <table className="table bordered-table sm-table mb-0" style={{ borderCollapse: 'separate' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 5 }}>
                    <th>S.L</th>
                    <th>Joined Date</th>
                    <th>Parent Name</th>
                    <th>Email</th>
                    <th>Phone Number</th>
                    <th>Nationality</th>
                    <th>Date of Birth</th>
                    <th>Gender</th>
                    <th>Address</th>
                    <th className="text-center">Child</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {currentParents.length === 0 ? (
                    <tr>
                      <td className="text-center" colSpan={11}>No records found.</td>
                    </tr>
                  ) : currentParents.map((p, idx) => (
                    <tr key={getRowKey(p)}>
                      <td>{indexOfFirst + idx + 1}</td>
                      <td>{cleanDate(p.createddate) || '-'}</td>

                      <td>
                        <div className="d-flex align-items-center">
                          <img
                            src={p.avatar}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = DEFAULT_AVATAR;
                            }}
                            alt="User"
                            className={`w-40-px h-40-px rounded-circle me-12 ${!p.isProfileComplete ? 'avatar-ring-danger' : ''}`}
                            style={{ objectFit: 'cover' }}
                          />
                          <span>{p.parentName}</span>
                        </div>
                      </td>

                      <td>{p.email}</td>
                      <td>{p.phonenumber}</td>
                      <td>{p.nationalityName}</td>
                      <td>{p.dob}</td>
                      <td>{p.gender}</td>
                      <td>{p.address}</td>

                      <td className="text-center">
                        {getChildrenCount(p) > 0 ? (
                          <button
                            className="btn btn-outline-info btn-sm"
                            onClick={() => openChildrenModal(p)}
                            title="View Children"
                          >
                            <Icon icon="majesticons:eye-line" />
                            <span className="ms-1">{getChildrenCount(p)}</span>
                          </button>
                        ) : (
                          <span className="child-empty-text">No Child Added Yet</span>
                        )}
                      </td>

                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-2">
                          <button
                            className={`btn btn-sm ${p.isProfileComplete ? 'btn-primary' : 'btn-outline-danger'}`}
                            onClick={() => openView(p)}
                            title={p.isProfileComplete ? 'View / Edit Profile' : 'Add Details'}
                          >
                            <Icon icon="majesticons:eye-line" />
                          </button>

                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => handleResetPassword(p)}
                            title="Reset Password"
                          >
                            <Icon icon="mdi:lock-reset" />
                          </button>

                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleHardDelete(p)}
                            title="Hard Delete"
                          >
                            <Icon icon="fluent:delete-24-regular" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between mt-3">
              <span>
                Showing {filteredParents.length === 0 ? 0 : indexOfFirst + 1} to {Math.min(indexOfLast, filteredParents.length)} of {filteredParents.length} entries
              </span>
              <ul className="pagination">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <li key={i} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                    <button onClick={() => handlePageChange(i + 1)} className="page-link">
                      {i + 1}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <ParentDetailsModal
          show={showModal}
          userid={selectedParentId}
          seed={seedRow}
          onClose={() => {
            setShowModal(false);
            setSelectedParentId(null);
            setSeedRow(null);
          }}
          onSave={(updated) => {
            handleSaved(updated);
            setShowModal(false);
            setSelectedParentId(null);
            setSeedRow(null);
          }}
        />
      )}

      {showRegisterParentModal && (
        <RegisterParentModal
          show={showRegisterParentModal}
          onClose={() => setShowRegisterParentModal(false)}
          onSave={async () => {
            setShowRegisterParentModal(false);
            setCurrentPage(1);
            await fetchParents();
          }}
        />
      )}

      {showChildrenModal && childrenModalData && (
        <div
          className="modal fade show d-block child-modal"
          tabIndex="-1"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Child{childrenModalData?.parentName ? ` - ${childrenModalData.parentName}` : ""}
                  {typeof childrenModalData?.count === "number" ? ` (${childrenModalData.count})` : ""}
                </h5>
                <button type="button" className="btn-close" onClick={closeChildrenModal}></button>
              </div>

              <div className="modal-body">
                {childrenModalData?.children?.length ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: "80px" }}>S.L</th>
                          <th style={{ width: "120px" }}>Child ID</th>
                          <th>Child Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {childrenModalData.children.map((c, i) => (
                          <tr key={`${c?.id ?? i}`}>
                            <td>{i + 1}</td>
                            <td>{c?.id || "-"}</td>
                            <td>{c?.name || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="child-empty-text">No Child Added Yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentListLayer;