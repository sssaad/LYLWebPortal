import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import Swal from "sweetalert2";
import { Icon } from "@iconify/react";
import { getToken } from "../api/getToken";

const BASE_HEADERS = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

const RUN_SP_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const UPDATE_DYNAMIC_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const STORED_PROCEDURE_NAME = "sp_get_group_class_inquiries";
const TABLE_NAME = "group_class_inquiries";

const STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Interested",
  "Not Interested",
  "Converted",
];

const formatDateTime = (value) => {
  if (!value) return "-";

  const m = moment(
    value,
    [
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DDTHH:mm:ss",
      "YYYY-MM-DD",
      moment.ISO_8601,
    ],
    true
  );

  if (m.isValid()) return m.format("DD MMM YYYY, hh:mm A");

  const loose = moment(value);
  return loose.isValid() ? loose.format("DD MMM YYYY, hh:mm A") : String(value);
};

const formatDateOnly = (value) => {
  if (!value) return "-";

  const m = moment(value, ["YYYY-MM-DD", moment.ISO_8601], true);
  return m.isValid() ? m.format("DD MMM YYYY") : String(value);
};

const safeJsonArray = (value) => {
  if (Array.isArray(value)) return value;

  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const formatArrayText = (value) => {
  const list = safeJsonArray(value);
  return list.length ? list.join(", ") : "-";
};

const getInitials = (value = "I") => {
  return String(value || "I")
    .trim()
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const getStatusClass = (status) => {
  const s = String(status || "").toLowerCase();

  if (s === "converted") return "bg-success-focus text-success-main";
  if (s === "contacted") return "bg-info-focus text-info-main";
  if (s === "interested") return "bg-warning-focus text-warning-main";
  if (s === "not interested") return "bg-danger-focus text-danger-main";
  if (s === "new") return "bg-primary-50 text-primary-600";

  return "bg-neutral-200 text-neutral-700";
};

const getStatusIcon = (status) => {
  const s = String(status || "").toLowerCase();

  if (s === "converted") return "mdi:account-check-outline";
  if (s === "contacted") return "mdi:phone-check-outline";
  if (s === "interested") return "mdi:star-outline";
  if (s === "not interested") return "mdi:account-cancel-outline";
  if (s === "new") return "mdi:clipboard-plus-outline";

  return "mdi:information-outline";
};

const TagList = ({ value, empty = "-" }) => {
  const list = safeJsonArray(value);

  if (!list.length) {
    return <span className="gci-muted-text">{empty}</span>;
  }

  return (
    <div className="gci-tags">
      {list.map((item, index) => (
        <span className="gci-tag" key={`${item}-${index}`}>
          {item}
        </span>
      ))}
    </div>
  );
};

const DetailItem = ({ icon, label, value, children }) => {
  return (
    <div className="gci-detail-item">
      <div className="gci-detail-icon">
        <Icon icon={icon} />
      </div>

      <div className="flex-grow-1 min-w-0">
        <p className="gci-detail-label">{label}</p>

        {children ? (
          children
        ) : (
          <p className="gci-detail-value">{value || "-"}</p>
        )}
      </div>
    </div>
  );
};

const GroupClassInquiriesLayer = () => {
  const [rows, setRows] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedRow, setSelectedRow] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const fetchRows = async () => {
    try {
      setInitialLoading(true);

      const token = await getToken();
      if (!token) throw new Error("Token not found");

      const headers = { ...BASE_HEADERS, token };

      const body = {
        procedureName: STORED_PROCEDURE_NAME,
        parameters: [],
      };

      const res = await axios.post(RUN_SP_URL, body, { headers });
      const data = res?.data?.data ?? [];

      if (Array.isArray(data)) {
        const mapped = data.map((item, index) => ({
          key: item.id ?? `row-${index}`,
          id: item.id ?? null,

          parentFullName: item.parent_full_name ?? "",
          parentEmail: item.parent_email ?? "",
          parentMobile: item.parent_mobile ?? "",
          preferredContactMethod: item.preferred_contact_method ?? "",

          studentName: item.student_name ?? "",
          yearGroup: item.year_group ?? "",
          schoolName: item.school_name ?? "",
          curriculumStudied: item.curriculum_studied ?? "",
          curriculumOther: item.curriculum_other ?? "",

          interestedSubjects: item.interested_subjects ?? "",
          interestedSubjectsOther: item.interested_subjects_other ?? "",
          mainGoal: item.main_goal ?? "",
          studentsGroupSize: item.students_group_size ?? "",
          alreadyHaveFriends: item.already_have_friends ?? "",
          friendsCount: item.friends_count ?? "",
          friendNames: item.friend_names ?? "",

          preferredDays: item.preferred_days ?? "",
          preferredTime: item.preferred_time ?? "",
          preferredStartDate: item.preferred_start_date ?? "",

          inquiryStatus: item.inquiry_status ?? "New",
          createdAt: item.created_at ?? "",
        }));

        setRows(mapped);
      } else {
        setRows([]);
      }

      setCurrentPage(1);
    } catch (error) {
      console.error(error);
      setRows([]);
      Swal.fire("Error", "Failed to load group class enquiries.", "error");
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;

    const fresh = rows.filter(
      (r) => String(r.inquiryStatus).toLowerCase() === "new"
    ).length;

    const contacted = rows.filter(
      (r) => String(r.inquiryStatus).toLowerCase() === "contacted"
    ).length;

    const converted = rows.filter(
      (r) => String(r.inquiryStatus).toLowerCase() === "converted"
    ).length;

    return {
      total,
      fresh,
      contacted,
      converted,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();

    return rows.filter((row) => {
      if (statusFilter && row.inquiryStatus !== statusFilter) return false;

      if (q) {
        const blob = `
          ${row.id ?? ""}
          ${row.parentFullName ?? ""}
          ${row.parentEmail ?? ""}
          ${row.parentMobile ?? ""}
          ${formatArrayText(row.preferredContactMethod)}
          ${row.studentName ?? ""}
          ${row.yearGroup ?? ""}
          ${row.schoolName ?? ""}
          ${row.curriculumStudied ?? ""}
          ${row.curriculumOther ?? ""}
          ${formatArrayText(row.interestedSubjects)}
          ${row.interestedSubjectsOther ?? ""}
          ${row.mainGoal ?? ""}
          ${row.studentsGroupSize ?? ""}
          ${row.alreadyHaveFriends ?? ""}
          ${row.friendsCount ?? ""}
          ${formatArrayText(row.friendNames)}
          ${formatArrayText(row.preferredDays)}
          ${row.preferredTime ?? ""}
          ${row.preferredStartDate ?? ""}
          ${row.inquiryStatus ?? ""}
          ${row.createdAt ?? ""}
        `
          .toLowerCase()
          .trim();

        if (!blob.includes(q)) return false;
      }

      return true;
    });
  }, [rows, search, statusFilter]);

  const totalPages = Math.ceil(filteredRows.length / perPage) || 1;
  const indexOfLast = currentPage * perPage;
  const indexOfFirst = indexOfLast - perPage;
  const currentRows = filteredRows.slice(indexOfFirst, indexOfLast);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  const handleStatusUpdate = async (row, newStatus) => {
    if (!row?.id) {
      return Swal.fire("Error", "Enquiry ID is missing.", "error");
    }

    if (!newStatus || newStatus === row.inquiryStatus) return;

    const confirm = await Swal.fire({
      title: "Update Status?",
      text: `Do you want to update this enquiry status to "${newStatus}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Update",
      cancelButtonText: "Cancel",
      customClass: {
        container: "gci-swal-container",
      },
    });

    if (!confirm.isConfirmed) return;

    try {
      setUpdatingId(row.id);

      const token = await getToken();
      if (!token) throw new Error("Token not found");

      Swal.fire({
        title: "Updating...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        customClass: {
          container: "gci-swal-container",
        },
      });

      const payload = {
        token,
        tablename: TABLE_NAME,
        conditions: [{ id: Number(row.id) }],
        updatedata: [
          {
            inquiry_status: newStatus,
          },
        ],
      };

      const res = await axios.post(UPDATE_DYNAMIC_URL, payload, {
        headers: BASE_HEADERS,
      });

      const ok = res?.data?.statusCode === 200;

      if (!ok) {
        return Swal.fire({
          icon: "error",
          title: "Error",
          text: res?.data?.message || "Failed to update inquiry status.",
          customClass: {
            container: "gci-swal-container",
          },
        });
      }

      setRows((prev) =>
        prev.map((item) =>
          Number(item.id) === Number(row.id)
            ? { ...item, inquiryStatus: newStatus }
            : item
        )
      );

      setSelectedRow((prev) =>
        prev && Number(prev.id) === Number(row.id)
          ? { ...prev, inquiryStatus: newStatus }
          : prev
      );

      Swal.fire({
        icon: "success",
        title: "Updated!",
        text: "Enquiry status updated successfully.",
        timer: 1300,
        showConfirmButton: false,
        customClass: {
          container: "gci-swal-container",
        },
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Something went wrong while updating inquiry status.",
        customClass: {
          container: "gci-swal-container",
        },
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSoftDelete = async (row) => {
    if (!row?.id) {
      return Swal.fire("Error", "Enquiry ID is missing.", "error");
    }

    const confirm = await Swal.fire({
      title: "Delete Enquiry?",
      text: "Are you sure you want to delete this enquiry?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc3545",
      customClass: {
        container: "gci-swal-container",
      },
    });

    if (!confirm.isConfirmed) return;

    try {
      setDeletingId(row.id);

      const token = await getToken();
      if (!token) throw new Error("Token not found");

      Swal.fire({
        title: "Deleting...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        customClass: {
          container: "gci-swal-container",
        },
      });

      const payload = {
        token,
        tablename: TABLE_NAME,
        conditions: [{ id: Number(row.id) }],
        updatedata: [
          {
            deleted: 1,
            deleted_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
        ],
      };

      const res = await axios.post(UPDATE_DYNAMIC_URL, payload, {
        headers: BASE_HEADERS,
      });

      const ok = res?.data?.statusCode === 200;

      if (!ok) {
        return Swal.fire({
          icon: "error",
          title: "Error",
          text: res?.data?.message || "Failed to delete inquiry.",
          customClass: {
            container: "gci-swal-container",
          },
        });
      }

      setRows((prev) =>
        prev.filter((item) => Number(item.id) !== Number(row.id))
      );

      setSelectedRow(null);

      Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Enquiry deleted successfully.",
        timer: 1300,
        showConfirmButton: false,
        customClass: {
          container: "gci-swal-container",
        },
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Something went wrong while deleting inquiry.",
        customClass: {
          container: "gci-swal-container",
        },
      });
    } finally {
      setDeletingId(null);
    }
  };

  const statCards = [
    {
      title: "Total Enquiries",
      value: stats.total,
      icon: "mdi:clipboard-list-outline",
      className: "bg-primary-50 text-primary-600",
    },
    {
      title: "New Enquiries",
      value: stats.fresh,
      icon: "mdi:clipboard-plus-outline",
      className: "bg-primary-50 text-primary-600",
    },
    {
      title: "Contacted",
      value: stats.contacted,
      icon: "mdi:phone-check-outline",
      className: "bg-info-focus text-info-main",
    },
    {
      title: "Converted",
      value: stats.converted,
      icon: "mdi:account-check-outline",
      className: "bg-success-focus text-success-main",
    },
  ];

  if (initialLoading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: "300px" }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "6px solid #e0e0e0",
            borderTop: "6px solid #45B369",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
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
    <div className="row gy-4">
      <style>{`
        .gci-page {
          --gci-primary: #487fff;
          --gci-soft: rgba(72,127,255,.10);
          --gci-border: rgba(0,0,0,.07);
        }

        .gci-swal-container,
        .swal2-container {
          z-index: 30000 !important;
        }

        .swal2-popup {
          border-radius: 18px !important;
        }

        .gci-card {
          border: 1px solid var(--gci-border);
          border-radius: 20px;
          box-shadow: 0 12px 36px rgba(15, 23, 42, .045);
          overflow: hidden;
          background: var(--white);
        }

        .gci-stat-card {
          border-radius: 18px;
          border: 1px solid var(--gci-border);
          background: var(--white);
          padding: 18px;
          height: 100%;
          transition: all .22s ease;
        }

        .gci-stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 36px rgba(15, 23, 42, .075);
        }

        .gci-stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
        }

        .gci-toolbar {
          background:
            radial-gradient(circle at top left, rgba(72,127,255,.14), transparent 34%),
            linear-gradient(180deg, rgba(72,127,255,.055), rgba(72,127,255,0));
          border-bottom: 1px solid var(--gci-border);
          padding: 20px;
        }

        .gci-title-icon {
          width: 44px;
          height: 44px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gci-soft);
          color: var(--gci-primary);
          font-size: 24px;
          flex: 0 0 auto;
        }

        .gci-search-wrap {
          position: relative;
        }

        .gci-search-wrap .gci-search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          opacity: .6;
          font-size: 18px;
        }

        .gci-search-wrap input {
          padding-left: 42px;
          border-radius: 12px;
        }

        .gci-table {
          min-width: 1120px;
        }

        .gci-table thead th {
          background: rgba(0,0,0,.022);
          font-size: 14px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .02em;
          color: var(--text-primary-light);
          white-space: nowrap;
          padding-top: 15px;
          padding-bottom: 15px;
        }

        .gci-table tbody td {
          vertical-align: middle;
          padding-top: 14px;
          padding-bottom: 14px;
          font-size: 14px;
          color: var(--text-primary-light);
        }

        .gci-avatar {
          width: 42px;
          height: 42px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          background: var(--gci-soft);
          color: var(--gci-primary);
          flex: 0 0 auto;
          font-size: 14px;
        }

        .gci-parent-card {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 230px;
        }

        .gci-main-title {
          font-weight: 800;
          color: var(--text-primary-light);
          line-height: 1.3;
          font-size: 15px;
        }

        .gci-sub {
          color: var(--text-secondary-light);
          font-size: 13px;
          line-height: 1.45;
          font-weight: 500;
        }

        .gci-sub strong {
          font-weight: 800;
        }

        .gci-contact-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: inherit;
          text-decoration: none;
          max-width: 240px;
          font-size: 13px;
        }

        .gci-contact-link:hover {
          color: var(--gci-primary);
        }

        .gci-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .gci-tag {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 10px;
          background: rgba(72,127,255,.10);
          color: #487fff;
          font-weight: 800;
          font-size: 12px;
          line-height: 1.2;
          white-space: nowrap;
          border: 1px solid rgba(72,127,255,.12);
        }

        [data-theme="dark"] .gci-tag,
        .dark .gci-tag,
        body.dark .gci-tag {
          background: rgba(72,127,255,.16);
          color: #9bb7ff;
          border-color: rgba(124,162,255,.18);
        }

        .gci-muted-text {
          color: var(--text-secondary-light);
          font-size: 13px;
        }

        .gci-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 11px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .gci-id-badge {
          border-radius: 999px;
          padding: 6px 11px;
          background: rgba(0,0,0,.045);
          font-weight: 800;
          font-size: 13px;
        }

        .gci-empty {
          padding: 60px 16px;
          text-align: center;
        }

        .gci-empty-icon {
          width: 74px;
          height: 74px;
          border-radius: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--gci-soft);
          color: var(--gci-primary);
          font-size: 38px;
          margin-bottom: 14px;
        }

        .gci-action-select {
          min-width: 145px;
          border-radius: 11px;
          font-size: 14px;
          font-weight: 600;
          height: 42px;
        }

        .gci-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(0,0,0,.08);
          background: var(--white);
          transition: all .2s ease;
        }

        .gci-icon-btn:hover {
          transform: translateY(-1px);
        }

        .gci-icon-btn.view {
          color: var(--gci-primary);
          background: var(--gci-soft);
          border-color: rgba(72,127,255,.18);
        }

        .gci-icon-btn.delete {
          color: #dc3545;
          background: rgba(220,53,69,.08);
          border-color: rgba(220,53,69,.16);
        }

        .gci-footer {
          padding: 18px 24px 24px;
          min-height: 76px;
          font-size: 14px;
        }

        .gci-footer .text-secondary-light {
          font-size: 14px;
        }

        .gci-card .pagination .page-link {
          min-width: 36px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-color: rgba(0,0,0,.08);
          font-weight: 700;
          font-size: 14px;
          box-shadow: none;
        }

        .gci-card .pagination .page-item.active .page-link {
          background: var(--gci-primary);
          border-color: var(--gci-primary);
          color: #fff;
        }

        .gci-toolbar h6 {
          font-size: 20px;
          font-weight: 800;
        }

        .gci-toolbar .text-sm {
          font-size: 14px !important;
        }

        .gci-toolbar .form-label {
          font-size: 14px;
        }

        .gci-toolbar .form-control,
        .gci-toolbar .form-select,
        .gci-toolbar .btn {
          font-size: 15px;
          min-height: 44px;
        }

        .gci-table .fw-semibold {
          font-size: 14px;
          line-height: 1.45;
        }

        .gci-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, .62);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          justify-content: flex-end;
          padding: 0;
        }

        .gci-side-panel {
          width: min(760px, 100%);
          height: 100dvh;
          background: var(--white);
          color: var(--text-primary-light);
          box-shadow: -24px 0 60px rgba(15, 23, 42, .28);
          display: flex;
          flex-direction: column;
          animation: gciSlideIn .24s ease-out;
          border-left: 1px solid rgba(255,255,255,.08);
        }

        [data-theme="dark"] .gci-side-panel,
        .dark .gci-side-panel,
        body.dark .gci-side-panel {
          background: #101827;
          color: #e5e7eb;
        }

        @keyframes gciSlideIn {
          from { transform: translateX(45px); opacity: .55; }
          to { transform: translateX(0); opacity: 1; }
        }

        .gci-panel-header {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(148,163,184,.18);
          background:
            radial-gradient(circle at top left, rgba(72,127,255,.24), transparent 36%),
            linear-gradient(135deg, #1d2b46 0%, #111827 100%);
          color: #fff;
          flex: 0 0 auto;
        }

        .gci-panel-header .text-secondary-light {
          color: rgba(255,255,255,.72) !important;
        }

        .gci-panel-header .gci-title-icon {
          background: rgba(255,255,255,.12);
          color: #fff;
        }

        .gci-panel-title {
          font-size: 20px;
          line-height: 1.25;
          font-weight: 900;
          color: #fff;
          margin: 0;
        }

        .gci-panel-body {
          overflow-y: auto;
          padding: 18px;
          flex: 1 1 auto;
          min-height: 0;
          background: #f5f7fb;
          padding-bottom: 96px;
        }

        [data-theme="dark"] .gci-panel-body,
        .dark .gci-panel-body,
        body.dark .gci-panel-body {
          background: #0f172a;
        }

        .gci-panel-footer {
          border-top: 1px solid rgba(148,163,184,.18);
          padding: 12px 18px;
          background: var(--white);
          flex: 0 0 auto;
          box-shadow: 0 -12px 30px rgba(15, 23, 42, .08);
          position: sticky;
          bottom: 0;
          z-index: 5;
        }

        [data-theme="dark"] .gci-panel-footer,
        .dark .gci-panel-footer,
        body.dark .gci-panel-footer {
          background: #111827;
          border-top-color: rgba(255,255,255,.08);
        }

        .gci-close-btn {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.10);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          transition: all .2s ease;
        }

        .gci-close-btn:hover {
          background: rgba(255,255,255,.18);
          transform: rotate(90deg);
        }

        .gci-detail-section {
          background: var(--white);
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 18px;
          padding: 14px;
          margin-bottom: 14px;
          box-shadow: 0 10px 30px rgba(15,23,42,.045);
        }

        [data-theme="dark"] .gci-detail-section,
        .dark .gci-detail-section,
        body.dark .gci-detail-section {
          background: #1e293b;
          border-color: rgba(255,255,255,.08);
          box-shadow: 0 16px 38px rgba(0,0,0,.20);
        }

        .gci-section-title {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 15px;
          line-height: 1.25;
          font-weight: 900;
          margin-bottom: 12px;
          color: var(--text-primary-light);
        }

        [data-theme="dark"] .gci-section-title,
        .dark .gci-section-title,
        body.dark .gci-section-title {
          color: #fff;
        }

        .gci-section-title span {
          width: 32px;
          height: 32px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(72,127,255,.12);
          color: #487fff;
          font-size: 18px;
        }

        [data-theme="dark"] .gci-section-title span,
        .dark .gci-section-title span,
        body.dark .gci-section-title span {
          background: rgba(72,127,255,.18);
          color: #7ca2ff;
        }

        .gci-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .gci-detail-item {
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 15px;
          background: #fff;
          padding: 11px;
          display: flex;
          gap: 9px;
          min-height: 70px;
          transition: all .18s ease;
        }

        .gci-detail-item:hover {
          border-color: rgba(72,127,255,.28);
          box-shadow: 0 10px 24px rgba(72,127,255,.06);
        }

        [data-theme="dark"] .gci-detail-item,
        .dark .gci-detail-item,
        body.dark .gci-detail-item {
          background: #111827;
          border-color: rgba(255,255,255,.08);
        }

        [data-theme="dark"] .gci-detail-item:hover,
        .dark .gci-detail-item:hover,
        body.dark .gci-detail-item:hover {
          border-color: rgba(124,162,255,.35);
          box-shadow: 0 12px 28px rgba(0,0,0,.20);
        }

        .gci-detail-icon {
          width: 32px;
          height: 32px;
          border-radius: 11px;
          background: rgba(72,127,255,.10);
          color: #487fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          flex: 0 0 auto;
        }

        [data-theme="dark"] .gci-detail-icon,
        .dark .gci-detail-icon,
        body.dark .gci-detail-icon {
          background: rgba(72,127,255,.18);
          color: #7ca2ff;
        }

        .gci-panel-submitted {
          margin: 6px 0 0;
          display: flex;
          align-items: center;
          gap: 6px;
          color: rgba(255, 255, 255, .72);
          font-size: 13px;
          line-height: 1.2;
          font-weight: 600;
        }

        .gci-panel-submitted svg {
          width: 14px;
          height: 14px;
          flex: 0 0 auto;
          transform: translateY(-.5px);
        }

        .gci-detail-label {
          color: var(--text-secondary-light);
          font-size: 10.5px;
          margin-bottom: 4px;
          font-weight: 800;
          line-height: 1.2;
        }

        [data-theme="dark"] .gci-detail-label,
        .dark .gci-detail-label,
        body.dark .gci-detail-label {
          color: rgba(226,232,240,.62);
        }

        .gci-detail-value {
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 0;
          line-height: 1.35;
          color: var(--text-primary-light);
          word-break: break-word;
        }

        [data-theme="dark"] .gci-detail-value,
        .dark .gci-detail-value,
        body.dark .gci-detail-value {
          color: #f8fafc;
        }

        .gci-note-box {
          background: #f8fafc;
          border: 1px dashed rgba(72,127,255,.28);
          border-radius: 15px;
          padding: 11px 13px;
          color: var(--text-secondary-light);
          line-height: 1.45;
          font-size: 12.5px;
        }

        [data-theme="dark"] .gci-note-box,
        .dark .gci-note-box,
        body.dark .gci-note-box {
          background: #111827;
          border-color: rgba(124,162,255,.28);
          color: rgba(226,232,240,.78);
        }

        .gci-panel-body::-webkit-scrollbar {
          width: 8px;
        }

        .gci-panel-body::-webkit-scrollbar-track {
          background: rgba(148,163,184,.12);
        }

        .gci-panel-body::-webkit-scrollbar-thumb {
          background: rgba(72,127,255,.55);
          border-radius: 999px;
        }

        .gci-panel-body::-webkit-scrollbar-thumb:hover {
          background: rgba(72,127,255,.85);
        }

        /* Right side modal compact text */
        .gci-side-panel .gci-section-title {
          font-size: 15px;
        }

        .gci-side-panel .gci-detail-label {
          font-size: 10.5px;
        }

        .gci-side-panel .gci-detail-value {
          font-size: 13px;
        }

        .gci-side-panel .gci-tag {
          font-size: 11px;
          padding: 4px 9px;
        }

        .gci-side-panel .gci-sub {
          font-size: 12px;
          line-height: 1.45;
        }

        .gci-side-panel .gci-muted-text {
          font-size: 12px;
        }

        .gci-side-panel .gci-status-pill {
          font-size: 11px;
          padding: 5px 10px;
        }

        .gci-side-panel .gci-note-box {
          font-size: 12.5px;
        }

        .gci-side-panel .gci-action-select {
          font-size: 13px;
          min-height: 40px;
          height: 40px;
        }

        @media (max-width: 767px) {
          .gci-toolbar {
            padding: 16px;
          }

          .gci-stat-card {
            padding: 15px;
          }

          .gci-footer {
            padding: 16px;
          }

          .gci-side-panel {
            width: 100%;
          }

          .gci-panel-header {
            padding: 16px;
          }

          .gci-panel-title {
            font-size: 18px;
          }

          .gci-panel-body {
            padding: 14px;
            padding-bottom: 110px;
          }

          .gci-panel-footer {
            padding: 12px 14px;
          }

          .gci-detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="gci-page col-12">
        <div className="row gy-3">
          {statCards.map((card) => (
            <div className="col-xxl-3 col-sm-6" key={card.title}>
              <div className="gci-stat-card">
                <div className="d-flex align-items-center justify-content-between gap-3">
                  <div>
                    <span className="text-secondary-light text-sm fw-semibold">
                      {card.title}
                    </span>
                    <h4 className="mb-0 mt-1">{card.value}</h4>
                  </div>

                  <div className={`gci-stat-icon ${card.className}`}>
                    <Icon icon={card.icon} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="gci-page col-xxl-12">
        <div className="card gci-card h-100 p-0">
          <div className="gci-toolbar">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div className="d-flex align-items-center gap-3">
                <div className="gci-title-icon">
                  <Icon icon="mdi:account-question-outline" />
                </div>

                <div>
                  <h6 className="mb-1">Group Class Enquiries</h6>
                  <p className="mb-0 text-secondary-light text-sm">
                    Manage group class enquiries from the website.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline-primary d-inline-flex align-items-center gap-2"
                onClick={fetchRows}
              >
                <Icon icon="mdi:refresh" />
                Refresh
              </button>
            </div>

            <div className="row gy-2 align-items-end">
              <div className="col-lg-6">
                <label className="form-label fw-semibold">Search</label>
                <div className="gci-search-wrap">
                  <Icon icon="mdi:magnify" className="gci-search-icon" />
                  <input
                    className="form-control"
                    placeholder="Search by parent, student, email, phone, school, subject..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-lg-3 col-md-6">
                <label className="form-label fw-semibold">Status</label>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-lg-3 col-md-6">
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table gci-table bordered-table mb-0">
                <thead>
                  <tr>
                    <th className="text-center">ID</th>
                    <th>Parent</th>
                    <th>Student</th>
                    <th>Subjects</th>
                    <th>Schedule</th>
                    <th className="text-center">Status</th>
                    <th>Submitted</th>
                    <th className="text-center">Change Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {currentRows.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="gci-empty">
                          <div className="gci-empty-icon">
                            <Icon icon="mdi:clipboard-search-outline" />
                          </div>
                          <h6 className="mb-1">
                            No group class enquiries found
                          </h6>
                          <p className="mb-0 text-secondary-light">
                            Try changing your search or status filter.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((row) => {
                      const isBusy =
                        Number(updatingId) === Number(row.id) ||
                        Number(deletingId) === Number(row.id);

                      return (
                        <tr key={row.key}>
                          <td className="text-center">
                            <span className="gci-id-badge">#{row.id}</span>
                          </td>

                          <td>
                            <div className="gci-parent-card">
                              <div className="gci-avatar">
                                {getInitials(row.parentFullName)}
                              </div>

                              <div>
                                <div className="gci-main-title">
                                  {row.parentFullName || "-"}
                                </div>

                                <a
                                  className="gci-contact-link gci-sub"
                                  href={
                                    row.parentEmail
                                      ? `mailto:${row.parentEmail}`
                                      : undefined
                                  }
                                >
                                  <Icon icon="mdi:email-outline" />
                                  {row.parentEmail || "-"}
                                </a>

                                <br />

                                <a
                                  className="gci-contact-link gci-sub"
                                  href={
                                    row.parentMobile
                                      ? `tel:${row.parentMobile}`
                                      : undefined
                                  }
                                >
                                  <Icon icon="mdi:phone-outline" />
                                  {row.parentMobile || "-"}
                                </a>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="gci-main-title">
                              {row.studentName || "-"}
                            </div>
                            <div className="gci-sub">
                              {row.yearGroup || "-"} • {row.schoolName || "-"}
                            </div>
                            <div className="gci-sub">
                              Curriculum:{" "}
                              <strong>
                                {row.curriculumStudied || "-"}
                                {String(
                                  row.curriculumStudied || ""
                                ).toLowerCase() === "other" &&
                                row.curriculumOther
                                  ? ` (${row.curriculumOther})`
                                  : ""}
                              </strong>
                            </div>
                          </td>

                          <td>
                            <TagList value={row.interestedSubjects} />

                            {row.interestedSubjectsOther ? (
                              <div className="gci-sub mt-2">
                                Other:{" "}
                                <strong>{row.interestedSubjectsOther}</strong>
                              </div>
                            ) : null}
                          </td>

                          <td>
                            <div className="gci-sub">
                              <Icon
                                icon="mdi:calendar-outline"
                                className="me-1"
                              />
                              {formatArrayText(row.preferredDays)}
                            </div>

                            <div className="gci-sub mt-1">
                              <Icon
                                icon="mdi:clock-outline"
                                className="me-1"
                              />
                              {row.preferredTime || "-"}
                            </div>

                            <div className="gci-sub mt-1">
                              <Icon
                                icon="mdi:calendar-start-outline"
                                className="me-1"
                              />
                              {formatDateOnly(row.preferredStartDate)}
                            </div>
                          </td>

                          <td className="text-center">
                            <span
                              className={`gci-status-pill ${getStatusClass(
                                row.inquiryStatus
                              )}`}
                            >
                              <Icon icon={getStatusIcon(row.inquiryStatus)} />
                              {row.inquiryStatus || "-"}
                            </span>
                          </td>

                          <td>
                            <div className="fw-semibold">
                              {formatDateTime(row.createdAt)}
                            </div>
                          </td>

                          <td className="text-center">
                            <select
                              className="form-select form-select-sm gci-action-select mx-auto"
                              value={row.inquiryStatus || ""}
                              disabled={isBusy}
                              onChange={(e) =>
                                handleStatusUpdate(row, e.target.value)
                              }
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="text-center">
                            <div className="d-inline-flex align-items-center justify-content-center gap-2">
                              <button
                                type="button"
                                className="gci-icon-btn view"
                                onClick={() => setSelectedRow(row)}
                                title="View Details"
                              >
                                <Icon icon="mdi:eye-outline" />
                              </button>

                              <button
                                type="button"
                                className="gci-icon-btn delete"
                                onClick={() => handleSoftDelete(row)}
                                disabled={isBusy}
                                title="Delete Enquiry"
                              >
                                <Icon icon="mdi:trash-can-outline" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="gci-footer d-flex flex-wrap justify-content-between align-items-center gap-2">
              <span className="text-secondary-light fw-medium">
                Showing {filteredRows.length === 0 ? 0 : indexOfFirst + 1} to{" "}
                {Math.min(indexOfLast, filteredRows.length)} of{" "}
                {filteredRows.length} entries
              </span>

              <ul className="pagination mb-0">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <li
                    key={i}
                    className={`page-item ${
                      currentPage === i + 1 ? "active" : ""
                    }`}
                  >
                    <button
                      onClick={() => setCurrentPage(i + 1)}
                      className="page-link"
                    >
                      {i + 1}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {selectedRow && (
        <div
          className="gci-modal-backdrop"
          onClick={() => setSelectedRow(null)}
        >
          <div className="gci-side-panel" onClick={(e) => e.stopPropagation()}>
            <div className="gci-panel-header">
              <div className="d-flex align-items-start justify-content-between gap-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="gci-title-icon">
                    <Icon icon="mdi:account-question-outline" />
                  </div>

                  <div>
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                      <h5 className="gci-panel-title">
                        Enquiry #{selectedRow.id}
                      </h5>

                      <span
                        className={`gci-status-pill ${getStatusClass(
                          selectedRow.inquiryStatus
                        )}`}
                      >
                        <Icon icon={getStatusIcon(selectedRow.inquiryStatus)} />
                        {selectedRow.inquiryStatus}
                      </span>
                    </div>

                    <p className="gci-panel-submitted">
                      <Icon icon="mdi:clock-outline" />
                      <span>
                        Submitted on {formatDateTime(selectedRow.createdAt)}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="gci-close-btn"
                  onClick={() => setSelectedRow(null)}
                >
                  <Icon icon="mdi:close" />
                </button>
              </div>
            </div>

            <div className="gci-panel-body">
              <div className="gci-detail-section">
                <h6 className="gci-section-title">
                  <span>
                    <Icon icon="mdi:account-outline" />
                  </span>
                  Parent Information
                </h6>

                <div className="gci-detail-grid">
                  <DetailItem
                    icon="mdi:account-outline"
                    label="Parent Full Name"
                    value={selectedRow.parentFullName}
                  />

                  <DetailItem
                    icon="mdi:email-outline"
                    label="Email Address"
                    value={selectedRow.parentEmail}
                  />

                  <DetailItem
                    icon="mdi:phone-outline"
                    label="Mobile Number"
                    value={selectedRow.parentMobile}
                  />

                  <DetailItem
                    icon="mdi:message-processing-outline"
                    label="Preferred Contact Method"
                  >
                    <TagList value={selectedRow.preferredContactMethod} />
                  </DetailItem>
                </div>
              </div>

              <div className="gci-detail-section">
                <h6 className="gci-section-title">
                  <span>
                    <Icon icon="mdi:school-outline" />
                  </span>
                  Student Information
                </h6>

                <div className="gci-detail-grid">
                  <DetailItem
                    icon="mdi:account-child-outline"
                    label="Student Name"
                    value={selectedRow.studentName}
                  />

                  <DetailItem
                    icon="mdi:book-education-outline"
                    label="Year Group"
                    value={selectedRow.yearGroup}
                  />

                  <DetailItem
                    icon="mdi:domain"
                    label="School Name"
                    value={selectedRow.schoolName}
                  />

                  <DetailItem
                    icon="mdi:book-open-page-variant-outline"
                    label="Curriculum Studied"
                    value={`${selectedRow.curriculumStudied || "-"}${
                      String(
                        selectedRow.curriculumStudied || ""
                      ).toLowerCase() === "other" && selectedRow.curriculumOther
                        ? ` (${selectedRow.curriculumOther})`
                        : ""
                    }`}
                  />
                </div>
              </div>

              <div className="gci-detail-section">
                <h6 className="gci-section-title">
                  <span>
                    <Icon icon="mdi:book-outline" />
                  </span>
                  Group Class Requirements
                </h6>

                <div className="gci-detail-grid mb-3">
                  <DetailItem icon="mdi:bookshelf" label="Interested Subjects">
                    <TagList value={selectedRow.interestedSubjects} />
                    {selectedRow.interestedSubjectsOther ? (
                      <div className="gci-sub mt-2">
                        Other:{" "}
                        <strong>{selectedRow.interestedSubjectsOther}</strong>
                      </div>
                    ) : null}
                  </DetailItem>

                  <DetailItem
                    icon="mdi:account-group-outline"
                    label="Preferred Group Size"
                    value={selectedRow.studentsGroupSize}
                  />

                  <DetailItem
                    icon="mdi:account-multiple-plus-outline"
                    label="Already Have Friends"
                    value={selectedRow.alreadyHaveFriends}
                  />

                  <DetailItem
                    icon="mdi:counter"
                    label="Friends Count"
                    value={
                      String(
                        selectedRow.alreadyHaveFriends || ""
                      ).toLowerCase() === "yes"
                        ? selectedRow.friendsCount || "0"
                        : "-"
                    }
                  />
                </div>

                {String(selectedRow.alreadyHaveFriends || "").toLowerCase() ===
                "yes" ? (
                  <div className="mb-3">
                    <p className="gci-detail-label">Friend Names</p>
                    <TagList value={selectedRow.friendNames} />
                  </div>
                ) : null}

                <p className="gci-detail-label">Main Goal</p>
                <div className="gci-note-box">
                  {selectedRow.mainGoal || "-"}
                </div>
              </div>

              <div className="gci-detail-section">
                <h6 className="gci-section-title">
                  <span>
                    <Icon icon="mdi:calendar-clock-outline" />
                  </span>
                  Scheduling
                </h6>

                <div className="gci-detail-grid">
                  <DetailItem
                    icon="mdi:calendar-week-outline"
                    label="Preferred Days"
                  >
                    <TagList value={selectedRow.preferredDays} />
                  </DetailItem>

                  <DetailItem
                    icon="mdi:clock-outline"
                    label="Preferred Time"
                    value={selectedRow.preferredTime}
                  />

                  <DetailItem
                    icon="mdi:calendar-start-outline"
                    label="Preferred Start Date"
                    value={formatDateOnly(selectedRow.preferredStartDate)}
                  />

                  <DetailItem
                    icon="mdi:clock-check-outline"
                    label="Submitted On"
                    value={formatDateTime(selectedRow.createdAt)}
                  />
                </div>
              </div>
            </div>

            <div className="gci-panel-footer">
              <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
                <div>
                  <label className="form-label fw-semibold mb-1">
                    Update Status
                  </label>
                  <select
                    className="form-select gci-action-select"
                    value={selectedRow.inquiryStatus || ""}
                    disabled={Number(updatingId) === Number(selectedRow.id)}
                    onChange={(e) =>
                      handleStatusUpdate(selectedRow, e.target.value)
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="d-flex gap-2 ms-auto">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setSelectedRow(null)}
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-danger d-inline-flex align-items-center gap-2"
                    onClick={() => handleSoftDelete(selectedRow)}
                    disabled={Number(deletingId) === Number(selectedRow.id)}
                  >
                    <Icon icon="mdi:trash-can-outline" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupClassInquiriesLayer;