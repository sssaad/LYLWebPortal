import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment-timezone";
import Swal from "sweetalert2";
import { Icon } from "@iconify/react";
import { getToken } from "../api/getToken";

const RUN_STORED_PROCEDURE_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const ADD_DYNAMIC_DATA_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=add_dynamic_data";

const UPDATE_DYNAMIC_DATA_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const API_HEADERS = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

const TABLE_NAME = "group_weekly_timetable";
const TIMETABLE_SP = "sp_get_group_weekly_timetable";
const PROGRAMMES_SP = "sp_get_group_live_programmes";

const DEFAULT_TIMEZONE_ID = 7;
const DEFAULT_TIMEZONE_LOCATION = "Asia/Dubai";

const DAYS = [
  { id: 1, name: "Monday", short: "Mon" },
  { id: 2, name: "Tuesday", short: "Tue" },
  { id: 3, name: "Wednesday", short: "Wed" },
  { id: 4, name: "Thursday", short: "Thu" },
  { id: 5, name: "Friday", short: "Fri" },
  { id: 6, name: "Saturday", short: "Sat" },
  { id: 7, name: "Sunday", short: "Sun" },
];

const resolveToken = (tokenRes) => {
  if (typeof tokenRes === "string") return tokenRes;

  return (
    tokenRes?.token ||
    tokenRes?.data?.token ||
    tokenRes?.data?.data?.token ||
    tokenRes?.access_token ||
    tokenRes?.data?.access_token ||
    ""
  );
};

const extractRows = (response) => {
  const candidates = [
    response,
    response?.data,
    response?.data?.data,
    response?.result,
    response?.data?.result,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
};

const normaliseTime = (value = "") => {
  const clean = String(value || "").split(".")[0].trim();
  if (!clean) return "";

  const parsed = moment(clean, ["HH:mm:ss", "HH:mm", "hh:mm A"], true);
  return parsed.isValid() ? parsed.format("HH:mm:ss") : clean;
};

const toInputTime = (value = "") => {
  const clean = String(value || "").split(".")[0].trim();
  if (!clean) return "";

  const parsed = moment(clean, ["HH:mm:ss", "HH:mm", "hh:mm A"], true);
  return parsed.isValid() ? parsed.format("HH:mm") : clean.slice(0, 5);
};

const formatTime = (value) => {
  if (!value) return "-";

  const clean = String(value || "").split(".")[0];
  const parsed = moment(clean, ["HH:mm:ss", "HH:mm"], true);

  return parsed.isValid() ? parsed.format("hh:mm A") : clean;
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const parsed = moment(value, ["YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD"], true);
  return parsed.isValid() ? parsed.format("DD MMM YYYY, hh:mm A") : value;
};

const getDayName = (dayId) => {
  return DAYS.find((d) => Number(d.id) === Number(dayId))?.name || "-";
};

const getStatusBadge = (value) => {
  return Number(value) === 1
    ? "bg-success-focus text-success-main"
    : "bg-danger-focus text-danger-main";
};

const getInitialForm = () => ({
  id: null,
  programme_id: "",
  day_of_week: "",
  slot_start: "",
  slot_end: "",
  timezoneid: DEFAULT_TIMEZONE_ID,
  timezone_location: DEFAULT_TIMEZONE_LOCATION,
  is_active: 1,
  sort_order: 0,
});

const WeeklyTimetablePortalLayer = () => {
  const [rows, setRows] = useState([]);
  const [programmes, setProgrammes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [programmeLoading, setProgrammeLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [viewMode, setViewMode] = useState("calendar");
  const [searchTerm, setSearchTerm] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [form, setForm] = useState(getInitialForm());

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const buildHeaders = async () => {
    const tokenRes = await getToken();
    const token = resolveToken(tokenRes);

    return {
      ...API_HEADERS,
      ...(token ? { token } : {}),
    };
  };

  const getTokenValue = async () => {
    const tokenRes = await getToken();
    return resolveToken(tokenRes);
  };

  const fetchTimetable = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const headers = await buildHeaders();

      const response = await axios.post(
        RUN_STORED_PROCEDURE_URL,
        {
          procedureName: TIMETABLE_SP,
          parameters: [],
        },
        { headers }
      );

      if (Number(response?.data?.statusCode) !== 200) {
        throw new Error(
          response?.data?.message || "Weekly timetable load failed."
        );
      }

      const list = extractRows(response.data);

      setRows(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Weekly timetable load failed:", error);
      setRows([]);
      setLoadError(error?.message || "Weekly timetable load failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProgrammes = useCallback(async () => {
    setProgrammeLoading(true);

    try {
      const headers = await buildHeaders();

      const response = await axios.post(
        RUN_STORED_PROCEDURE_URL,
        {
          procedureName: PROGRAMMES_SP,
          parameters: [],
        },
        { headers }
      );

      const list = extractRows(response.data);

      const map = new Map();

      (Array.isArray(list) ? list : []).forEach((item) => {
        const id = item?.programme_id || item?.id;
        const name = item?.programme_name || item?.name;

        if (!id || !name) return;

        if (!map.has(String(id))) {
          map.set(String(id), {
            id,
            name,
            stage: item?.programme_stage || item?.stage || "",
          });
        }
      });

      setProgrammes(Array.from(map.values()));
    } catch (error) {
      console.error("Programmes load failed:", error);
      setProgrammes([]);
    } finally {
      setProgrammeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimetable();
    fetchProgrammes();
  }, [fetchTimetable, fetchProgrammes]);

  const filteredRows = useMemo(() => {
    const search = String(searchTerm || "").toLowerCase().trim();
    const selectedDay = String(dayFilter || "").trim();
    const selectedStatus = String(statusFilter || "").trim();

    return (rows || []).filter((item) => {
      const fullText = [
        item?.id,
        item?.programme_id,
        item?.programme_name,
        item?.programme_stage,
        item?.day_name,
        item?.slot_start,
        item?.slot_end,
        item?.timezone_location,
        item?.timezoneid,
        item?.sort_order,
      ]
        .join(" ")
        .toLowerCase();

      const dayOk =
        !selectedDay || Number(item?.day_of_week) === Number(selectedDay);

      const statusOk =
        !selectedStatus || Number(item?.is_active) === Number(selectedStatus);

      const searchOk = !search || fullText.includes(search);

      return dayOk && statusOk && searchOk;
    });
  }, [rows, searchTerm, dayFilter, statusFilter]);

  const groupedByDay = useMemo(() => {
    const map = {};
    DAYS.forEach((day) => {
      map[day.id] = [];
    });

    filteredRows.forEach((row) => {
      const dayId = Number(row?.day_of_week);
      if (!map[dayId]) map[dayId] = [];
      map[dayId].push(row);
    });

    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const sortA = Number(a?.sort_order || 0);
        const sortB = Number(b?.sort_order || 0);

        if (sortA !== sortB) return sortA - sortB;

        return String(a?.slot_start || "").localeCompare(
          String(b?.slot_start || "")
        );
      });
    });

    return map;
  }, [filteredRows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => Number(r?.is_active) === 1).length;
    const inactive = rows.filter((r) => Number(r?.is_active) !== 1).length;
    const programmesCount = new Set(
      rows.map((r) => String(r?.programme_id || "")).filter(Boolean)
    ).size;

    return {
      total,
      active,
      inactive,
      programmesCount,
    };
  }, [rows]);

  const resetFilters = () => {
    setSearchTerm("");
    setDayFilter("");
    setStatusFilter("");
  };

  const openAddModal = () => {
    setModalMode("add");
    setForm(getInitialForm());
    setModalOpen(true);
  };

  const openEditModal = (row) => {
    setModalMode("edit");
    setForm({
      id: row?.id || null,
      programme_id: row?.programme_id || "",
      day_of_week: row?.day_of_week || "",
      slot_start: toInputTime(row?.slot_start || ""),
      slot_end: toInputTime(row?.slot_end || ""),
      timezoneid: row?.timezoneid || DEFAULT_TIMEZONE_ID,
      timezone_location:
        row?.timezone_location || DEFAULT_TIMEZONE_LOCATION,
      is_active: Number(row?.is_active ?? 1),
      sort_order: Number(row?.sort_order || 0),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setForm(getInitialForm());
    setModalMode("add");
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!form.programme_id) {
      Swal.fire("Required", "Please select programme.", "warning");
      return false;
    }

    if (!form.day_of_week) {
      Swal.fire("Required", "Please select day.", "warning");
      return false;
    }

    if (!form.slot_start) {
      Swal.fire("Required", "Please select start time.", "warning");
      return false;
    }

    if (!form.slot_end) {
      Swal.fire("Required", "Please select end time.", "warning");
      return false;
    }

    const start = moment(form.slot_start, "HH:mm", true);
    const end = moment(form.slot_end, "HH:mm", true);

    if (!start.isValid() || !end.isValid()) {
      Swal.fire("Invalid Time", "Please select valid start and end time.", "warning");
      return false;
    }

    if (!end.isAfter(start)) {
      Swal.fire("Invalid Slot", "End time must be greater than start time.", "warning");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const isEdit = modalMode === "edit";

    const confirm = await Swal.fire({
      title: isEdit ? "Update Schedule?" : "Add Schedule?",
      text: isEdit
        ? "Are you sure you want to update this schedule?"
        : "Are you sure you want to add this schedule?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: isEdit ? "Yes, Update" : "Yes, Add",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      setSaving(true);

      const token = await getTokenValue();

      if (!token) {
        throw new Error("Token not found.");
      }

      const rowData = {
        programme_id: Number(form.programme_id),
        day_of_week: Number(form.day_of_week),
        slot_start: normaliseTime(form.slot_start),
        slot_end: normaliseTime(form.slot_end),
        timezoneid: Number(form.timezoneid || DEFAULT_TIMEZONE_ID),
        timezone_location:
          form.timezone_location || DEFAULT_TIMEZONE_LOCATION,
        is_active: Number(form.is_active ?? 1),
        sort_order: Number(form.sort_order || 0),
      };

      const payload = isEdit
        ? {
            token,
            tablename: TABLE_NAME,
            conditions: [{ id: Number(form.id) }],
            updatedata: [rowData],
          }
        : {
            token,
            tablename: TABLE_NAME,
            data: [
              {
                ...rowData,
                deleted: 0,
              },
            ],
          };

      const url = isEdit ? UPDATE_DYNAMIC_DATA_URL : ADD_DYNAMIC_DATA_URL;

      Swal.fire({
        title: isEdit ? "Updating..." : "Adding...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const response = await axios.post(url, payload, {
        headers: API_HEADERS,
      });

      if (Number(response?.data?.statusCode) !== 200) {
        throw new Error(
          response?.data?.message ||
            (isEdit ? "Schedule update failed." : "Schedule add failed.")
        );
      }

      await Swal.fire({
        icon: "success",
        title: isEdit ? "Updated!" : "Added!",
        text: isEdit
          ? "Schedule updated successfully."
          : "Schedule added successfully.",
        timer: 1400,
        showConfirmButton: false,
      });

      closeModal();
      await fetchTimetable();
    } catch (error) {
      console.error("Save timetable failed:", error);
      Swal.fire(
        "Error",
        error?.message || "Something went wrong while saving schedule.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async (row) => {
    if (!row?.id) {
      Swal.fire("Error", "Schedule ID is missing.", "error");
      return;
    }

    const confirm = await Swal.fire({
      title: "Delete Schedule?",
      text: "Are you sure you want to delete this schedule?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc3545",
    });

    if (!confirm.isConfirmed) return;

    try {
      setDeletingId(row.id);

      const token = await getTokenValue();

      if (!token) {
        throw new Error("Token not found.");
      }

      Swal.fire({
        title: "Deleting...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
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

      const response = await axios.post(UPDATE_DYNAMIC_DATA_URL, payload, {
        headers: API_HEADERS,
      });

      if (Number(response?.data?.statusCode) !== 200) {
        throw new Error(response?.data?.message || "Schedule delete failed.");
      }

      setRows((prev) =>
        prev.filter((item) => Number(item?.id) !== Number(row.id))
      );

      await Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Schedule deleted successfully.",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Delete timetable failed:", error);
      Swal.fire(
        "Error",
        error?.message || "Something went wrong while deleting schedule.",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const renderScheduleCard = (row) => {
    const isActive = Number(row?.is_active) === 1;
    const isDeleting = Number(deletingId) === Number(row?.id);

    return (
      <div className="wt-slot-card" key={row?.id}>
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div>
            <div className="wt-programme-name">
              {row?.programme_name || `Programme #${row?.programme_id}`}
            </div>
            <div className="wt-programme-stage">
              {row?.programme_stage || "Weekly Class"}
            </div>
          </div>

          <span
            className={`wt-status-pill ${
              isActive
                ? "bg-success-focus text-success-main"
                : "bg-danger-focus text-danger-main"
            }`}
          >
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="wt-time-box">
          <Icon icon="mdi:clock-outline" />
          <span>
            {formatTime(row?.slot_start)} - {formatTime(row?.slot_end)}
          </span>
        </div>

        <div className="wt-meta-row">
          <span>
            <Icon icon="mdi:earth" />
            {row?.timezone_location || DEFAULT_TIMEZONE_LOCATION}
          </span>

          <span>
            <Icon icon="mdi:sort" />
            Order: {row?.sort_order ?? 0}
          </span>
        </div>

        <div className="d-flex align-items-center gap-2 mt-3">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary wt-action-btn"
            onClick={() => openEditModal(row)}
          >
            <Icon icon="mdi:pencil-outline" />
            Edit
          </button>

          <button
            type="button"
            className="btn btn-sm btn-outline-danger wt-action-btn"
            onClick={() => handleSoftDelete(row)}
            disabled={isDeleting}
          >
            <Icon icon="mdi:trash-can-outline" />
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="card h-100 p-0 radius-12">
      <style>{`
        .wt-wrapper {
          padding: 24px;
        }

        .wt-header-card {
          border-radius: 20px;
          padding: 22px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: linear-gradient(135deg, rgba(72, 127, 255, .08), rgba(69, 179, 105, .06));
        }

        .wt-title {
          font-size: 24px;
          font-weight: 900;
          margin: 0;
          color: var(--bs-emphasis-color);
        }

        .wt-subtitle {
          color: var(--bs-secondary-color);
          font-weight: 600;
          margin: 4px 0 0;
        }

        .wt-create-btn {
          border-radius: 999px;
          padding: 10px 18px;
          font-weight: 800;
          box-shadow: 0 10px 24px rgba(25, 135, 84, 0.20);
        }

        .wt-stat-card {
          border-radius: 18px;
          padding: 18px;
          height: 100%;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: var(--bs-body-bg);
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
        }

        .wt-stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }

        .wt-toolbar {
          border-radius: 18px;
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: var(--bs-body-bg);
        }

        .wt-view-toggle {
          border-radius: 12px;
          font-weight: 800;
        }

        .wt-view-toggle.active {
          background: #0d6efd;
          color: #fff;
          border-color: #0d6efd;
        }

        .wt-calendar-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }

        .wt-day-card {
          border-radius: 22px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: var(--bs-body-bg);
          overflow: hidden;
          min-height: 250px;
          box-shadow: 0 12px 34px rgba(15, 23, 42, 0.045);
        }

        .wt-day-header {
          padding: 16px 18px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.16);
          background: linear-gradient(135deg, rgba(13, 110, 253, .12), rgba(13, 110, 253, .03));
        }

        .wt-day-title {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          font-size: 18px;
          font-weight: 900;
        }

        .wt-day-icon {
          width: 38px;
          height: 38px;
          border-radius: 13px;
          background: rgba(13, 110, 253, .14);
          color: #0d6efd;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .wt-day-body {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .wt-slot-card {
          border-radius: 16px;
          padding: 14px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(148, 163, 184, 0.045);
        }

        .wt-programme-name {
          font-weight: 900;
          color: var(--bs-emphasis-color);
          line-height: 1.25;
        }

        .wt-programme-stage {
          font-size: 12px;
          font-weight: 700;
          margin-top: 2px;
          color: var(--bs-secondary-color);
        }

        .wt-status-pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .wt-time-box {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          color: #0d6efd;
          font-weight: 900;
          font-size: 14px;
        }

        .wt-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 10px;
          color: var(--bs-secondary-color);
          font-size: 12px;
          font-weight: 700;
        }

        .wt-meta-row span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .wt-action-btn {
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-weight: 800;
        }

        .wt-empty-day {
          border: 1px dashed rgba(148, 163, 184, 0.35);
          border-radius: 16px;
          padding: 26px 12px;
          text-align: center;
          color: var(--bs-secondary-color);
          font-weight: 700;
        }

        .wt-table thead th {
          white-space: nowrap;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .03em;
        }

        .wt-table tbody td {
          vertical-align: middle;
        }

        .wt-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.72);
          z-index: 2400;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          backdrop-filter: blur(5px);
        }

        .wt-modal-card {
          width: min(760px, 96vw);
          max-height: 92vh;
          overflow: hidden;
          border-radius: 22px;
          background: var(--bs-body-bg);
          border: 1px solid rgba(148, 163, 184, 0.24);
          box-shadow: 0 30px 80px rgba(0, 0, 0, .35);
        }

        .wt-modal-header {
          padding: 20px 22px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          background: linear-gradient(135deg, rgba(13,110,253,.12), rgba(13,110,253,.03));
        }

        .wt-modal-title {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
        }

        .wt-modal-body {
          padding: 22px;
          max-height: calc(92vh - 145px);
          overflow-y: auto;
        }

        .wt-modal-footer {
          padding: 16px 22px;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .wt-close-btn {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          background: transparent;
          color: var(--bs-emphasis-color);
          font-size: 22px;
          line-height: 1;
        }

        @media (max-width: 1199px) {
          .wt-calendar-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 767px) {
          .wt-wrapper {
            padding: 16px;
          }

          .wt-calendar-grid {
            grid-template-columns: 1fr;
          }

          .wt-header-card {
            padding: 16px;
          }
        }
      `}</style>

      <div className="wt-wrapper">
        <div className="wt-header-card mb-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <h5 className="wt-title">Weekly Timetable</h5>
              <p className="wt-subtitle">
                Manage weekly group programme schedule in Dubai timezone.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-success wt-create-btn d-inline-flex align-items-center gap-2"
              onClick={openAddModal}
            >
              <Icon icon="mdi:calendar-plus-outline" />
              Add Schedule
            </button>
          </div>
        </div>

        <div className="row gy-3 mb-4">
          <div className="col-xl-3 col-sm-6">
            <div className="wt-stat-card">
              <div className="d-flex align-items-center justify-content-between gap-3">
                <div>
                  <div className="text-secondary-light text-sm fw-bold">
                    Total Schedules
                  </div>
                  <h4 className="mb-0 mt-1">{stats.total}</h4>
                </div>
                <div className="wt-stat-icon bg-primary-50 text-primary-600">
                  <Icon icon="mdi:calendar-multiple" />
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6">
            <div className="wt-stat-card">
              <div className="d-flex align-items-center justify-content-between gap-3">
                <div>
                  <div className="text-secondary-light text-sm fw-bold">
                    Active
                  </div>
                  <h4 className="mb-0 mt-1">{stats.active}</h4>
                </div>
                <div className="wt-stat-icon bg-success-focus text-success-main">
                  <Icon icon="mdi:check-circle-outline" />
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6">
            <div className="wt-stat-card">
              <div className="d-flex align-items-center justify-content-between gap-3">
                <div>
                  <div className="text-secondary-light text-sm fw-bold">
                    Inactive
                  </div>
                  <h4 className="mb-0 mt-1">{stats.inactive}</h4>
                </div>
                <div className="wt-stat-icon bg-danger-focus text-danger-main">
                  <Icon icon="mdi:close-circle-outline" />
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6">
            <div className="wt-stat-card">
              <div className="d-flex align-items-center justify-content-between gap-3">
                <div>
                  <div className="text-secondary-light text-sm fw-bold">
                    Programmes
                  </div>
                  <h4 className="mb-0 mt-1">{stats.programmesCount}</h4>
                </div>
                <div className="wt-stat-icon bg-warning-focus text-warning-main">
                  <Icon icon="mdi:book-education-outline" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="wt-toolbar mb-4">
          <div className="row gy-2 align-items-end">
            <div className="col-xl-4 col-lg-5">
              <label className="form-label fw-bold">Search</label>
              <input
                type="text"
                className="form-control"
                placeholder="Search programme, day, timezone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="col-xl-2 col-lg-3 col-md-6">
              <label className="form-label fw-bold">Day</label>
              <select
                className="form-select"
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
              >
                <option value="">All Days</option>
                {DAYS.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-xl-2 col-lg-3 col-md-6">
              <label className="form-label fw-bold">Status</label>
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>

            <div className="col-xl-2 col-lg-4 col-md-6">
              <label className="form-label fw-bold">View</label>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className={`btn btn-outline-primary wt-view-toggle ${
                    viewMode === "calendar" ? "active" : ""
                  }`}
                  onClick={() => setViewMode("calendar")}
                >
                  Calendar
                </button>
                <button
                  type="button"
                  className={`btn btn-outline-primary wt-view-toggle ${
                    viewMode === "list" ? "active" : ""
                  }`}
                  onClick={() => setViewMode("list")}
                >
                  List
                </button>
              </div>
            </div>

            <div className="col-xl-2 col-lg-4 col-md-6">
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

        {loadError ? (
          <div className="alert alert-danger py-2">{loadError}</div>
        ) : null}

        {loading ? (
          <div className="py-5 text-center">
            <div className="spinner-border text-primary" role="status" />
            <div className="mt-2 text-secondary-light">
              Loading weekly timetable...
            </div>
          </div>
        ) : viewMode === "calendar" ? (
          <div className="wt-calendar-grid">
            {DAYS.map((day) => {
              const dayRows = groupedByDay[day.id] || [];

              return (
                <div className="wt-day-card" key={day.id}>
                  <div className="wt-day-header">
                    <h6 className="wt-day-title">
                      <span className="wt-day-icon">
                        <Icon icon="mdi:calendar-week-outline" />
                      </span>
                      {day.name}
                    </h6>
                  </div>

                  <div className="wt-day-body">
                    {dayRows.length === 0 ? (
                      <div className="wt-empty-day">
                        <Icon icon="mdi:calendar-blank-outline" fontSize={28} />
                        <div className="mt-2">No schedule added</div>
                      </div>
                    ) : (
                      dayRows.map((row) => renderScheduleCard(row))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table bordered-table mb-0 wt-table">
              <thead>
                <tr>
                  <th>S.L</th>
                  <th>Programme</th>
                  <th>Day</th>
                  <th>Slot</th>
                  <th>Timezone</th>
                  <th>Sort</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-5 text-secondary-light">
                      No timetable schedule found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => {
                    const isDeleting = Number(deletingId) === Number(row?.id);

                    return (
                      <tr key={row?.id || index}>
                        <td>{index + 1}</td>

                        <td>
                          <div className="fw-bold">
                            {row?.programme_name || `Programme #${row?.programme_id}`}
                          </div>
                          <div className="text-secondary-light text-sm">
                            {row?.programme_stage || "-"}
                          </div>
                        </td>

                        <td>{row?.day_name || getDayName(row?.day_of_week)}</td>

                        <td>
                          <strong>
                            {formatTime(row?.slot_start)} - {formatTime(row?.slot_end)}
                          </strong>
                        </td>

                        <td>
                          <div>{row?.timezone_location || DEFAULT_TIMEZONE_LOCATION}</div>
                          <div className="text-secondary-light text-sm">
                            ID: {row?.timezoneid || DEFAULT_TIMEZONE_ID}
                          </div>
                        </td>

                        <td>{row?.sort_order ?? 0}</td>

                        <td>
                          <span
                            className={`px-12 py-4 rounded-pill fw-bold text-sm ${getStatusBadge(
                              row?.is_active
                            )}`}
                          >
                            {Number(row?.is_active) === 1 ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td>{formatDateTime(row?.created_at)}</td>

                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary wt-action-btn"
                              onClick={() => openEditModal(row)}
                            >
                              <Icon icon="mdi:pencil-outline" />
                              Edit
                            </button>

                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger wt-action-btn"
                              onClick={() => handleSoftDelete(row)}
                              disabled={isDeleting}
                            >
                              <Icon icon="mdi:trash-can-outline" />
                              {isDeleting ? "Deleting..." : "Delete"}
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
        )}
      </div>

      {modalOpen ? (
        <div className="wt-modal-overlay" onClick={closeModal}>
          <div className="wt-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="wt-modal-header d-flex align-items-center justify-content-between gap-3">
              <div>
                <h5 className="wt-modal-title">
                  {modalMode === "edit" ? "Edit Schedule" : "Add Schedule"}
                </h5>
                <div className="text-secondary-light text-sm fw-semibold mt-1">
                  Timezone will be saved as Asia/Dubai.
                </div>
              </div>

              <button
                type="button"
                className="wt-close-btn"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <div className="wt-modal-body">
              <div className="row gy-3">
                <div className="col-md-12">
                  <label className="form-label fw-bold">Programme</label>
                  <select
                    className="form-select"
                    value={form.programme_id}
                    onChange={(e) => updateForm("programme_id", e.target.value)}
                    disabled={programmeLoading}
                  >
                    <option value="">
                      {programmeLoading ? "Loading programmes..." : "Select Programme"}
                    </option>

                    {programmes.map((programme) => (
                      <option key={programme.id} value={programme.id}>
                        {programme.name}
                        {programme.stage ? ` - ${programme.stage}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-bold">Day</label>
                  <select
                    className="form-select"
                    value={form.day_of_week}
                    onChange={(e) => updateForm("day_of_week", e.target.value)}
                  >
                    <option value="">Select Day</option>
                    {DAYS.map((day) => (
                      <option key={day.id} value={day.id}>
                        {day.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-bold">Sort Order</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.sort_order}
                    onChange={(e) => updateForm("sort_order", e.target.value)}
                    min="0"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-bold">Start Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={form.slot_start}
                    onChange={(e) => updateForm("slot_start", e.target.value)}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-bold">End Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={form.slot_end}
                    onChange={(e) => updateForm("slot_end", e.target.value)}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-bold">Timezone ID</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.timezoneid}
                    onChange={(e) => updateForm("timezoneid", e.target.value)}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-bold">Timezone Location</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.timezone_location}
                    onChange={(e) =>
                      updateForm("timezone_location", e.target.value)
                    }
                  />
                </div>

                <div className="col-md-12">
                  <label className="form-label fw-bold">Status</label>
                  <select
                    className="form-select"
                    value={form.is_active}
                    onChange={(e) => updateForm("is_active", e.target.value)}
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="wt-modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : modalMode === "edit"
                  ? "Update Schedule"
                  : "Add Schedule"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default WeeklyTimetablePortalLayer;