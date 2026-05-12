import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import Swal from "sweetalert2";
import { Icon } from "@iconify/react";
import { getToken } from "../api/getToken";
import { getTimezonesLookup } from "../api/getTimezonesLookup";

const RUN_SP_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const ADD_DYNAMIC_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=add_dynamic_data";

const UPDATE_DYNAMIC_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const BASE_HEADERS = {
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
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
  { id: 7, name: "Sunday" },
];

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

const extractRows = (res) => {
  const candidates = [
    res,
    res?.data,
    res?.data?.data,
    res?.data?.result,
    res?.result,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
};

const getTimezoneId = (item) =>
  item?.id ?? item?.timezoneid ?? item?.timezoneId ?? "";

const getTimezoneValue = (item) =>
  item?.timezone || item?.name || item?.value || "";

const getTimezoneLabel = (item) => {
  const id = getTimezoneId(item);
  const value = getTimezoneValue(item);

  if (!value) return "";

  return id ? `${value} (ID: ${id})` : value;
};

const normalizeTimezones = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  const finalRows = [...safeRows];

  const hasDubai = finalRows.some((item) => {
    return (
      String(getTimezoneId(item)) === String(DEFAULT_TIMEZONE_ID) ||
      String(getTimezoneValue(item)) === DEFAULT_TIMEZONE_LOCATION
    );
  });

  if (!hasDubai) {
    finalRows.unshift({
      id: DEFAULT_TIMEZONE_ID,
      timezoneid: DEFAULT_TIMEZONE_ID,
      timezone: DEFAULT_TIMEZONE_LOCATION,
      name: DEFAULT_TIMEZONE_LOCATION,
    });
  }

  const seen = new Set();

  return finalRows
    .map((item) => {
      const id = getTimezoneId(item);
      const value = getTimezoneValue(item);

      return {
        ...item,
        id,
        timezoneid: id,
        timezone: value,
        label: getTimezoneLabel(item),
      };
    })
    .filter((item) => item.timezone)
    .filter((item) => {
      const key = `${item.timezoneid}-${item.timezone}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const formatTime = (value) => {
  if (!value) return "-";

  const clean = String(value).split(".")[0];
  const m = moment(clean, ["HH:mm:ss", "HH:mm"], true);

  return m.isValid() ? m.format("hh:mm A") : clean;
};

const inputTime = (value) => {
  if (!value) return "";

  const clean = String(value).split(".")[0];
  const m = moment(clean, ["HH:mm:ss", "HH:mm"], true);

  return m.isValid() ? m.format("HH:mm") : clean.slice(0, 5);
};

const dbTime = (value) => {
  if (!value) return "";

  const m = moment(value, ["HH:mm", "HH:mm:ss"], true);

  return m.isValid() ? m.format("HH:mm:ss") : value;
};

const WeeklyTimetableModal = ({ onClose }) => {
  const [rows, setRows] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [timezones, setTimezones] = useState([]);

  const [loading, setLoading] = useState(true);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [viewMode, setViewMode] = useState("calendar");
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("add");
  const [form, setForm] = useState(getInitialForm());

  const getHeaders = async () => {
    const tokenRes = await getToken();
    const token = resolveToken(tokenRes);

    return {
      ...BASE_HEADERS,
      ...(token ? { token } : {}),
    };
  };

  const getTokenValue = async () => {
    const tokenRes = await getToken();
    return resolveToken(tokenRes);
  };

  const getTimezoneById = (timezoneId) => {
    const id = String(timezoneId || "").trim();

    if (!id) return null;

    return timezones.find((tz) => String(getTimezoneId(tz)) === id) || null;
  };

  const getTimezoneByValue = (timezoneValue) => {
    const value = String(timezoneValue || "").trim();

    if (!value) return null;

    return (
      timezones.find((tz) => String(getTimezoneValue(tz)).trim() === value) ||
      null
    );
  };

  const fetchTimetable = useCallback(async () => {
    try {
      setLoading(true);

      const headers = await getHeaders();

      const res = await axios.post(
        RUN_SP_URL,
        {
          procedureName: TIMETABLE_SP,
          parameters: [],
        },
        { headers }
      );

      setRows(extractRows(res));
    } catch (error) {
      console.error("Weekly timetable load failed:", error);
      setRows([]);
      Swal.fire("Error", "Failed to load weekly timetable.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProgrammes = useCallback(async () => {
    try {
      const headers = await getHeaders();

      const res = await axios.post(
        RUN_SP_URL,
        {
          procedureName: PROGRAMMES_SP,
          parameters: [],
        },
        { headers }
      );

      const list = extractRows(res);

      const mapped = list
        .map((item) => ({
          id: item.programme_id || item.id,
          name: item.programme_name || item.name,
          stage: item.programme_stage || item.stage || "",
        }))
        .filter((item) => item.id && item.name);

      const unique = Array.from(
        new Map(mapped.map((item) => [String(item.id), item])).values()
      );

      setProgrammes(unique);
    } catch (error) {
      console.error("Programmes load failed:", error);
      setProgrammes([]);
    }
  }, []);

  const fetchTimezones = useCallback(async () => {
    try {
      const res = await getTimezonesLookup();

      if (res?.statusCode === 200 && Array.isArray(res?.data)) {
        setTimezones(normalizeTimezones(res.data));
      } else {
        setTimezones(
          normalizeTimezones([
            {
              id: DEFAULT_TIMEZONE_ID,
              timezone: DEFAULT_TIMEZONE_LOCATION,
            },
          ])
        );
      }
    } catch (error) {
      console.error("Timezones lookup failed:", error);

      setTimezones(
        normalizeTimezones([
          {
            id: DEFAULT_TIMEZONE_ID,
            timezone: DEFAULT_TIMEZONE_LOCATION,
          },
        ])
      );
    }
  }, []);

  const fetchLookups = useCallback(async () => {
    try {
      setLookupsLoading(true);

      await Promise.all([fetchProgrammes(), fetchTimezones()]);
    } finally {
      setLookupsLoading(false);
    }
  }, [fetchProgrammes, fetchTimezones]);

  useEffect(() => {
    fetchTimetable();
    fetchLookups();
  }, [fetchTimetable, fetchLookups]);

  const filteredRows = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();

    return rows.filter((row) => {
      if (dayFilter && Number(row.day_of_week) !== Number(dayFilter)) {
        return false;
      }

      if (q) {
        const blob = `
          ${row.programme_name || ""}
          ${row.day_name || ""}
          ${row.slot_start || ""}
          ${row.slot_end || ""}
          ${row.timezone_location || ""}
          ${row.timezoneid || ""}
        `.toLowerCase();

        if (!blob.includes(q)) return false;
      }

      return true;
    });
  }, [rows, search, dayFilter]);

  const grouped = useMemo(() => {
    const map = {};

    DAYS.forEach((day) => {
      map[day.id] = [];
    });

    filteredRows.forEach((row) => {
      const dayId = Number(row.day_of_week);

      if (!map[dayId]) map[dayId] = [];

      map[dayId].push(row);
    });

    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const aSort = Number(a.sort_order || 0);
        const bSort = Number(b.sort_order || 0);

        if (aSort !== bSort) return aSort - bSort;

        return String(a.slot_start || "").localeCompare(
          String(b.slot_start || "")
        );
      });
    });

    return map;
  }, [filteredRows]);

  const openAdd = () => {
    setFormMode("add");

    const dubaiTimezone =
      getTimezoneById(DEFAULT_TIMEZONE_ID) ||
      getTimezoneByValue(DEFAULT_TIMEZONE_LOCATION);

    setForm({
      ...getInitialForm(),
      timezoneid: getTimezoneId(dubaiTimezone) || DEFAULT_TIMEZONE_ID,
      timezone_location:
        getTimezoneValue(dubaiTimezone) || DEFAULT_TIMEZONE_LOCATION,
    });

    setFormOpen(true);
  };

  const openEdit = (row) => {
    const rowTimezone =
      getTimezoneById(row?.timezoneid) ||
      getTimezoneByValue(row?.timezone_location);

    setFormMode("edit");

    setForm({
      id: row.id,
      programme_id: row.programme_id || "",
      day_of_week: row.day_of_week || "",
      slot_start: inputTime(row.slot_start),
      slot_end: inputTime(row.slot_end),
      timezoneid:
        getTimezoneId(rowTimezone) ||
        row.timezoneid ||
        DEFAULT_TIMEZONE_ID,
      timezone_location:
        getTimezoneValue(rowTimezone) ||
        row.timezone_location ||
        DEFAULT_TIMEZONE_LOCATION,
      is_active: Number(row.is_active ?? 1),
      sort_order: Number(row.sort_order || 0),
    });

    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;

    setFormOpen(false);
    setFormMode("add");
    setForm(getInitialForm());
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTimezoneChange = (timezoneId) => {
    const selectedTimezone = getTimezoneById(timezoneId);

    setForm((prev) => ({
      ...prev,
      timezoneid: timezoneId,
      timezone_location: selectedTimezone
        ? getTimezoneValue(selectedTimezone)
        : "",
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

    if (!form.slot_start || !form.slot_end) {
      Swal.fire("Required", "Please select start and end time.", "warning");
      return false;
    }

    if (!form.timezoneid || !form.timezone_location) {
      Swal.fire("Required", "Please select timezone.", "warning");
      return false;
    }

    const start = moment(form.slot_start, "HH:mm", true);
    const end = moment(form.slot_end, "HH:mm", true);

    if (!start.isValid() || !end.isValid() || !end.isAfter(start)) {
      Swal.fire(
        "Invalid Slot",
        "End time must be greater than start time.",
        "warning"
      );
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const isEdit = formMode === "edit";

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
        slot_start: dbTime(form.slot_start),
        slot_end: dbTime(form.slot_end),
        timezoneid: Number(form.timezoneid),
        timezone_location: form.timezone_location,
        is_active: Number(form.is_active),
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

      const url = isEdit ? UPDATE_DYNAMIC_URL : ADD_DYNAMIC_URL;

      Swal.fire({
        title: isEdit ? "Updating..." : "Adding...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await axios.post(url, payload, {
        headers: BASE_HEADERS,
      });

      if (Number(res?.data?.statusCode) !== 200) {
        throw new Error(res?.data?.message || "Save failed.");
      }

      await Swal.fire({
        icon: "success",
        title: isEdit ? "Updated!" : "Added!",
        text: isEdit
          ? "Schedule updated successfully."
          : "Schedule added successfully.",
        timer: 1300,
        showConfirmButton: false,
      });

      closeForm();
      await fetchTimetable();
    } catch (error) {
      console.error("Schedule save failed:", error);
      Swal.fire("Error", error?.message || "Something went wrong.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
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

      const res = await axios.post(UPDATE_DYNAMIC_URL, payload, {
        headers: BASE_HEADERS,
      });

      if (Number(res?.data?.statusCode) !== 200) {
        throw new Error(res?.data?.message || "Delete failed.");
      }

      setRows((prev) => prev.filter((x) => Number(x.id) !== Number(row.id)));

      Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Schedule deleted successfully.",
        timer: 1300,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Schedule delete failed:", error);
      Swal.fire("Error", error?.message || "Something went wrong.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="wt-overlay" onClick={onClose}>
      <style>{`
        .wt-overlay {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 2500;
          background: rgba(2, 6, 23, 0.76);
          overflow-y: auto;
          padding: 24px;
          backdrop-filter: blur(6px);
        }

        .swal2-container {
  z-index: 99999 !important;
}

.swal2-popup {
  z-index: 100000 !important;
}

        .wt-modal-main {
          width: min(1280px, 96vw);
          margin: 0 auto;
          border-radius: 22px;
          background: #243247;
          color: #ffffff;
          border: 1px solid rgba(148, 163, 184, 0.24);
          box-shadow: 0 28px 80px rgba(0,0,0,.42);
          overflow: hidden;
        }

        .wt-modal-header {
          padding: 22px 24px;
          border-bottom: 1px solid rgba(148,163,184,.20);
          background: linear-gradient(135deg, #1d2b3f 0%, #26384f 100%);
        }

        .wt-title {
          color: #ffffff;
          font-size: 24px;
          font-weight: 900;
          margin: 0;
        }

        .wt-subtitle {
          color: #b8c4d6;
          font-weight: 650;
          margin-top: 4px;
        }

        .wt-body {
          padding: 24px;
          background: #243247;
        }

        .wt-toolbar,
        .wt-form-box {
          border-radius: 18px;
          border: 1px solid rgba(148,163,184,.18);
          background: linear-gradient(180deg, rgba(15,23,42,.58), rgba(15,23,42,.38));
          padding: 16px;
        }

        .wt-form-box {
          margin-bottom: 18px;
        }

        .wt-label {
          color: #dbe4f0;
          font-weight: 800;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .wt-modal-main .form-control,
        .wt-modal-main .form-select {
          min-height: 46px;
          border-radius: 14px;
          border: 1px solid rgba(148,163,184,.20);
          background: #1b2738;
          color: #ffffff;
          font-weight: 650;
          box-shadow: none !important;
        }

        .wt-modal-main .form-control::placeholder {
          color: #8296b1;
        }

        .wt-modal-main .form-control:focus,
        .wt-modal-main .form-select:focus {
          border-color: #3b82f6;
          background: #1b2738;
          color: #ffffff;
        }

        .wt-modal-main .form-select option {
          background: #243247;
          color: #ffffff;
        }

        .wt-day-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .wt-day-card {
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 18px;
          overflow: hidden;
          background: #1f2d40;
          min-height: 180px;
        }

        .wt-day-head {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(148,163,184,.16);
          background: #182538;
          color: #ffffff;
          font-weight: 900;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .wt-slot {
          margin: 12px;
          border-radius: 14px;
          border: 1px solid rgba(148,163,184,.18);
          background: rgba(15,23,42,.40);
          padding: 12px;
        }

        .wt-slot-title {
          color: #ffffff;
          font-weight: 900;
          line-height: 1.2;
        }

        .wt-slot-meta {
          color: #b8c4d6;
          font-size: 12px;
          font-weight: 700;
          margin-top: 4px;
        }

        .wt-time {
          color: #93c5fd;
          font-weight: 900;
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .wt-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          flex-wrap: wrap;
        }

        .wt-empty-day {
          padding: 20px;
          text-align: center;
          color: #b8c4d6;
          font-weight: 700;
        }

        .wt-table {
          color: #ffffff;
        }

        .wt-table thead th {
          background: #182538;
          color: #dbe4f0;
          white-space: nowrap;
          border-color: rgba(148,163,184,.18);
        }

        .wt-table tbody td {
          vertical-align: middle;
          border-color: rgba(148,163,184,.14);
          color: #dbe4f0;
        }

        .wt-table tbody tr:hover {
          background: rgba(148,163,184,.06);
        }

        .wt-close-btn {
          border-radius: 12px;
          border: 1px solid rgba(148,163,184,.35);
          background: rgba(15,23,42,.30);
          color: #dbe4f0;
          font-weight: 800;
        }

        .wt-close-btn:hover {
          background: rgba(148,163,184,.16);
          color: #ffffff;
        }

        .wt-timezone-note {
          color: #86efac;
          font-size: 12px;
          font-weight: 750;
          margin-top: 6px;
        }

        @media(max-width:1199px){
          .wt-day-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media(max-width:767px){
          .wt-overlay { padding: 12px; }
          .wt-body { padding: 16px; }
          .wt-day-grid { grid-template-columns: 1fr; }
          .wt-title { font-size: 21px; }
        }
      `}</style>

      <div className="wt-modal-main" onClick={(e) => e.stopPropagation()}>
        <div className="wt-modal-header">
          <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
            <div>
              <h5 className="wt-title">Weekly Timetable</h5>
              <div className="wt-subtitle">
                Manage group programme weekly schedule with timezone lookup.
              </div>
            </div>

            <div className="d-flex gap-2 flex-wrap">
              <button
                className="btn btn-success d-inline-flex align-items-center gap-2"
                type="button"
                onClick={openAdd}
                disabled={lookupsLoading}
              >
                <Icon icon="mdi:calendar-plus-outline" />
                Add Schedule
              </button>

              <button
                className="btn wt-close-btn"
                type="button"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="wt-body">
          <div className="wt-toolbar mb-3">
            <div className="row gy-2 align-items-end">
              <div className="col-lg-5">
                <label className="form-label wt-label">Search</label>
                <input
                  className="form-control"
                  placeholder="Search programme, day, timezone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="col-lg-3">
                <label className="form-label wt-label">Day</label>
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

              <div className="col-lg-2">
                <label className="form-label wt-label">View</label>
                <select
                  className="form-select"
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                >
                  <option value="calendar">Calendar</option>
                  <option value="list">List</option>
                </select>
              </div>

              <div className="col-lg-2">
                <button
                  className="btn btn-outline-primary w-100"
                  type="button"
                  onClick={fetchTimetable}
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {formOpen && (
            <div className="wt-form-box">
              <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                <div>
                  <h6 className="mb-0 text-white">
                    {formMode === "edit" ? "Edit Schedule" : "Add Schedule"}
                  </h6>
                  <div className="text-secondary-light text-sm fw-semibold">
                    Timezone will save both timezone ID and timezone location.
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-sm wt-close-btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>

              <div className="row gy-3">
                <div className="col-lg-4">
                  <label className="form-label wt-label">Programme</label>
                  <select
                    className="form-select"
                    value={form.programme_id}
                    onChange={(e) => updateForm("programme_id", e.target.value)}
                    disabled={lookupsLoading || saving}
                  >
                    <option value="">
                      {lookupsLoading ? "Loading programmes..." : "Select Programme"}
                    </option>

                    {programmes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.stage ? ` - ${item.stage}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-lg-2">
                  <label className="form-label wt-label">Day</label>
                  <select
                    className="form-select"
                    value={form.day_of_week}
                    onChange={(e) => updateForm("day_of_week", e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Select Day</option>
                    {DAYS.map((day) => (
                      <option key={day.id} value={day.id}>
                        {day.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-lg-2">
                  <label className="form-label wt-label">Start</label>
                  <input
                    type="time"
                    className="form-control"
                    value={form.slot_start}
                    onChange={(e) => updateForm("slot_start", e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="col-lg-2">
                  <label className="form-label wt-label">End</label>
                  <input
                    type="time"
                    className="form-control"
                    value={form.slot_end}
                    onChange={(e) => updateForm("slot_end", e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="col-lg-2">
                  <label className="form-label wt-label">Sort</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.sort_order}
                    onChange={(e) => updateForm("sort_order", e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="col-lg-6">
                  <label className="form-label wt-label">Timezone</label>
                  <select
                    className="form-select"
                    value={form.timezoneid || ""}
                    onChange={(e) => handleTimezoneChange(e.target.value)}
                    disabled={lookupsLoading || saving}
                  >
                    <option value="">
                      {lookupsLoading ? "Loading timezones..." : "Select Timezone"}
                    </option>

                    {timezones.map((tz) => {
                      const tzId = getTimezoneId(tz);
                      const tzValue = getTimezoneValue(tz);
                      const tzLabel = getTimezoneLabel(tz);

                      return (
                        <option key={`${tzId}-${tzValue}`} value={tzId}>
                          {tzLabel}
                        </option>
                      );
                    })}
                  </select>

                  {form.timezone_location ? (
                    <div className="wt-timezone-note">
                      Selected: {form.timezone_location}
                      {form.timezoneid ? ` (ID: ${form.timezoneid})` : ""}
                    </div>
                  ) : null}
                </div>

                <div className="col-lg-3">
                  <label className="form-label wt-label">Status</label>
                  <select
                    className="form-select"
                    value={form.is_active}
                    onChange={(e) => updateForm("is_active", e.target.value)}
                    disabled={saving}
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>

                <div className="col-lg-3 d-flex align-items-end">
                  <button
                    type="button"
                    className="btn btn-primary w-100"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : formMode === "edit"
                      ? "Update Schedule"
                      : "Add Schedule"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" />
              <div className="mt-2 text-secondary-light">
                Loading timetable...
              </div>
            </div>
          ) : viewMode === "calendar" ? (
            <div className="wt-day-grid">
              {DAYS.map((day) => {
                const dayRows = grouped[day.id] || [];

                return (
                  <div className="wt-day-card" key={day.id}>
                    <div className="wt-day-head">
                      <Icon icon="mdi:calendar-week-outline" />
                      {day.name}
                    </div>

                    {dayRows.length === 0 ? (
                      <div className="wt-empty-day">No schedule</div>
                    ) : (
                      dayRows.map((row) => (
                        <div className="wt-slot" key={row.id}>
                          <div className="wt-slot-title">
                            {row.programme_name ||
                              `Programme #${row.programme_id}`}
                          </div>

                          <div className="wt-slot-meta">
                            {row.timezone_location ||
                              DEFAULT_TIMEZONE_LOCATION}
                            {row.timezoneid ? ` • ID: ${row.timezoneid}` : ""}
                          </div>

                          <div className="wt-time">
                            <Icon icon="mdi:clock-outline" />
                            {formatTime(row.slot_start)} -{" "}
                            {formatTime(row.slot_end)}
                          </div>

                          <div className="wt-actions">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              type="button"
                              onClick={() => openEdit(row)}
                            >
                              Edit
                            </button>

                            <button
                              className="btn btn-sm btn-outline-danger"
                              type="button"
                              onClick={() => handleDelete(row)}
                              disabled={Number(deletingId) === Number(row.id)}
                            >
                              {Number(deletingId) === Number(row.id)
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
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
                    <th>Time</th>
                    <th>Timezone</th>
                    <th>Sort</th>
                    <th>Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4">
                        No schedule found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, index) => (
                      <tr key={row.id}>
                        <td>{index + 1}</td>

                        <td className="fw-bold text-white">
                          {row.programme_name ||
                            `Programme #${row.programme_id}`}
                        </td>

                        <td>{row.day_name}</td>

                        <td>
                          {formatTime(row.slot_start)} -{" "}
                          {formatTime(row.slot_end)}
                        </td>

                        <td>
                          <div>{row.timezone_location}</div>
                          <div className="text-secondary-light text-sm">
                            ID: {row.timezoneid || "-"}
                          </div>
                        </td>

                        <td>{row.sort_order}</td>

                        <td>
                          <span
                            className={`px-12 py-4 rounded-pill fw-bold text-sm ${
                              Number(row.is_active) === 1
                                ? "bg-success-focus text-success-main"
                                : "bg-danger-focus text-danger-main"
                            }`}
                          >
                            {Number(row.is_active) === 1
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-2">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              type="button"
                              onClick={() => openEdit(row)}
                            >
                              Edit
                            </button>

                            <button
                              className="btn btn-sm btn-outline-danger"
                              type="button"
                              onClick={() => handleDelete(row)}
                              disabled={Number(deletingId) === Number(row.id)}
                            >
                              {Number(deletingId) === Number(row.id)
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeeklyTimetableModal;