import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment-timezone";
import Swal from "sweetalert2";
import { Icon } from "@iconify/react";
import { getToken } from "../api/getToken";
import CreateLiveGroupModal from "./CreateLiveGroupModal";
import CreateGroupBatchBookingModal from "./CreateGroupBatchBookingModal";
import WeeklyTimetableModal from "./WeeklyTimetableModal";
import CreateGroupProgrammeModal from "./CreateGroupProgrammeModal";

const RUN_STORED_PROCEDURE_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const UPDATE_DYNAMIC_DATA_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const API_HEADERS = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

const STATUS_OPTIONS = ["active", "completed", "cancelled"];
const PORTAL_TIMEZONE = "Asia/Dubai";

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

const formatDate = (value) => {
  if (!value) return "-";

  const m = moment(value, ["YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss"], true);
  return m.isValid() ? m.format("DD MMM YYYY") : value;
};

const formatTime = (value) => {
  if (!value) return "-";

  const clean = String(value).split(".")[0];
  const m = moment(clean, ["HH:mm:ss", "HH:mm"], true);

  return m.isValid() ? m.format("hh:mm A") : clean;
};

const normaliseTime = (value = "") => {
  const clean = String(value || "").split(".")[0].trim();
  if (!clean) return "";

  const parsed = moment(clean, ["HH:mm:ss", "HH:mm", "hh:mm A"], true);
  return parsed.isValid() ? parsed.format("HH:mm:ss") : clean;
};

const convertSessionToPortalTimezone = (session) => {
  const sourceTimezone =
    session?.timezone_location || session?.timezone || "Asia/Dubai";

  const sourceDate = session?.session_date || "";
  const sourceStart = normaliseTime(session?.slot_start || "");
  const sourceEnd = normaliseTime(session?.slot_end || "");

  if (!sourceDate || !sourceStart || !sourceEnd) {
    return {
      date: formatDate(sourceDate),
      slot: `${formatTime(sourceStart)} - ${formatTime(sourceEnd)}`,
    };
  }

  const start = moment.tz(
    `${sourceDate} ${sourceStart}`,
    "YYYY-MM-DD HH:mm:ss",
    sourceTimezone
  );

  const end = moment.tz(
    `${sourceDate} ${sourceEnd}`,
    "YYYY-MM-DD HH:mm:ss",
    sourceTimezone
  );

  if (!start.isValid() || !end.isValid()) {
    return {
      date: formatDate(sourceDate),
      slot: `${formatTime(sourceStart)} - ${formatTime(sourceEnd)}`,
    };
  }

  const portalStart = start.clone().tz(PORTAL_TIMEZONE);
  const portalEnd = end.clone().tz(PORTAL_TIMEZONE);

  return {
    date: portalStart.format("DD MMM YYYY"),
    slot: `${portalStart.format("hh:mm A")} - ${portalEnd.format("hh:mm A")}`,
  };
};

const getStatusBadgeClass = (status) => {
  const s = String(status || "").toLowerCase();

  if (s === "active") return "bg-success";
  if (s === "completed") return "bg-primary";
  if (s === "cancelled") return "bg-danger";

  return "bg-secondary";
};

const getShortDescription = (text, limit = 90) => {
  const value = String(text || "").trim();
  if (!value) return "-";
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}...`;
};

const getWeekKey = (dateValue) => {
  if (!dateValue) return "no-week";

  const m = moment(dateValue, ["YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss"], true);

  if (!m.isValid()) return "no-week";

  return m.startOf("isoWeek").format("YYYY-MM-DD");
};

const getGroupBatchId = (item) => {
  const batchId = Number(item?.group_batch_id || 0);
  return batchId > 0 ? batchId : 0;
};


const getProgrammeBookedCount = (programme) => {
  const programmeBooked = Number(programme?.booked_count || 0);

  const sessionBooked = Array.isArray(programme?.sessions)
    ? Math.max(
      ...programme.sessions.map((session) =>
        Number(session?.booked_count || 0)
      ),
      0
    )
    : 0;

  return Math.max(programmeBooked, sessionBooked);
};

const canEditProgramme = (programme) => {
  return getProgrammeBookedCount(programme) <= 0;
};

const GroupProgrammeDetailsModal = ({ open, programme, onClose }) => {
  if (!open || !programme) return null;

  const sessions = Array.isArray(programme.sessions) ? programme.sessions : [];

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{
        background: "rgba(2, 6, 23, 0.74)",
        zIndex: 2300,
        padding: 16,
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <style>{`
        .gl-details-modal {
          width: min(1140px, 98vw);
          max-height: 94vh;
          overflow: hidden;
          border-radius: 22px;
          background: #243247;
          color: #ffffff;
          border: 1px solid rgba(148, 163, 184, 0.25);
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.50);
        }

        .gl-details-header {
          padding: 24px 26px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.20);
          background: linear-gradient(135deg, #1d2b3f 0%, #26384f 100%);
        }

        .gl-details-title {
          margin: 0;
          color: #ffffff;
          font-size: 38px;
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -0.7px;
        }

        .gl-details-stage {
          margin-top: 8px;
          color: #c7d2e3;
          font-size: 15px;
          font-weight: 700;
        }

        .gl-details-close-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(15, 23, 42, 0.30);
          color: #dbe4f0;
          font-size: 22px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .gl-details-close-icon:hover {
          background: rgba(239, 68, 68, 0.16);
          border-color: rgba(239, 68, 68, 0.48);
          color: #ffffff;
        }

        .gl-details-body {
          max-height: calc(94vh - 156px);
          overflow-y: auto;
          padding: 24px 26px;
          background: #243247;
        }

        .gl-details-body::-webkit-scrollbar {
          width: 8px;
        }

        .gl-details-body::-webkit-scrollbar-track {
          background: #172438;
        }

        .gl-details-body::-webkit-scrollbar-thumb {
          background: #64748b;
          border-radius: 999px;
        }

        .gl-stat-card {
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 16px;
          padding: 18px 20px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(15, 23, 42, 0.50));
          min-height: 94px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .gl-stat-label {
          color: #9fb0c8;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .gl-stat-value {
          color: #ffffff;
          font-size: 18px;
          font-weight: 900;
        }

        .gl-desc-title {
          color: #ffffff;
          font-size: 24px;
          font-weight: 900;
          margin: 4px 0 8px;
        }

        .gl-desc-text {
          color: #cbd5e1;
          font-size: 15px;
          line-height: 1.75;
          margin-bottom: 22px;
        }

        .gl-classes-card {
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 18px;
          overflow: hidden;
          background: #1d2b3f;
        }

        .gl-classes-title {
          padding: 16px 18px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          color: #ffffff;
          font-size: 16px;
          font-weight: 900;
          background: #182538;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .gl-class-row {
          display: grid;
          grid-template-columns: 54px 1.1fr 1.4fr 1.1fr 1fr 1.1fr 90px 90px 110px;
          gap: 14px;
          align-items: center;
          padding: 16px 18px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
          background: #243247;
        }

        .gl-class-row:last-child {
          border-bottom: 0;
        }

        .gl-class-row:hover {
          background: #2a3a51;
        }

        .gl-class-head {
          color: #ffffff;
          font-size: 13px;
          font-weight: 900;
          background: #172438;
        }

        .gl-class-cell {
          color: #dbe4f0;
          font-size: 14px;
          font-weight: 700;
          min-width: 0;
        }

        .gl-class-muted {
          color: #9fb0c8;
          font-weight: 700;
        }

        .gl-class-subject {
          color: #ffffff;
          font-weight: 900;
        }

        .gl-details-footer {
          padding: 16px 26px;
          border-top: 1px solid rgba(148, 163, 184, 0.20);
          background: #202e42;
          display: flex;
          justify-content: flex-end;
        }

        .gl-close-btn {
          border-radius: 12px;
          padding: 10px 20px;
          color: #dbe4f0;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(15, 23, 42, 0.24);
          font-weight: 800;
          transition: all 0.2s ease;
        }

        .gl-close-btn:hover {
          background: rgba(148, 163, 184, 0.15);
          color: #ffffff;
        }

        @media (max-width: 1199px) {
          .gl-class-row {
            grid-template-columns: 48px 1fr 1.2fr 1fr 1fr 1fr 80px 80px 100px;
            gap: 10px;
            padding: 14px;
          }

          .gl-class-cell {
            font-size: 13px;
          }
        }

        @media (max-width: 991px) {
          .gl-details-title {
            font-size: 30px;
          }

          .gl-class-row {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .gl-class-head {
            display: none;
          }
        }

        @media (max-width: 767px) {
          .gl-details-header,
          .gl-details-body,
          .gl-details-footer {
            padding-left: 16px;
            padding-right: 16px;
          }

          .gl-details-title {
            font-size: 25px;
          }

          .gl-desc-title {
            font-size: 20px;
          }
        }
      `}</style>

      <div className="gl-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gl-details-header d-flex justify-content-between align-items-start gap-3">
          <div>
            <h2 className="gl-details-title">{programme.programme_name}</h2>
            <div className="gl-details-stage">
              {programme.programme_stage || "-"}
            </div>
            <div className="mt-2 d-flex flex-wrap gap-2">
              <span className={`badge ${getStatusBadgeClass(programme.status)}`}>
                {programme.status || "active"}
              </span>
              {programme.group_batch_id ? (
                <span className="badge bg-secondary">
                  Batch #{programme.group_batch_id}
                </span>
              ) : programme.createddate ? (
                <span className="badge bg-secondary">
                  Batch: {formatDate(programme.createddate)}
                </span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="gl-details-close-icon"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="gl-details-body">
          <div className="row g-3 mb-4">
            <div className="col-xl-3 col-md-6">
              <div className="gl-stat-card">
                <div className="gl-stat-label">Weekly Fee</div>
                <div className="gl-stat-value">
                  AED {Number(programme.weekly_price || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-md-6">
              <div className="gl-stat-card">
                <div className="gl-stat-label">Classes</div>
                <div className="gl-stat-value">
                  {sessions.length} {sessions.length === 1 ? "Class" : "Classes"}
                </div>
              </div>
            </div>

            <div className="col-xl-3 col-md-6">
              <div className="gl-stat-card">
                <div className="gl-stat-label">Capacity</div>
                <div className="gl-stat-value">{programme.capacity || "-"}</div>
              </div>
            </div>

            <div className="col-xl-3 col-md-6">
              <div className="gl-stat-card">
                <div className="gl-stat-label">Seats Left</div>
                <div className="gl-stat-value">
                  {programme.seats_left ?? "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h5 className="gl-desc-title">Programme Description</h5>
            <p className="gl-desc-text">
              {programme.programme_description || "-"}
            </p>
          </div>

          <div className="gl-classes-card">
            <div className="gl-classes-title">
              <span>Programme Classes</span>
              <span className="badge bg-primary">{sessions.length} Classes</span>
            </div>

            <div className="gl-class-row gl-class-head">
              <div>S.L</div>
              <div>Subject</div>
              <div>Title</div>
              <div>Teacher</div>
              <div>Date</div>
              <div>Slot</div>
              <div>Capacity</div>
              <div>Booked</div>
              <div>Status</div>
            </div>

            {sessions.length === 0 ? (
              <div className="p-4 text-center gl-class-muted">
                No classes added for this programme.
              </div>
            ) : (
              sessions.map((session, index) => {
                const converted = convertSessionToPortalTimezone(session);

                return (
                  <div className="gl-class-row" key={session?.id || index}>
                    <div className="gl-class-cell">{index + 1}</div>

                    <div className="gl-class-cell gl-class-subject">
                      {session?.subjectname || "-"}
                    </div>

                    <div className="gl-class-cell">{session?.title || "-"}</div>

                    <div className="gl-class-cell">
                      {session?.teacher_name || "-"}
                    </div>

                    <div className="gl-class-cell">{converted.date}</div>

                    <div className="gl-class-cell">{converted.slot}</div>

                    <div className="gl-class-cell">
                      {session?.capacity || "-"}
                    </div>

                    <div className="gl-class-cell">
                      {session?.booked_count ?? 0}
                    </div>

                    <div className="gl-class-cell">
                      <span
                        className={`badge ${getStatusBadgeClass(
                          session?.status
                        )}`}
                      >
                        {session?.status || "-"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="gl-details-footer">
          <button type="button" className="gl-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const GroupLiveSessionsLayer = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [statusDraftMap, setStatusDraftMap] = useState({});
  const [savingStatusMap, setSavingStatusMap] = useState({});

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProgrammeForCreate, setSelectedProgrammeForCreate] =
    useState(null);
  const [createModalMode, setCreateModalMode] = useState("create");

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedProgrammeDetails, setSelectedProgrammeDetails] =
    useState(null);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedProgrammeForBooking, setSelectedProgrammeForBooking] =
    useState(null);

  const [weeklyTimetableOpen, setWeeklyTimetableOpen] = useState(false);
  const [groupProgrammeModalOpen, setGroupProgrammeModalOpen] = useState(false);

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

  const fetchGroupLiveSessions = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const headers = await buildHeaders();

      const response = await axios.post(
        RUN_STORED_PROCEDURE_URL,
        {
          procedureName: "sp_get_group_live_sessions_list",
        },
        { headers }
      );

      if (Number(response?.data?.statusCode) !== 200) {
        throw new Error(
          response?.data?.message || "Group live sessions load nahi huay."
        );
      }

      const list = extractRows(response.data);
      setRows(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Group live sessions load failed:", error);
      setRows([]);
      setLoadError(error?.message || "Group live sessions load nahi huay.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroupLiveSessions();
  }, [fetchGroupLiveSessions]);

  const filteredRows = useMemo(() => {
    const search = String(searchTerm || "").toLowerCase().trim();
    const status = String(statusFilter || "").toLowerCase().trim();

    return (rows || []).filter((item) => {
      const fullText = [
        item?.programme_name,
        item?.programme_stage,
        item?.programme_description,
        item?.title,
        item?.subjectname,
        item?.teacher_name,
        item?.session_date,
        item?.slot_start,
        item?.slot_end,
        item?.status,
        item?.group_batch_id,
      ]
        .join(" ")
        .toLowerCase();

      const itemStatus = String(item?.status || "").toLowerCase();

      return (
        (!search || fullText.includes(search)) &&
        (!status || itemStatus === status)
      );
    });
  }, [rows, searchTerm, statusFilter]);

  const groupedProgrammes = useMemo(() => {
    const map = {};

    (filteredRows || []).forEach((item) => {
      const programmeId = String(item?.programme_id || "unknown");
      const status = String(item?.status || "active").toLowerCase();
      const groupBatchId = getGroupBatchId(item);
      const batchKey =
        groupBatchId > 0 ? `batch_${groupBatchId}` : getWeekKey(item?.session_date);

      const groupKey = [programmeId, status, batchKey].join("_");

      if (!map[groupKey]) {
        map[groupKey] = {
          group_key: groupKey,
          programme_id: item?.programme_id,
          group_batch_id: groupBatchId,
          programme_name: item?.programme_name || "-",
          programme_stage: item?.programme_stage || "-",
          programme_description: item?.programme_description || "",
          weekly_price: item?.weekly_price || 0,
          capacity: item?.capacity || 0,
          status: item?.status || "active",
          createddate: item?.createddate || "",
          batch_key: batchKey,
          batch_label:
            groupBatchId > 0
              ? `Batch #${groupBatchId}`
              : `Batch: ${formatDate(item?.createddate)}`,
          week_key: getWeekKey(item?.session_date),
          sessions: [],
        };
      }

      map[groupKey].sessions.push({
        ...item,
        timezone_location:
          item?.timezone_location ||
          item?.teacher_timezone_location ||
          item?.source_timezone ||
          item?.timezone ||
          "",
        timezone:
          item?.timezone ||
          item?.timezone_location ||
          item?.teacher_timezone_location ||
          item?.source_timezone ||
          "",
      });
    });

    return Object.values(map)
      .map((programme) => {
        const sessions = [...programme.sessions].sort((a, b) => {
          const da = `${a?.session_date || ""} ${a?.slot_start || ""}`;
          const db = `${b?.session_date || ""} ${b?.slot_start || ""}`;

          return (
            moment(da, "YYYY-MM-DD HH:mm:ss").valueOf() -
            moment(db, "YYYY-MM-DD HH:mm:ss").valueOf()
          );
        });

        const capacities = sessions.map((s) => Number(s?.capacity || 0));
        const seats = sessions.map((s) =>
          Number(s?.seats_left ?? s?.capacity ?? 0)
        );
        const bookedCounts = sessions.map((s) => Number(s?.booked_count || 0));

        const programmeCapacity = capacities.length
          ? Math.max(...capacities)
          : Number(programme.capacity || 0);

        const programmeSeatsLeft = seats.length
          ? Math.min(...seats)
          : programmeCapacity;

        const bookedSessions = bookedCounts.length
          ? Math.max(...bookedCounts)
          : Math.max(programmeCapacity - programmeSeatsLeft, 0);

        return {
          ...programme,
          sessions,
          total_classes: sessions.length,
          capacity: programmeCapacity,
          seats_left: programmeSeatsLeft,
          booked_count: bookedSessions,
        };
      })
      .sort((a, b) => {
        const statusOrder = {
          active: 1,
          completed: 2,
          cancelled: 3,
        };

        const sa = statusOrder[String(a.status || "").toLowerCase()] || 9;
        const sb = statusOrder[String(b.status || "").toLowerCase()] || 9;

        if (sa !== sb) return sa - sb;

        const ba = Number(a.group_batch_id || 0);
        const bb = Number(b.group_batch_id || 0);

        if (ba !== bb) return bb - ba;

        const ca =
          moment(a.createddate, "YYYY-MM-DD HH:mm:ss", true).valueOf() || 0;
        const cb =
          moment(b.createddate, "YYYY-MM-DD HH:mm:ss", true).valueOf() || 0;

        if (ca !== cb) return cb - ca;

        return Number(a.programme_id) - Number(b.programme_id);
      });
  }, [filteredRows]);

  const patchRowsStatus = (sessionIds, nextStatus) => {
    const idSet = new Set(sessionIds.map((id) => String(id)));

    setRows((prev) =>
      prev.map((row) =>
        idSet.has(String(row?.id))
          ? {
            ...row,
            status: nextStatus,
          }
          : row
      )
    );
  };

  const updateSingleSessionStatus = async (sessionId, nextStatus, token) => {
    const conditionId = /^\d+$/.test(String(sessionId))
      ? Number(sessionId)
      : sessionId;

    const payload = {
      token,
      tablename: "group_live_sessions",
      conditions: [
        {
          id: conditionId,
        },
      ],
      updatedata: [
        {
          status: nextStatus,
        },
      ],
    };

    const response = await axios.post(UPDATE_DYNAMIC_DATA_URL, payload, {
      headers: API_HEADERS,
    });

    if (Number(response?.data?.statusCode) !== 200) {
      throw new Error(
        response?.data?.message ||
        `Session ID ${sessionId} status update failed.`
      );
    }

    return response.data;
  };

  const handleStatusDraftChange = (groupKey, value) => {
    setStatusDraftMap((prev) => ({
      ...prev,
      [groupKey]: value,
    }));
  };

  const isStatusSaving = (groupKey) => {
    return !!savingStatusMap[String(groupKey)];
  };

  const setStatusSaving = (groupKey, saving) => {
    setSavingStatusMap((prev) => ({
      ...prev,
      [String(groupKey)]: saving,
    }));
  };

  const handleSaveBatchStatus = async (programme) => {
    const groupKey = programme?.group_key;
    const currentStatus = String(programme?.status || "active").toLowerCase();

    const nextStatus = String(
      statusDraftMap[groupKey] || currentStatus
    ).toLowerCase();

    if (!groupKey) {
      Swal.fire({
        icon: "error",
        title: "Group Missing",
        text: "Programme group key not found.",
      });
      return;
    }

    if (currentStatus === "completed") {
      Swal.fire({
        icon: "info",
        title: "Already Completed",
        text: "Completed batch status cannot be changed.",
        timer: 1600,
        timerProgressBar: true,
      });
      return;
    }

    if (!STATUS_OPTIONS.includes(nextStatus)) {
      Swal.fire({
        icon: "error",
        title: "Invalid Status",
        text: "Please select a valid status.",
      });
      return;
    }

    if (nextStatus === currentStatus) {
      Swal.fire({
        icon: "info",
        title: "No Changes",
        text: "Status is already the same.",
        timer: 1600,
        timerProgressBar: true,
      });
      return;
    }

    const sessionIds = (programme?.sessions || [])
      .map((s) => s?.id)
      .filter(Boolean);

    if (sessionIds.length === 0) {
      Swal.fire({
        icon: "error",
        title: "Sessions Missing",
        text: "No sessions found for this programme batch.",
      });
      return;
    }

    const confirmResult = await Swal.fire({
      icon: "warning",
      title: "Update Status?",
      html: `
        <div style="text-align:center; line-height:1.7;">
          <div>Are you sure you want to update this programme batch status?</div>
          <div style="margin-top:10px;">
            <strong>Programme:</strong> ${programme?.programme_name || "-"}<br/>
            <strong>Classes:</strong> ${sessionIds.length}<br/>
            <strong>Current:</strong> ${currentStatus}<br/>
            <strong>New:</strong> ${nextStatus}
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Yes, Update",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
    });

    if (!confirmResult.isConfirmed) return;

    setStatusSaving(groupKey, true);

    const previousStatus = currentStatus;

    patchRowsStatus(sessionIds, nextStatus);

    try {
      const token = await getTokenValue();

      if (!token) {
        throw new Error("Token not found.");
      }

      for (const sessionId of sessionIds) {
        await updateSingleSessionStatus(sessionId, nextStatus, token);
      }

      setStatusDraftMap((prev) => ({
        ...prev,
        [groupKey]: nextStatus,
      }));

      await Swal.fire({
        icon: "success",
        title: "Updated Successfully",
        text: "Programme batch status has been updated successfully.",
        confirmButtonText: "OK",
        timer: 1700,
        timerProgressBar: true,
      });

      await fetchGroupLiveSessions();
    } catch (err) {
      patchRowsStatus(sessionIds, previousStatus);

      setStatusDraftMap((prev) => ({
        ...prev,
        [groupKey]: previousStatus,
      }));

      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: err?.message || "Something went wrong while updating status.",
      });
    } finally {
      setStatusSaving(groupKey, false);
    }
  };

  const openCreateModal = (programme = null) => {
    setCreateModalMode("create");
    setSelectedProgrammeForCreate(programme);
    setIsCreateOpen(true);
  };

  const openEditModal = (programme) => {
    if (!programme) {
      Swal.fire({
        icon: "error",
        title: "Programme Missing",
        text: "Programme data not found.",
      });
      return;
    }

    if (!canEditProgramme(programme)) {
      Swal.fire({
        icon: "info",
        title: "Edit Not Allowed",
        text: "This programme already has a group booking, so it cannot be edited.",
        timer: 2200,
        timerProgressBar: true,
      });
      return;
    }

    setCreateModalMode("edit");
    setSelectedProgrammeForCreate(programme);
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setSelectedProgrammeForCreate(null);
    setCreateModalMode("create");
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    setSelectedProgrammeForCreate(null);
    setCreateModalMode("create");
    fetchGroupLiveSessions();
  };

  const openDetailsModal = (programme) => {
    setSelectedProgrammeDetails(programme);
    setDetailsOpen(true);
  };

  const closeDetailsModal = () => {
    setSelectedProgrammeDetails(null);
    setDetailsOpen(false);
  };

  const openBookingModal = (programme) => {
    setSelectedProgrammeForBooking(programme);
    setBookingOpen(true);
  };

  const closeBookingModal = () => {
    setSelectedProgrammeForBooking(null);
    setBookingOpen(false);
  };

  const openWeeklyTimetableModal = () => {
    setWeeklyTimetableOpen(true);
  };

  const closeWeeklyTimetableModal = () => {
    setWeeklyTimetableOpen(false);
  };

  const openGroupProgrammeModal = () => {
    setGroupProgrammeModalOpen(true);
  };

  const closeGroupProgrammeModal = () => {
    setGroupProgrammeModalOpen(false);
  };

  return (
    <div className="card h-100 p-0 radius-12">
      <style>{`
        .gl-main-table thead th {
          white-space: nowrap;
        }

        .gl-main-table tbody td {
          vertical-align: middle;
        }

        .gl-programme-title {
          color: var(--bs-emphasis-color) !important;
          font-weight: 800;
        }

        .gl-programme-desc {
          max-width: 420px;
          color: var(--bs-secondary-color) !important;
          font-size: 13px;
          line-height: 1.5;
        }

        .gl-batch-text {
          color: var(--bs-secondary-color) !important;
          font-size: 12px;
          font-weight: 600;
          margin-top: 4px;
        }

        .gl-status-update-wrap {
          min-width: 210px;
        }

        .gl-status-update-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .gl-status-select {
          min-width: 116px;
          height: 34px;
          font-size: 13px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .gl-status-save-btn {
          height: 34px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        [data-bs-theme="dark"] .gl-programme-title,
        [data-theme="dark"] .gl-programme-title,
        .dark .gl-programme-title,
        body.dark .gl-programme-title {
          color: #ffffff !important;
        }

        [data-bs-theme="dark"] .gl-programme-desc,
        [data-theme="dark"] .gl-programme-desc,
        .dark .gl-programme-desc,
        body.dark .gl-programme-desc,
        [data-bs-theme="dark"] .gl-batch-text,
        [data-theme="dark"] .gl-batch-text,
        .dark .gl-batch-text,
        body.dark .gl-batch-text {
          color: #b8c4d6 !important;
        }

        .gl-create-btn,
.gl-weekly-btn,
.gl-group-programme-btn {
  border-radius: 999px;
  padding: 10px 18px;
  width: fit-content;
  max-width: fit-content;
  flex: 0 0 auto;
  font-weight: 800;
}

.gl-group-programme-btn {
  color: #f59e0b !important;
  border: 1px solid #f59e0b !important;
  background: transparent !important;
  box-shadow: 0 10px 24px rgba(245, 158, 11, 0.14);
}

        .gl-create-btn {
          box-shadow: 0 10px 24px rgba(25, 135, 84, 0.20);
        }

        .gl-create-plus {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255,255,255,0.22);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          line-height: 1;
        }

        .gl-action-btn {
          min-width: 82px;
          justify-content: center;
          border-radius: 8px;
          font-weight: 800;
        }

        .gl-action-edit-btn {
          color: #111827 !important;
        }

        .gl-action-edit-btn:disabled {
          opacity: 0.52;
          cursor: not-allowed;
          color: #111827 !important;
        }
      `}</style>

      <div className="card-body p-24">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div>
            <h5 className="mb-1">Live Group Programmes</h5>
            <p className="text-secondary-light mb-0"></p>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2 gl-weekly-btn"
              onClick={openWeeklyTimetableModal}
            >
              <Icon icon="mdi:calendar-week-outline" />
              Weekly Timetable
            </button>

            <button
              type="button"
              className="btn btn-outline-info btn-sm d-inline-flex align-items-center gap-2 gl-group-programme-btn"
              onClick={openGroupProgrammeModal}
            >
              <Icon icon="mdi:playlist-plus" />
              Create Group Programme
            </button>

            <button
              type="button"
              className="btn btn-success btn-sm d-inline-flex align-items-center gap-2 gl-create-btn"
              onClick={() => openCreateModal(null)}
            >
              <span className="gl-create-plus">+</span>
              Create Live Group
            </button>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
          <input
            type="text"
            className="form-control"
            style={{ maxWidth: 340 }}
            placeholder="Search programme..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="form-select"
            style={{ maxWidth: 220 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Status: All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("");
            }}
          >
            Reset
          </button>
        </div>

        {loadError ? (
          <div className="alert alert-danger py-2">{loadError}</div>
        ) : null}

        {loading ? (
          <div className="py-5 text-center">
            <div className="spinner-border text-primary" role="status" />
            <div className="mt-2 text-secondary-light">
              Loading live group programmes...
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table bordered-table mb-0 gl-main-table">
              <thead>
                <tr>
                  <th>S.L</th>
                  <th>Programme</th>
                  <th>Stage</th>
                  <th>Weekly Fee</th>
                  <th>Classes</th>
                  <th>Capacity</th>
                  <th> Booked Seats</th>
                  <th>Seats Left</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {groupedProgrammes.length === 0 ? (
                  <tr>
                    <td
                      colSpan="10"
                      className="text-center py-4 text-secondary-light"
                    >
                      No live group programmes found.
                    </td>
                  </tr>
                ) : (
                  groupedProgrammes.map((programme, index) => {
                    const groupKey =
                      programme.group_key ||
                      `${programme.programme_id}_${programme.status}_${programme.createddate}_${index}`;

                    const saving = isStatusSaving(groupKey);

                    const currentStatus = String(
                      programme.status || "active"
                    ).toLowerCase();

                    const draftStatus = String(
                      statusDraftMap[groupKey] || currentStatus
                    ).toLowerCase();

                    const isCompleted = currentStatus === "completed";
                    const isActive = currentStatus === "active";
                    const bookedCount = getProgrammeBookedCount(programme);
                    const editAllowed = canEditProgramme(programme);

                    return (
                      <tr key={groupKey}>
                        <td>{index + 1}</td>

                        <td>
                          <div className="gl-programme-title">
                            {programme.programme_name}
                          </div>
                          <div className="gl-programme-desc">
                            {getShortDescription(
                              programme.programme_description,
                              95
                            )}
                          </div>

                          {programme.group_batch_id ? (
                            <div className="gl-batch-text">
                              Batch #{programme.group_batch_id}
                            </div>
                          ) : programme.createddate ? (
                            <div className="gl-batch-text">
                              Batch: {formatDate(programme.createddate)}
                            </div>
                          ) : null}
                        </td>

                        <td>{programme.programme_stage || "-"}</td>

                        <td>
                          AED {Number(programme.weekly_price || 0).toFixed(2)}
                        </td>

                        <td>
                          <span className="badge bg-success">
                            {Number(programme.total_classes || 0)}{" "}
                            {Number(programme.total_classes || 0) === 1 ? "Class" : "Classes"}
                          </span>
                        </td>

                        <td>{programme.capacity || "-"}</td>
                        <td>{bookedCount}</td>
                        <td>{programme.seats_left ?? "-"}</td>

                        <td>
                          {isCompleted ? (
                            <div className="gl-status-update-wrap">
                              <span
                                className={`badge ${getStatusBadgeClass(
                                  currentStatus
                                )}`}
                              >
                                {currentStatus}
                              </span>
                            </div>
                          ) : (
                            <div className="gl-status-update-wrap">
                              <div className="mb-1">
                                <span
                                  className={`badge ${getStatusBadgeClass(
                                    currentStatus
                                  )}`}
                                >
                                  Current: {currentStatus}
                                </span>
                              </div>

                              <div className="gl-status-update-row">
                                <select
                                  className="form-select form-select-sm gl-status-select"
                                  value={draftStatus}
                                  disabled={saving}
                                  onChange={(e) =>
                                    handleStatusDraftChange(
                                      groupKey,
                                      e.target.value
                                    )
                                  }
                                >
                                  {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary gl-status-save-btn"
                                  disabled={
                                    saving || draftStatus === currentStatus
                                  }
                                  onClick={() =>
                                    handleSaveBatchStatus(programme)
                                  }
                                >
                                  {saving ? "Saving..." : "Save"}
                                </button>
                              </div>
                            </div>
                          )}
                        </td>

                        <td>
                          <div className="d-flex gap-2 flex-wrap">
                            <button
                              type="button"
                              className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 gl-action-btn"
                              onClick={() => openDetailsModal(programme)}
                            >
                              <Icon icon="mdi:eye-outline" />
                              View
                            </button>

                            <button
                              type="button"
                              className="btn btn-sm btn-warning d-inline-flex align-items-center gap-1 gl-action-btn gl-action-edit-btn"
                              disabled={!editAllowed}
                              title={
                                editAllowed
                                  ? "Edit Programme"
                                  : "Booking already exists, edit disabled"
                              }
                              onClick={() => openEditModal(programme)}
                            >
                              <Icon icon="mdi:pencil-outline" />
                              Edit
                            </button>

                            {isActive ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-success d-inline-flex align-items-center gap-1 gl-action-btn"
                                onClick={() => openBookingModal(programme)}
                              >
                                <Icon icon="mdi:calendar-plus-outline" />
                                Book
                              </button>
                            ) : null}
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

      <GroupProgrammeDetailsModal
        open={detailsOpen}
        programme={selectedProgrammeDetails}
        onClose={closeDetailsModal}
      />

      <CreateGroupBatchBookingModal
        open={bookingOpen}
        programme={selectedProgrammeForBooking}
        onClose={closeBookingModal}
        onSuccess={(data) => {
          console.log("GROUP BOOKING CREATED FROM MODAL =>", data);
          closeBookingModal();
          fetchGroupLiveSessions();
        }}
      />

      <CreateLiveGroupModal
        isOpen={isCreateOpen}
        mode={createModalMode}
        editProgramme={
          createModalMode === "edit" ? selectedProgrammeForCreate : null
        }
        preselectedProgramme={
          createModalMode === "create" ? selectedProgrammeForCreate : null
        }
        onClose={closeCreateModal}
        onSuccess={handleCreateSuccess}
      />

      {weeklyTimetableOpen && (
        <WeeklyTimetableModal onClose={closeWeeklyTimetableModal} />
      )}
      <CreateGroupProgrammeModal
        open={groupProgrammeModalOpen}
        onClose={closeGroupProgrammeModal}
        onSuccess={() => {
          fetchGroupLiveSessions();
        }}
      />
    </div>
  );
};

export default GroupLiveSessionsLayer;