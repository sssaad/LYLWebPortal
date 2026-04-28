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

// ✅ apna exact SP name yahan rakh lo
const STORED_PROCEDURE_NAME = "get_rating_review_with_recordings";

// ---------------------- helpers ----------------------
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

const normalizeUrl = (u) => String(u || "").replace(/\\\//g, "/").trim();

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

    if (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches)
      return true;

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

  if (!m.isValid()) m = moment(s);
  return m.isValid() ? m.valueOf() : 0;
};

const parseTimeMinutes = (t) => {
  const s = String(t || "").trim();
  if (!s) return -1;

  let m = moment(s, ["HH:mm:ss", "HH:mm", "hh:mm A", "h:mm A"], true);
  if (!m.isValid()) m = moment(s);
  return m.isValid() ? m.hours() * 60 + m.minutes() : -1;
};

const buildSessionTs = (rawDate, rawStart) => {
  const dateTs = parseBookDateTs(rawDate);
  if (!dateTs) return 0;

  const dateMoment = moment(rawDate, ["YYYY-MM-DD", "YYYY/MM/DD", moment.ISO_8601], true);
  const safeDate = dateMoment.isValid() ? dateMoment : moment(rawDate);

  if (!safeDate.isValid()) return dateTs;

  const minutes = parseTimeMinutes(rawStart);
  if (minutes >= 0) {
    return safeDate.clone().startOf("day").add(minutes, "minutes").valueOf();
  }

  return safeDate.valueOf();
};

const clampRating = (value) => {
  const n = parseFloat(value) || 0;
  return Math.max(0, Math.min(5, n));
};

// ---------------------- component ----------------------
const StudentfeedbackLayer = () => {
  const [rows, setRows] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);

  const [isRecordingOpen, setIsRecordingOpen] = useState(false);
  const [activeRecordingUrl, setActiveRecordingUrl] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 15;

  const [savingReview, setSavingReview] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const resetFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const openRecording = (row) => {
    const url = normalizeUrl(
      row?.recordingUrl ??
      row?.s3Url ??
      row?.s3_url ??
      row?.recording_s3_url ??
      ""
    );

    if (!url) return;

    setActiveRecordingUrl(url);
    setIsRecordingOpen(true);
  };

  const closeRecording = () => {
    setIsRecordingOpen(false);
    setActiveRecordingUrl("");
  };

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

  // ✅ fetch data
  useEffect(() => {
    const fetchRows = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Token not found");

        const headers = { ...BASE_HEADERS, token };

        const body = {
          procedureName: STORED_PROCEDURE_NAME,
          parameters: [],
        };

        const res = await axios.post(RUN_SP_URL, body, { headers });
        const data = res?.data?.data ?? [];

        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((item, index) => {
            const rawBookDate =
              item.booking_date ??
              item.bookdate ??
              item.book_date ??
              item.bookDate ??
              "";

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

            const studentFull = [item.student_firstname, item.student_lastname]
              .filter(Boolean)
              .join(" ")
              .trim();

            const teacherFull = [item.teacher_firstname, item.teacher_lastname]
              .filter(Boolean)
              .join(" ")
              .trim();

            const directUrl = normalizeUrl(
              item.recordingUrl ??
              item.recording_url ??
              item.s3Url ??
              item.s3_url ??
              item.recording_s3_url ??
              ""
            );

            return {
              key:
                item.rating_review_id ??
                item.id ??
                item.bookingid ??
                `row-${index}`,

              ratingReviewId: item.rating_review_id ?? item.id ?? null,
              bookingid: item.bookingid ?? null,
              teacherid: item.teacherid ?? null,
              studentid: item.studentid ?? null,

              recordingUrl: directUrl,

              bookDate: formatDate(rawBookDate),
              slotStart: formatTime(rawStart),
              slotEnd: formatTime(rawEnd),

              bookDateRaw: rawBookDate,
              bookDateTs: parseBookDateTs(rawBookDate),
              slotStartMin: parseTimeMinutes(rawStart),
              sessionTs: buildSessionTs(rawBookDate, rawStart),

              studentName:
                studentFull ||
                item.student_fullname ||
                item.student_name ||
                item.studentName ||
                "",

              teacherName:
                teacherFull ||
                item.teacher_fullname ||
                item.teacher_name ||
                item.teacherName ||
                "",

              studentEmail: item.student_email ?? "",
              teacherEmail: item.teacher_email ?? "",

              rating: clampRating(item.rating),
              review: item.review ?? "",

              subjectName: item.subjectname ?? item.subject_name ?? "",
            };
          });

          // ✅ agar join ki wajah se duplicate rows aa rahi hon to 1 review = 1 row rakho
          const uniqueMap = new Map();

          mapped.forEach((row) => {
            const uniqueKey =
              row.ratingReviewId ??
              `${row.bookingid}-${row.studentid}-${row.teacherid}`;

            if (!uniqueMap.has(uniqueKey)) {
              uniqueMap.set(uniqueKey, row);
              return;
            }

            const existing = uniqueMap.get(uniqueKey);

            const existingHasRecording = !!normalizeUrl(existing?.recordingUrl);
            const currentHasRecording = !!normalizeUrl(row?.recordingUrl);

            if (!existingHasRecording && currentHasRecording) {
              uniqueMap.set(uniqueKey, row);
              return;
            }

            if (currentHasRecording === existingHasRecording) {
              if ((row.sessionTs || 0) > (existing.sessionTs || 0)) {
                uniqueMap.set(uniqueKey, row);
              }
            }
          });

          setRows(Array.from(uniqueMap.values()));
          setCurrentPage(1);
        } else {
          setRows([]);
          setCurrentPage(1);
        }
      } catch (error) {
        console.error(error);
        setRows([]);
        setCurrentPage(1);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchRows();
  }, []);

  // ✅ nearest to current date/time first
  const filteredSortedRows = useMemo(() => {
    const arr = Array.isArray(rows) ? [...rows] : [];

    const fromTs = dateFrom
      ? moment(dateFrom, "YYYY-MM-DD").startOf("day").valueOf()
      : null;

    const toTs = dateTo
      ? moment(dateTo, "YYYY-MM-DD").endOf("day").valueOf()
      : null;

    const q = String(search || "").trim().toLowerCase();
    const nowTs = Date.now();

    const filtered = arr.filter((r) => {
      const targetTs = Number(r.sessionTs || r.bookDateTs || 0);

      if (fromTs != null || toTs != null) {
        if (!targetTs) return false;
        if (fromTs != null && targetTs < fromTs) return false;
        if (toTs != null && targetTs > toTs) return false;
      }

      if (q) {
        const blob = `
          ${r.bookingid ?? ""}
          ${r.bookDate ?? ""}
          ${r.studentName ?? ""}
          ${r.teacherName ?? ""}
          ${r.slotStart ?? ""}
          ${r.slotEnd ?? ""}
          ${r.subjectName ?? ""}
        `
          .toLowerCase()
          .trim();

        if (!blob.includes(q)) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      const aTs = Number(a.sessionTs || a.bookDateTs || 0);
      const bTs = Number(b.sessionTs || b.bookDateTs || 0);

      const aDiff = aTs ? Math.abs(aTs - nowTs) : Number.MAX_SAFE_INTEGER;
      const bDiff = bTs ? Math.abs(bTs - nowTs) : Number.MAX_SAFE_INTEGER;

      if (aDiff !== bDiff) return aDiff - bDiff;

      if (bTs !== aTs) return bTs - aTs;

      return Number(b.bookingid || 0) - Number(a.bookingid || 0);
    });

    return filtered;
  }, [rows, search, dateFrom, dateTo]);

  const indexOfLast = currentPage * perPage;
  const indexOfFirst = indexOfLast - perPage;
  const currentRows = filteredSortedRows.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredSortedRows.length / perPage) || 1;

  const handlePageChange = (n) => setCurrentPage(n);

  useEffect(() => {
    if (filteredSortedRows.length === 0) setCurrentPage(1);
    else if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filteredSortedRows.length, totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, dateFrom, dateTo]);

  const openReviewModal = (row) => {
    setCurrentRow({
      ...row,
      rating: clampRating(row.rating),
      review: row.review || "",
    });
    setShowModal(true);
  };

  const handleReviewChange = (field, value) => {
    setCurrentRow((prev) => ({ ...prev, [field]: value }));
  };

  const handleStarClick = (value) => {
    setCurrentRow((prev) => ({
      ...prev,
      rating: clampRating(value),
    }));
  };

  const handleSaveReview = async () => {
    if (!currentRow?.ratingReviewId) {
      return Swal.fire(
        "Error",
        "rating_review ID is missing. The update cannot be completed.",
        "error"
      );
    }

    const confirm = await Swal.fire({
      title: "Save Rating & Review?",
      text: "Do you want to update this rating and review?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Update",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      setSavingReview(true);

      const token = await getToken();
      if (!token) throw new Error("Token not found");

      Swal.fire({
        title: "Updating...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const payload = {
        token,
        tablename: "rating_review",
        conditions: [{ id: Number(currentRow.ratingReviewId) }],
        updatedata: [
          {
            rating: clampRating(currentRow.rating),
            review: String(currentRow.review || "").trim(),
          },
        ],
      };

      const res = await axios.post(UPDATE_DYNAMIC_URL, payload, {
        headers: BASE_HEADERS,
      });

      const ok = res?.data?.statusCode === 200;

      if (!ok) {
        return Swal.fire(
          "Error",
          res?.data?.message || "Failed to update rating/review.",
          "error"
        );
      }

      setRows((prev) =>
        prev.map((r) =>
          Number(r.ratingReviewId) === Number(currentRow.ratingReviewId)
            ? {
              ...r,
              rating: clampRating(currentRow.rating),
              review: String(currentRow.review || "").trim(),
            }
            : r
        )
      );

      Swal.fire("Updated!", "Rating and review updated successfully.", "success");
      setShowModal(false);
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        "Something went wrong while updating rating/review.",
        "error"
      );
    } finally {
      setSavingReview(false);
    }
  };

  const renderStars = (value, onClick, disabled = false, size = 26) => {
    const rating = clampRating(value);

    return (
      <div className="d-flex align-items-center gap-1 flex-wrap">
        {[1, 2, 3, 4, 5].map((star) => {
          let icon = "mdi:star-outline";

          if (rating >= star) {
            icon = "mdi:star"; // full
          } else if (rating >= star - 0.5) {
            icon = "mdi:star-half-full"; // half
          }

          return (
            <button
              key={star}
              type="button"
              onClick={(e) => {
                if (disabled) return;

                const { left, width } = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - left;

                const isHalf = clickX < width / 2;

                const value = isHalf ? star - 0.5 : star;

                onClick?.(value);
              }}
              disabled={disabled}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: disabled ? "default" : "pointer",
                fontSize: `${size}px`,
                color: "#f5b301",
              }}
            >
              <Icon icon={icon} />
            </button>
          );
        })}
      </div>
    );
  };

  const modalThemeClass = useMemo(
    () => (isDarkTheme ? "rr-dark" : "rr-light"),
    [isDarkTheme]
  );

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
        .rr-modal-card{
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 14px 45px rgba(0,0,0,.18);
          border: 1px solid rgba(0,0,0,.06);
        }

        .rr-divider{
          border-top: 1px dashed rgba(0,0,0,.15);
          margin: 14px 0;
        }

        .rr-meta{
          border-radius: 12px;
          padding: 12px;
          border: 1px solid rgba(0,0,0,.06);
        }

        .rr-meta small{
          opacity: .75;
        }

        .rr-box{
          border-radius: 12px;
          padding: 12px;
          height: 100%;
          border: 1px solid rgba(0,0,0,.08);
          background: transparent;
        }

        .rr-box .form-label{
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .rr-light{
          background: #ffffff;
          color: rgba(0,0,0,.88);
          border-color: rgba(0,0,0,.08);
        }

        .rr-light .modal-header{
          border-bottom: 1px solid rgba(0,0,0,.08);
        }

        .rr-light .rr-meta{
          background: rgba(0,0,0,.03);
          border-color: rgba(0,0,0,.06);
        }

        .rr-light .rr-box{
          border-color: rgba(0,0,0,.08);
        }

        .rr-light .rr-divider{
          border-top: 1px dashed rgba(0,0,0,.18);
        }

        .rr-light .rr-box .form-control{
          background: #ffffff;
          color: rgba(0,0,0,.88);
          border-color: rgba(0,0,0,.12);
        }

        .rr-dark{
          background: #1f2a3a;
          color: rgba(255,255,255,.92);
          border-color: rgba(255,255,255,.08);
        }

        .rr-dark .modal-header{
          border-bottom: 1px solid rgba(255,255,255,.10);
        }

        .rr-dark .modal-title{
          color: rgba(255,255,255,.95);
        }

        .rr-dark .btn-close{
          filter: invert(1) grayscale(100%);
          opacity: .85;
        }

        .rr-dark .rr-meta{
          background: rgba(255,255,255,.04);
          border-color: rgba(255,255,255,.08);
        }

        .rr-dark .rr-box{
          border-color: rgba(255,255,255,.10);
        }

        .rr-dark .rr-divider{
          border-top: 1px dashed rgba(255,255,255,.16);
        }

        .rr-dark .rr-box .form-control{
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.92);
          border-color: rgba(255,255,255,.12);
        }

        .rr-star-btn:disabled{
          opacity: 1;
        }

        .rr-action-btn{
          min-width: 92px;
        }
      `}</style>

      <div className="col-xxl-12">
        <div className="card h-100 p-0 email-card">
          <div className="card-body p-0">
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
                    <th className="text-center">Rating</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {currentRows.length === 0 ? (
                    <tr>
                      <td className="text-center" colSpan={8}>
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((row, idx) => {
                      const recUrl = normalizeUrl(row.recordingUrl);

                      return (
                        <tr key={row.key ?? `${row.ratingReviewId}-${idx}`}>
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

                          <td className="text-center">{row.bookDate || "-"}</td>
                          <td className="text-center">{row.studentName || "-"}</td>
                          <td className="text-center">{row.teacherName || "-"}</td>
                          <td className="text-center">{row.slotStart || "-"}</td>
                          <td className="text-center">{row.slotEnd || "-"}</td>
                          <td className="text-center">
                            <div className="d-flex justify-content-center align-items-center" style={{ height: "100%" }}>
                              {row.rating > 0 ? (
                                renderStars(row.rating, null, true, 18)
                              ) : (
                                "-"
                              )}
                            </div>
                          </td>

                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary rr-action-btn"
                              onClick={() => openReviewModal(row)}
                              title="View / Edit Rating & Review"
                            >
                              <Icon icon="majesticons:eye-line" className="me-1" />
                              View
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
                {Math.min(indexOfLast, filteredSortedRows.length)} of{" "}
                {filteredSortedRows.length} entries
              </span>

              <ul className="pagination mb-0">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <li
                    key={i}
                    className={`page-item ${currentPage === i + 1 ? "active" : ""}`}
                  >
                    <button
                      onClick={() => handlePageChange(i + 1)}
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
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={closeRecording}
              >
                Close
              </button>
            </div>

            {activeRecordingUrl ? (
              <video
                controls
                autoPlay
                style={{
                  width: "100%",
                  maxHeight: "70vh",
                  background: "#000",
                }}
              >
                <source src={activeRecordingUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="text-center py-5">Recording not available</div>
            )}
          </div>
        </div>
      )}

      {/* ✅ Rating / Review Modal */}
      {showModal && (
        <div
          className="modal fade show"
          style={{ display: "block", background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`modal-content rr-modal-card ${modalThemeClass}`}>
              <div className="modal-header">
                <h5 className="modal-title">Rating & Review</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                />
              </div>

              <div className="modal-body">
                {currentRow && (
                  <>
                    <div className="rr-meta">
                      <div className="row g-2">
                        <div className="col-md-6">
                          <small>Student</small>
                          <div className="fw-semibold">
                            {currentRow.studentName || "-"}
                          </div>
                        </div>

                        <div className="col-md-6">
                          <small>Teacher</small>
                          <div className="fw-semibold">
                            {currentRow.teacherName || "-"}
                          </div>
                        </div>

                        <div className="col-md-4 mt-2">
                          <small>Book Date</small>
                          <div className="fw-semibold">
                            {currentRow.bookDate || "-"}
                          </div>
                        </div>

                        <div className="col-md-4 mt-2">
                          <small>Slot Start</small>
                          <div className="fw-semibold">
                            {currentRow.slotStart || "-"}
                          </div>
                        </div>

                        <div className="col-md-4 mt-2">
                          <small>Slot End</small>
                          <div className="fw-semibold">
                            {currentRow.slotEnd || "-"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rr-divider" />

                    <div className="row g-3">
                      <div className="col-12">
                        <div className="rr-box">
                          <label className="form-label d-block">Rating</label>
                          {renderStars(currentRow.rating, handleStarClick, false, 36)}
                          <div className="mt-2 fw-semibold">
                            Selected Rating: {clampRating(currentRow.rating)}/5
                          </div>
                        </div>
                      </div>

                      <div className="col-12">
                        <div className="rr-box">
                          <label className="form-label">Review</label>
                          <textarea
                            className="form-control"
                            rows="5"
                            value={currentRow.review}
                            onChange={(e) =>
                              handleReviewChange("review", e.target.value)
                            }
                            placeholder="Write review here..."
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>

                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleSaveReview}
                  disabled={savingReview}
                >
                  {savingReview ? "Saving..." : "Save Rating & Review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentfeedbackLayer;