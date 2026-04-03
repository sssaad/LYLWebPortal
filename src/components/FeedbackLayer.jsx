import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import moment from "moment";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
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

const SEND_PROGRESS_EMAIL_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=send_progress_report_email";

// ✅ helpers (moment formatting)
const formatDate = (d) => {
  if (!d) return "";
  const m = moment(
    d,
    [
      "YYYY-MM-DD",
      "YYYY/MM/DD",
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DDTHH:mm:ss",
      moment.ISO_8601,
    ],
    true
  );
  if (m.isValid()) return m.format("DD MMM YYYY");

  const loose = moment(d);
  return loose.isValid() ? loose.format("DD MMM YYYY") : String(d);
};

const formatTime = (t) => {
  if (!t) return "";
  const m = moment(t, ["HH:mm:ss", "HH:mm", "hh:mm A", "h:mm A"], true);
  if (m.isValid()) return m.format("hh:mm A");

  const loose = moment(t);
  return loose.isValid() ? loose.format("hh:mm A") : String(t);
};

// ✅ Normalize URL (handles JSON escaped https:\/\/)
const normalizeUrl = (u) => String(u || "").replace(/\\\//g, "/").trim();

// ✅ theme detection (works for light/dark)
const detectIsDark = () => {
  try {
    const body = document.body;

    const byAttr =
      body?.dataset?.theme?.toLowerCase() === "dark" ||
      body?.getAttribute("data-theme")?.toLowerCase() === "dark";

    const byClass =
      body?.classList?.contains("dark") ||
      body?.classList?.contains("theme-dark") ||
      body?.classList?.contains("dark-mode") ||
      body?.classList?.contains("bg-dark");

    if (byAttr || byClass) return true;

    if (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches) return true;

    const bg = window.getComputedStyle(body).backgroundColor;
    const m = bg.match(/\d+/g);
    if (m?.length >= 3) {
      const r = Number(m[0]);
      const g = Number(m[1]);
      const b = Number(m[2]);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness < 128;
    }

    return false;
  } catch {
    return false;
  }
};

// ✅ SORTING HELPERS
const parseBookDateTs = (d) => {
  const s = String(d || "").trim();
  if (!s) return 0;

  let m = moment(
    s,
    [
      "YYYY-MM-DD",
      "YYYY/MM/DD",
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DDTHH:mm:ss",
      "DD MMM YYYY",
      moment.ISO_8601,
    ],
    true
  );

  if (!m.isValid()) m = moment(s); // fallback (non-strict)
  return m.isValid() ? m.valueOf() : 0;
};

const parseTimeMinutes = (t) => {
  const s = String(t || "").trim();
  if (!s) return -1;

  let m = moment(s, ["HH:mm:ss", "HH:mm", "hh:mm A", "h:mm A"], true);
  if (!m.isValid()) m = moment(s);
  return m.isValid() ? m.hours() * 60 + m.minutes() : -1;
};

const FeedbackLayer = () => {
  const [rows, setRows] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);

  // ✅ Recording modal states
  const [isRecordingOpen, setIsRecordingOpen] = useState(false);
  const [activeRecordingUrl, setActiveRecordingUrl] = useState("");

  const openRecording = (row) => {
    const url = normalizeUrl(
      row?.recordingUrl ?? row?.s3Url ?? row?.s3_url ?? row?.recording_s3_url
    );
    if (!url) return;
    setActiveRecordingUrl(url);
    setIsRecordingOpen(true);
  };

  const closeRecording = () => {
    setIsRecordingOpen(false);
    setActiveRecordingUrl("");
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 15;

  // Loading states
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [sendingSessionId, setSendingSessionId] = useState(null); // ✅ per-row sending

  // Theme state
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  const ENUM_OPTIONS = ["Excellent", "Good", "Satisfactory", "Poor", "Very Poor"];

  // ✅ FILTER STATES (NEW)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | sent
  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState(""); // YYYY-MM-DD

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  // ✅ set theme (and keep it updated)
  useEffect(() => {
    const updateTheme = () => setIsDarkTheme(detectIsDark());
    updateTheme();

    const obs = new MutationObserver(updateTheme);
    obs.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onMq = () => updateTheme();
    mq?.addEventListener?.("change", onMq);

    return () => {
      obs.disconnect();
      mq?.removeEventListener?.("change", onMq);
    };
  }, []);

  // ✅ fetch performance rows
  useEffect(() => {
    const fetchRows = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Token not found");

        const headers = { ...BASE_HEADERS, token };
        const body = { procedureName: "get_performance" };

        const res = await axios.post(RUN_SP_URL, body, { headers });
        const data = res?.data?.data ?? [];

        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((item) => {
            const rawBookDate =
              item.booking_date ?? item.book_date ?? item.bookDate ?? "";
            const rawStart =
              item.booking_start_time ??
              item.slot_start ??
              item.slot1_time ??
              item.slotStart ??
              "";
            const rawEnd =
              item.booking_end_time ??
              item.slot_end ??
              item.slot2_time ??
              item.slotEnd ??
              "";

            const emailStatus = (item.email_status ?? item.emailStatus ?? "pending")
              .toString()
              .toLowerCase();

            // ✅ recording URL from SP response: s3Url (fallbacks included)
            const recordingUrl = normalizeUrl(
              item.s3Url ??
                item.s3_url ??
                item.recording_s3_url ??
                item.recordingUrl ??
                ""
            );

            // ✅ CONCAT names (firstname + lastname)
            const studentFull = [item.student_firstname, item.student_lastname]
              .filter(Boolean)
              .join(" ")
              .trim();

            const teacherFull = [item.teacher_firstname, item.teacher_lastname]
              .filter(Boolean)
              .join(" ")
              .trim();

            return {
              id: item.id,
              sessionid: item.sessionid,

              // ✅ recording
              recordingUrl,

              // UI display
              bookDate: formatDate(rawBookDate),
              slotStart: formatTime(rawStart),
              slotEnd: formatTime(rawEnd),

              // ✅ for sorting + date filtering
              bookDateRaw: rawBookDate,
              bookDateTs: parseBookDateTs(rawBookDate),
              slotStartMin: parseTimeMinutes(rawStart),

              email_status: emailStatus || "pending",
              isEmailSent: emailStatus === "sent",

              // ✅ prefer concatenated names, else fallback
              studentName:
                studentFull ||
                item.student_fullname ||
                item.student_name ||
                item.student?.name ||
                item.studentName ||
                item.username ||
                "",

              teacherName:
                teacherFull ||
                item.teacher_fullname ||
                item.teacher_name ||
                item.teacher?.name ||
                item.teacherName ||
                "",

              punctuality: item.punctuality ?? "",
              engagement: item.engagement ?? "",
              behaviour: item.behaviour ?? "",
              understanding: item.understanding ?? "",
              final_class_grade: item.final_class_grade ?? "",
              teacher_feedback: item.teacher_feedback ?? "",
              topics_covered_today: item.topics_covered_today ?? "",
              what_went_well_today: item.what_went_well_today ?? "",
              areas_for_development: item.areas_for_development ?? "",
              recommended_next_steps: item.recommended_next_steps ?? "",
              next_lesson_plan: item.next_lesson_plan ?? "",
            };
          });

          setRows(mapped);
          setCurrentPage(1);
        } else {
          setRows([]);
          setCurrentPage(1);
        }
      } catch (e) {
        console.error(e);
        setRows([]);
        setCurrentPage(1);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchRows();
  }, []);

  // ✅ FILTER + SORT (NEW)
  const filteredSortedRows = useMemo(() => {
    const arr = Array.isArray(rows) ? [...rows] : [];

    // date range ts
    const fromTs = dateFrom
      ? moment(dateFrom, "YYYY-MM-DD").startOf("day").valueOf()
      : null;
    const toTs = dateTo
      ? moment(dateTo, "YYYY-MM-DD").endOf("day").valueOf()
      : null;

    const q = String(search || "").trim().toLowerCase();

    const filtered = arr.filter((r) => {
      // status filter
      if (statusFilter !== "all") {
        const isSent = (r.email_status || "").toLowerCase() === "sent" || r.isEmailSent;
        if (statusFilter === "sent" && !isSent) return false;
        if (statusFilter === "pending" && isSent) return false;
      }

      // date filter
      if (fromTs != null || toTs != null) {
        const ts = Number(r.bookDateTs || 0);
        if (!ts) return false;
        if (fromTs != null && ts < fromTs) return false;
        if (toTs != null && ts > toTs) return false;
      }

      // search filter
      if (q) {
        const blob = `${r.sessionid ?? ""} ${r.bookDate ?? ""} ${r.studentName ?? ""} ${r.teacherName ?? ""
          } ${r.slotStart ?? ""} ${r.slotEnd ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }

      return true;
    });

    // latest first
    filtered.sort((a, b) => {
      const d = (b.bookDateTs || 0) - (a.bookDateTs || 0);
      if (d !== 0) return d;

      const t = (b.slotStartMin ?? -1) - (a.slotStartMin ?? -1);
      if (t !== 0) return t;

      return Number(b.sessionid || 0) - Number(a.sessionid || 0);
    });

    return filtered;
  }, [rows, search, statusFilter, dateFrom, dateTo]);

  // Pagination (use filteredSortedRows)
  const indexOfLast = currentPage * perPage;
  const indexOfFirst = indexOfLast - perPage;
  const currentRows = filteredSortedRows.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredSortedRows.length / perPage) || 1;

  const handlePageChange = (n) => setCurrentPage(n);

  useEffect(() => {
    if (filteredSortedRows.length === 0) setCurrentPage(1);
    else if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filteredSortedRows.length, totalPages, currentPage]);

  // ✅ when filters change => page 1
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, dateFrom, dateTo]);

  // ✅ open modal (always)
  const openFeedbackModal = (row) => {
    setCurrentRow({
      ...row,
      punctuality: row.punctuality || "",
      engagement: row.engagement || "",
      behaviour: row.behaviour || "",
      understanding: row.understanding || "",
      final_class_grade: row.final_class_grade || "",
      teacher_feedback: row.teacher_feedback || "",
      topics_covered_today: row.topics_covered_today || "",
      what_went_well_today: row.what_went_well_today || "",
      areas_for_development: row.areas_for_development || "",
      recommended_next_steps: row.recommended_next_steps || "",
      next_lesson_plan: row.next_lesson_plan || "",
    });
    setShowModal(true);
  };

  const handleFeedbackChange = (field, value) => {
    setCurrentRow((prev) => ({ ...prev, [field]: value }));
  };

  // ✅ save feedback (update_dynamic_data)
  const handleSaveFeedback = async () => {
    if (!currentRow?.sessionid) {
      return Swal.fire("Error", "sessionid missing. Update nahi ho sakta.", "error");
    }

    const isSent =
      (currentRow.email_status || "").toLowerCase() === "sent" || currentRow.isEmailSent;

    if (isSent) {
      return Swal.fire("Locked", "Email already sent. Editing disabled.", "info");
    }

    const confirm = await Swal.fire({
      title: "Save Feedback?",
      text: "Do you want to update this performance feedback?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Update",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      setSavingFeedback(true);

      const token = await getToken();
      if (!token) throw new Error("Token not found");

      Swal.fire({
        title: "Updating...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const payload = {
        token,
        tablename: "performance",
        conditions: [{ sessionid: Number(currentRow.sessionid) }],
        updatedata: [
          {
            punctuality: currentRow.punctuality || "",
            engagement: currentRow.engagement || "",
            behaviour: currentRow.behaviour || "",
            understanding: currentRow.understanding || "",
            final_class_grade: currentRow.final_class_grade || "",
            // teacher_feedback: currentRow.teacher_feedback || "",
            topics_covered_today: currentRow.topics_covered_today || "",
            what_went_well_today: currentRow.what_went_well_today || "",
            areas_for_development: currentRow.areas_for_development || "",
            recommended_next_steps: currentRow.recommended_next_steps || "",
            next_lesson_plan: currentRow.next_lesson_plan || "",
          },
        ],
      };

      const res = await axios.post(UPDATE_DYNAMIC_URL, payload, {
        headers: BASE_HEADERS,
      });

      const ok = res?.data?.statusCode === 200;

      if (ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.sessionid === currentRow.sessionid
              ? {
                  ...r,
                  punctuality: currentRow.punctuality,
                  engagement: currentRow.engagement,
                  behaviour: currentRow.behaviour,
                  understanding: currentRow.understanding,
                  final_class_grade: currentRow.final_class_grade,
                  teacher_feedback: currentRow.teacher_feedback,
                  topics_covered_today: currentRow.topics_covered_today,
                  what_went_well_today: currentRow.what_went_well_today,
                  areas_for_development: currentRow.areas_for_development,
                  recommended_next_steps: currentRow.recommended_next_steps,
                  next_lesson_plan: currentRow.next_lesson_plan,
                }
              : r
          )
        );

        Swal.fire("Updated!", "Performance feedback updated successfully.", "success");
        setShowModal(false);
      } else {
        Swal.fire("Error", res?.data?.message || "Failed to update feedback.", "error");
      }
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Something went wrong while updating feedback.", "error");
    } finally {
      setSavingFeedback(false);
    }
  };

  // ✅ send email (send_progress_report_email endpoint)
  const handleSendEmail = async (row) => {
    if (!row?.sessionid) return Swal.fire("Error", "sessionid missing.", "error");

    const isSent = (row.email_status || "").toLowerCase() === "sent" || row.isEmailSent;
    if (isSent) return Swal.fire("Info", "Already sent.", "info");

    const result = await Swal.fire({
      title: "Send Progress Report Email?",
      text: `Session ID: ${row.sessionid}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Send",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      setSendingSessionId(row.sessionid);

      const token = await getToken();
      if (!token) throw new Error("Token not found");

      const headers = { ...BASE_HEADERS, token };
      const body = { sessionid: Number(row.sessionid) };

      const res = await axios.post(SEND_PROGRESS_EMAIL_URL, body, { headers });

      const ok =
        res?.data?.statusCode === 200 ||
        res?.data?.status === true ||
        res?.data?.success === true;

      if (!ok) {
        return Swal.fire("Error", res?.data?.message || "Email send failed.", "error");
      }

      const returnedSessionId =
        res?.data?.data?.[0]?.sessionid != null
          ? Number(res.data.data[0].sessionid)
          : Number(row.sessionid);

      setRows((prev) =>
        prev.map((r) =>
          Number(r.sessionid) === returnedSessionId
            ? { ...r, email_status: "sent", isEmailSent: true }
            : r
        )
      );

      setCurrentRow((prev) =>
        prev?.sessionid && Number(prev.sessionid) === returnedSessionId
          ? { ...prev, email_status: "sent", isEmailSent: true }
          : prev
      );

      Swal.fire({
        icon: "success",
        title: "Sent!",
        text: "Progress report email sent. Now editing is disabled.",
        timer: 1700,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Something went wrong while sending email.", "error");
    } finally {
      setSendingSessionId(null);
    }
  };

  const modalThemeClass = useMemo(() => (isDarkTheme ? "pf-dark" : "pf-light"), [isDarkTheme]);

  if (initialLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "300px" }}>
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
        /* ------------------ Base modal card ------------------ */
        .pf-modal-card{
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 14px 45px rgba(0,0,0,.18);
          border: 1px solid rgba(0,0,0,.06);
        }
        .pf-divider{
          border-top: 1px dashed rgba(0,0,0,.15);
          margin: 14px 0;
        }
        .pf-meta{
          border-radius: 12px;
          padding: 12px;
          border: 1px solid rgba(0,0,0,.06);
        }
        .pf-meta small{ opacity: .75; }
        .pf-box{
          border-radius: 12px;
          padding: 12px;
          height: 100%;
          border: 1px solid rgba(0,0,0,.08);
          background: transparent;
        }
        .pf-box .form-label{
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 6px;
        }

        /* ------------------ LIGHT THEME ------------------ */
        .pf-modal-card.pf-light{
          background: #ffffff;
          color: rgba(0,0,0,.88);
          border-color: rgba(0,0,0,.08);
        }
        .pf-modal-card.pf-light .modal-header{
          border-bottom: 1px solid rgba(0,0,0,.08);
        }
        .pf-modal-card.pf-light .pf-meta{
          background: rgba(0,0,0,.03);
          border-color: rgba(0,0,0,.06);
        }
        .pf-modal-card.pf-light .pf-box{
          border-color: rgba(0,0,0,.08);
        }
        .pf-modal-card.pf-light .pf-divider{
          border-top: 1px dashed rgba(0,0,0,.18);
        }

        .pf-modal-card.pf-light .pf-box .form-select,
        .pf-modal-card.pf-light .pf-box .form-control{
          background: #ffffff;
          color: rgba(0,0,0,.88);
          border-color: rgba(0,0,0,.12);
        }

        /* disabled (LIGHT) */
        .pf-modal-card.pf-light .pf-box .form-select:disabled,
        .pf-modal-card.pf-light .pf-box .form-control:disabled,
        .pf-modal-card.pf-light .pf-box textarea:disabled,
        .pf-modal-card.pf-light .pf-box input:disabled{
          background: rgba(0,0,0,.04) !important;
          color: rgba(0,0,0,.70) !important;
          border-color: rgba(0,0,0,.12) !important;
          opacity: 1 !important;
          cursor: not-allowed;
          -webkit-text-fill-color: rgba(0,0,0,.70) !important;
        }

        /* ------------------ DARK THEME ------------------ */
        .pf-modal-card.pf-dark{
          background: #1f2a3a;
          color: rgba(255,255,255,.92);
          border-color: rgba(255,255,255,.08);
        }
        .pf-modal-card.pf-dark .modal-header{
          border-bottom: 1px solid rgba(255,255,255,.10);
        }
        .pf-modal-card.pf-dark .modal-title{ color: rgba(255,255,255,.95); }
        .pf-modal-card.pf-dark .btn-close{
          filter: invert(1) grayscale(100%);
          opacity: .85;
        }
        .pf-modal-card.pf-dark .pf-meta{
          background: rgba(255,255,255,.04);
          border-color: rgba(255,255,255,.08);
        }
        .pf-modal-card.pf-dark .pf-box{
          border-color: rgba(255,255,255,.10);
        }
        .pf-modal-card.pf-dark .pf-divider{
          border-top: 1px dashed rgba(255,255,255,.16);
        }

        .pf-modal-card.pf-dark .pf-box .form-select,
        .pf-modal-card.pf-dark .pf-box .form-control{
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.92);
          border-color: rgba(255,255,255,.12);
        }

        /* disabled (DARK) */
        .pf-modal-card.pf-dark .pf-box .form-select:disabled,
        .pf-modal-card.pf-dark .pf-box .form-control:disabled,
        .pf-modal-card.pf-dark .pf-box textarea:disabled,
        .pf-modal-card.pf-dark .pf-box input:disabled{
          background: rgba(255,255,255,.06) !important;
          color: rgba(255,255,255,.85) !important;
          border-color: rgba(255,255,255,.12) !important;
          opacity: 1 !important;
          cursor: not-allowed;
          -webkit-text-fill-color: rgba(255,255,255,.85) !important;
        }
      `}</style>

      <div className="col-xxl-12">
        <div className="card h-100 p-0 email-card">
          <div className="card-body p-0">
            {/* ✅ FILTER BAR (NEW) */}
            <div className="px-3 pt-3">
              <div className="d-flex flex-wrap gap-2 align-items-end">
                <div style={{ minWidth: 240 }}>
                  <input
                    className="form-control"
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div style={{ minWidth: 180 }}>
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="sent">Sent</option>
                  </select>
                </div>

                <div style={{ minWidth: 170 }}>
                  <input
                    type="date"
                    className="form-control"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                <div style={{ minWidth: 170 }}>
                  <input
                    type="date"
                    className="form-control"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>

              </div>

              <hr className="my-3" />
            </div>

            <div className="table-responsive">
              <table className="table bordered-table sm-table mb-0">
                <thead>
                  <tr>
                    <th className="text-center">S.L</th>
                    <th className="text-center">Recording</th>
                    <th className="text-center">Book Date</th>
                    <th className="text-center">Student Name</th>
                    <th className="text-center">Teacher Name</th>
                    <th className="text-center">Slot Start</th>
                    <th className="text-center">Slot End</th>
                    <th className="text-center">Performance Feedback</th>
                    <th className="text-center">Send Email</th>
                  </tr>
                </thead>

                <tbody>
                  {currentRows.length === 0 ? (
                    <tr>
                      <td className="text-center" colSpan={9}>
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((row, idx) => {
                      const isSent =
                        (row.email_status || "").toLowerCase() === "sent" || row.isEmailSent;

                      const isSendingThisRow = sendingSessionId === row.sessionid;

                      const recUrl = normalizeUrl(row.recordingUrl);

                      return (
                        <tr key={row.id ?? `${row.sessionid}-${idx}`}>
                          <td className="text-center">{indexOfFirst + idx + 1}</td>

                          <td className="text-center">
                            {recUrl ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => openRecording(row)}
                                title="View Recording"
                              >
                                View
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>

                          <td className="text-center">{row.bookDate}</td>
                          <td className="text-center">{row.studentName}</td>
                          <td className="text-center">{row.teacherName}</td>
                          <td className="text-center">{row.slotStart}</td>
                          <td className="text-center">{row.slotEnd}</td>

                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => openFeedbackModal(row)}
                              title={isSent ? "View (Locked)" : "View / Edit Feedback"}
                            >
                              <Icon icon="majesticons:eye-line" />
                            </button>
                          </td>

                          <td className="text-center">
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleSendEmail(row)}
                              disabled={isSent || isSendingThisRow}
                              title={isSent ? "Already Sent" : "Send Email"}
                            >
                              {isSent ? "Sent" : isSendingThisRow ? "Sending..." : "Send"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between mt-3 px-3 pb-3">
              <span>
                Showing {filteredSortedRows.length === 0 ? 0 : indexOfFirst + 1} to{" "}
                {Math.min(indexOfLast, filteredSortedRows.length)} of {filteredSortedRows.length} entries
              </span>

              <ul className="pagination mb-0">
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
        </div>
      </div>

      {/* ✅ Recording Modal */}
      {isRecordingOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
          onClick={closeRecording}
        >
          <div
            className="bg-white radius-12 p-16"
            style={{ width: "min(900px, 92vw)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">Recording</h6>
              <button className="btn btn-sm btn-outline-secondary" onClick={closeRecording}>
                Close
              </button>
            </div>

            {activeRecordingUrl ? (
              <video controls autoPlay style={{ width: "100%", maxHeight: "70vh", background: "#000" }}>
                <source src={activeRecordingUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="text-center py-5">Recording not available</div>
            )}
          </div>
        </div>
      )}

      {/* ✅ Modal */}
      {showModal && (
        <div
          className="modal fade show"
          style={{ display: "block", background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-content pf-modal-card ${modalThemeClass}`}>
              <div className="modal-header">
                <h5 className="modal-title">Performance Feedback</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
              </div>

              <div className="modal-body">
                {currentRow &&
                  (() => {
                    const isSent =
                      (currentRow.email_status || "").toLowerCase() === "sent" ||
                      currentRow.isEmailSent;

                    return (
                      <>
                        <div className="pf-meta">
                          <div className="row g-2">
                            <div className="col-md-6">
                              <small>Student</small>
                              <div className="fw-semibold">{currentRow.studentName || "-"}</div>
                            </div>
                            <div className="col-md-6">
                              <small>Teacher</small>
                              <div className="fw-semibold">{currentRow.teacherName || "-"}</div>
                            </div>
                          </div>

                          <div className="mt-2">
                            <small>Status</small>{" "}
                            <span className={`badge ${isSent ? "bg-success" : "bg-warning text-dark"}`}>
                              {isSent ? "Sent" : "Pending"}
                            </span>
                          </div>
                        </div>

                        <div className="pf-divider" />

                        <div className="row g-3">
                          <div className="col-md-4">
                            <div className="pf-box">
                              <label className="form-label">Punctuality</label>
                              <select
                                className="form-select"
                                value={currentRow.punctuality}
                                onChange={(e) => handleFeedbackChange("punctuality", e.target.value)}
                                disabled={isSent}
                              >
                                <option value="">Select</option>
                                {ENUM_OPTIONS.map((op) => (
                                  <option key={op} value={op}>
                                    {op}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="col-md-4">
                            <div className="pf-box">
                              <label className="form-label">Engagement</label>
                              <select
                                className="form-select"
                                value={currentRow.engagement}
                                onChange={(e) => handleFeedbackChange("engagement", e.target.value)}
                                disabled={isSent}
                              >
                                <option value="">Select</option>
                                {ENUM_OPTIONS.map((op) => (
                                  <option key={op} value={op}>
                                    {op}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="col-md-4">
                            <div className="pf-box">
                              <label className="form-label">Behaviour</label>
                              <select
                                className="form-select"
                                value={currentRow.behaviour}
                                onChange={(e) => handleFeedbackChange("behaviour", e.target.value)}
                                disabled={isSent}
                              >
                                <option value="">Select</option>
                                {ENUM_OPTIONS.map((op) => (
                                  <option key={op} value={op}>
                                    {op}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div className="pf-box">
                              <label className="form-label">Understanding</label>
                              <select
                                className="form-select"
                                value={currentRow.understanding}
                                onChange={(e) => handleFeedbackChange("understanding", e.target.value)}
                                disabled={isSent}
                              >
                                <option value="">Select</option>
                                {ENUM_OPTIONS.map((op) => (
                                  <option key={op} value={op}>
                                    {op}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div className="pf-box">
                              <label className="form-label">Final Class Grade</label>
                              <select
                                className="form-select"
                                value={currentRow.final_class_grade}
                                onChange={(e) => handleFeedbackChange("final_class_grade", e.target.value)}
                                disabled={isSent}
                              >
                                <option value="">Select</option>
                                {ENUM_OPTIONS.map((op) => (
                                  <option key={op} value={op}>
                                    {op}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* <div className="col-12">
                            <div className="pf-box">
                              <label className="form-label">Teacher Feedback</label>
                              <textarea
                                className="form-control"
                                rows="5"
                                value={currentRow.teacher_feedback}
                                onChange={(e) => handleFeedbackChange("teacher_feedback", e.target.value)}
                                placeholder="Write teacher feedback..."
                                disabled={isSent}
                              />
                            </div>
                          </div> */}

                          <div className="col-12">
                            <div className="pf-box">
                              <label className="form-label">Topics Covered Today</label>
                              <textarea
                                className="form-control"
                                rows="1"
                                value={currentRow.topics_covered_today}
                                onChange={(e) => handleFeedbackChange("topics_covered_today", e.target.value)}
                                placeholder="Write topics covered today..."
                                disabled={isSent}
                              />
                            </div>
                          </div>

                          <div className="col-12">
                            <div className="pf-box">
                              <label className="form-label">What Went Well Today</label>
                              <textarea
                                className="form-control"
                                rows="1"
                                value={currentRow.what_went_well_today}
                                onChange={(e) => handleFeedbackChange("what_went_well_today", e.target.value)}
                                placeholder="Write what went well today..."
                                disabled={isSent}
                              />
                            </div>
                          </div>

                          <div className="col-12">
                            <div className="pf-box">
                              <label className="form-label">Areas for Further Development</label>
                              <textarea
                                className="form-control"
                                rows="1"
                                value={currentRow.areas_for_development}
                                onChange={(e) => handleFeedbackChange("areas_for_development", e.target.value)}
                                placeholder="Write areas for further development..."
                                disabled={isSent}
                              />
                            </div>
                          </div>

                          <div className="col-12">
                            <div className="pf-box">
                              <label className="form-label">Recommended Next Steps</label>
                              <textarea
                                className="form-control"
                                rows="1"
                                value={currentRow.recommended_next_steps}
                                onChange={(e) => handleFeedbackChange("recommended_next_steps", e.target.value)}
                                placeholder="Write recommended next steps..."
                                disabled={isSent}
                              />
                            </div>
                          </div>

                          <div className="col-12">
                            <div className="pf-box">
                              <label className="form-label">What We Will Work On Next Lesson</label>
                              <textarea
                                className="form-control"
                                rows="1"
                                value={currentRow.next_lesson_plan}
                                onChange={(e) => handleFeedbackChange("next_lesson_plan", e.target.value)}
                                placeholder="Write next lesson plan..."
                                disabled={isSent}
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                  Close
                </button>

                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleSaveFeedback}
                  disabled={
                    savingFeedback ||
                    (currentRow &&
                      ((currentRow.email_status || "").toLowerCase() === "sent" ||
                        currentRow.isEmailSent))
                  }
                >
                  {savingFeedback ? "Saving..." : "Save Feedback"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackLayer;