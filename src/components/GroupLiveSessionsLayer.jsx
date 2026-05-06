import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import { Icon } from "@iconify/react";
import { getToken } from "../api/getToken";
import CreateLiveGroupModal from "./CreateLiveGroupModal";

const RUN_STORED_PROCEDURE_URL =
    "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const API_HEADERS = {
    projectid: "1",
    userid: "test",
    password: "test",
    "x-api-key": "abc123456789",
    "Content-Type": "application/json",
};

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

        .gl-mobile-class-card {
          display: none;
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

          .gl-classes-desktop {
            display: none;
          }

          .gl-mobile-class-card {
            display: block;
          }

          .gl-mobile-session {
            border-bottom: 1px solid rgba(148, 163, 184, 0.14);
            padding: 16px;
            background: #243247;
          }

          .gl-mobile-session:last-child {
            border-bottom: 0;
          }

          .gl-mobile-label {
            color: #9fb0c8;
            font-size: 12px;
            font-weight: 800;
            margin-bottom: 3px;
          }

          .gl-mobile-value {
            color: #ffffff;
            font-size: 14px;
            font-weight: 800;
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

            <div
                className="gl-details-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="gl-details-header d-flex justify-content-between align-items-start gap-3">
                    <div>
                        <h2 className="gl-details-title">{programme.programme_name}</h2>
                        <div className="gl-details-stage">
                            {programme.programme_stage || "-"}
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
                                <div className="gl-stat-value">{sessions.length} / 3</div>
                            </div>
                        </div>

                        <div className="col-xl-3 col-md-6">
                            <div className="gl-stat-card">
                                <div className="gl-stat-label">Capacity</div>
                                <div className="gl-stat-value">
                                    {programme.capacity || "-"}
                                </div>
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

                        <div className="gl-classes-desktop">
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
                                sessions.map((session, index) => (
                                    <div className="gl-class-row" key={session?.id || index}>
                                        <div className="gl-class-cell">{index + 1}</div>

                                        <div className="gl-class-cell gl-class-subject">
                                            {session?.subjectname || "-"}
                                        </div>

                                        <div className="gl-class-cell">
                                            {session?.title || "-"}
                                        </div>

                                        <div className="gl-class-cell">
                                            {session?.teacher_name || "-"}
                                        </div>

                                        <div className="gl-class-cell">
                                            {formatDate(session?.session_date)}
                                        </div>

                                        <div className="gl-class-cell">
                                            {formatTime(session?.slot_start)} -{" "}
                                            {formatTime(session?.slot_end)}
                                        </div>

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
                                ))
                            )}
                        </div>

                        <div className="gl-mobile-class-card">
                            {sessions.length === 0 ? (
                                <div className="p-4 text-center gl-class-muted">
                                    No classes added for this programme.
                                </div>
                            ) : (
                                sessions.map((session, index) => (
                                    <div className="gl-mobile-session" key={session?.id || index}>
                                        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                                            <div>
                                                <div className="gl-mobile-label">Class {index + 1}</div>
                                                <div className="gl-mobile-value">
                                                    {session?.subjectname || "-"}
                                                </div>
                                            </div>

                                            <span
                                                className={`badge ${getStatusBadgeClass(
                                                    session?.status
                                                )}`}
                                            >
                                                {session?.status || "-"}
                                            </span>
                                        </div>

                                        <div className="row g-3">
                                            <div className="col-12">
                                                <div className="gl-mobile-label">Title</div>
                                                <div className="gl-mobile-value">
                                                    {session?.title || "-"}
                                                </div>
                                            </div>

                                            <div className="col-6">
                                                <div className="gl-mobile-label">Teacher</div>
                                                <div className="gl-mobile-value">
                                                    {session?.teacher_name || "-"}
                                                </div>
                                            </div>

                                            <div className="col-6">
                                                <div className="gl-mobile-label">Date</div>
                                                <div className="gl-mobile-value">
                                                    {formatDate(session?.session_date)}
                                                </div>
                                            </div>

                                            <div className="col-6">
                                                <div className="gl-mobile-label">Slot</div>
                                                <div className="gl-mobile-value">
                                                    {formatTime(session?.slot_start)} -{" "}
                                                    {formatTime(session?.slot_end)}
                                                </div>
                                            </div>

                                            <div className="col-3">
                                                <div className="gl-mobile-label">Cap.</div>
                                                <div className="gl-mobile-value">
                                                    {session?.capacity || "-"}
                                                </div>
                                            </div>

                                            <div className="col-3">
                                                <div className="gl-mobile-label">Booked</div>
                                                <div className="gl-mobile-value">
                                                    {session?.booked_count ?? 0}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
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

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedProgrammeForCreate, setSelectedProgrammeForCreate] =
        useState(null);

    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedProgrammeDetails, setSelectedProgrammeDetails] =
        useState(null);

    const buildHeaders = async () => {
        const tokenRes = await getToken();
        const token = resolveToken(tokenRes);

        return {
            ...API_HEADERS,
            ...(token ? { token } : {}),
        };
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

            if (!map[programmeId]) {
                map[programmeId] = {
                    programme_id: item?.programme_id,
                    programme_name: item?.programme_name || "-",
                    programme_stage: item?.programme_stage || "-",
                    programme_description: item?.programme_description || "",
                    weekly_price: item?.weekly_price || 0,
                    capacity: item?.capacity || 0,
                    status: item?.programme_status || "active",
                    sessions: [],
                };
            }

            map[programmeId].sessions.push(item);
        });

        return Object.values(map)
            .map((programme) => {
                const sessions = programme.sessions.sort((a, b) => {
                    const da = `${a?.session_date || ""} ${a?.slot_start || ""}`;
                    const db = `${b?.session_date || ""} ${b?.slot_start || ""}`;

                    return moment(da, "YYYY-MM-DD HH:mm:ss").valueOf() -
                        moment(db, "YYYY-MM-DD HH:mm:ss").valueOf();
                });

                const capacities = sessions.map((s) => Number(s?.capacity || 0));
                const seats = sessions.map((s) =>
                    Number(s?.seats_left ?? s?.capacity ?? 0)
                );

                return {
                    ...programme,
                    sessions,
                    total_classes: sessions.length,
                    capacity: capacities.length
                        ? Math.max(...capacities)
                        : programme.capacity,
                    seats_left: seats.length ? Math.min(...seats) : 0,
                    booked_count: sessions.reduce(
                        (sum, s) => sum + Number(s?.booked_count || 0),
                        0
                    ),
                };
            })
            .sort((a, b) => Number(a.programme_id) - Number(b.programme_id));
    }, [filteredRows]);

    const openCreateModal = (programme = null) => {
        setSelectedProgrammeForCreate(programme);
        setIsCreateOpen(true);
    };

    const openDetailsModal = (programme) => {
        setSelectedProgrammeDetails(programme);
        setDetailsOpen(true);
    };

    const closeDetailsModal = () => {
        setSelectedProgrammeDetails(null);
        setDetailsOpen(false);
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

[data-bs-theme="dark"] .gl-programme-title,
[data-theme="dark"] .gl-programme-title,
.dark .gl-programme-title,
body.dark .gl-programme-title {
  color: #ffffff !important;
}

[data-bs-theme="dark"] .gl-programme-desc,
[data-theme="dark"] .gl-programme-desc,
.dark .gl-programme-desc,
body.dark .gl-programme-desc {
  color: #b8c4d6 !important;
}

        .gl-create-btn {
          border-radius: 999px;
          padding: 10px 18px;
          width: fit-content;
          max-width: fit-content;
          flex: 0 0 auto;
          font-weight: 800;
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
      `}</style>

            <div className="card-body p-24">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                    <div>
                        <h5 className="mb-1">Live Group Programmes</h5>
                        <p className="text-secondary-light mb-0">

                        </p>
                    </div>

                    <button
                        type="button"
                        className="btn btn-success btn-sm d-inline-flex align-items-center gap-2 gl-create-btn"
                        onClick={() => openCreateModal(null)}
                    >
                        <span className="gl-create-plus">+</span>
                        Create Live Group
                    </button>
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
                                    <th>Booked</th>
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
                                    groupedProgrammes.map((programme, index) => (
                                        <tr key={programme.programme_id || index}>
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
                                            </td>

                                            <td>{programme.programme_stage || "-"}</td>

                                            <td>
                                                AED {Number(programme.weekly_price || 0).toFixed(2)}
                                            </td>

                                            <td>
                                                <span
                                                    className={`badge ${Number(programme.total_classes) >= 3
                                                            ? "bg-success"
                                                            : "bg-warning text-dark"
                                                        }`}
                                                >
                                                    {programme.total_classes} / 3
                                                </span>
                                            </td>

                                            <td>{programme.capacity || "-"}</td>
                                            <td>{programme.booked_count ?? 0}</td>
                                            <td>{programme.seats_left ?? "-"}</td>

                                            <td>
                                                <span
                                                    className={`badge ${getStatusBadgeClass(
                                                        programme.status
                                                    )}`}
                                                >
                                                    {programme.status || "active"}
                                                </span>
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                                                    onClick={() => openDetailsModal(programme)}
                                                >
                                                    <Icon icon="mdi:eye-outline" />
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))
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

            <CreateLiveGroupModal
                isOpen={isCreateOpen}
                preselectedProgramme={selectedProgrammeForCreate}
                onClose={() => {
                    setIsCreateOpen(false);
                    setSelectedProgrammeForCreate(null);
                }}
                onSuccess={() => {
                    setIsCreateOpen(false);
                    setSelectedProgrammeForCreate(null);
                    fetchGroupLiveSessions();
                }}
            />
        </div>
    );
};

export default GroupLiveSessionsLayer;