import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment-timezone";
import { getAllBookings } from "../api/getAllBookings";
import RescheduleBookingModal from "./RescheduleBookingModal";

const DirectBookingLayer = () => {
  const [rows, setRows] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [sessionTypeFilter, setSessionTypeFilter] = useState("");
  const [bookingTypeFilter, setBookingTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isRecordingOpen, setIsRecordingOpen] = useState(false);
  const [activeRecordingUrl, setActiveRecordingUrl] = useState("");

  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const [reloadNonce, setReloadNonce] = useState(0);

  const TZ = "Asia/Karachi";

  const norm = (v) => String(v ?? "").toLowerCase().trim();

  const getBookDateValue = (item) => item?.bookdate || item?.booking_date || "";
  const getSlotStartValue = (item) => item?.slot_start || item?.booking_start_time || "";
  const getSlotEndValue = (item) => item?.slot_end || item?.booking_end_time || "";

  const getSessionTypeKey = (value) => {
    const t = norm(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

    if (t === "in person") return "in-person";
    if (t === "online") return "online";

    return t;
  };

  const isInPersonSession = (item) => getSessionTypeKey(item?.session_type) === "in-person";

  const normalizeRecordingUrl = (u) => String(u || "").replace(/\\\//g, "/").trim();
  const hasRecordingUrl = (item) => !!normalizeRecordingUrl(item?.recording_s3_url);

  const openRecording = (item) => {
    const url = normalizeRecordingUrl(item?.recording_s3_url);
    if (!url) return;
    setActiveRecordingUrl(url);
    setIsRecordingOpen(true);
  };

  const closeRecording = () => {
    setIsRecordingOpen(false);
    setActiveRecordingUrl("");
  };

  const openRescheduleModal = (item) => {
    setSelectedBooking(item);
    setIsRescheduleOpen(true);
  };

  const closeRescheduleModal = () => {
    setIsRescheduleOpen(false);
    setSelectedBooking(null);
  };

  const refreshBookings = () => {
    setReloadNonce((prev) => prev + 1);
  };

  const getNow = () => moment.tz(TZ);

  const parseBookDate = (value) => {
    if (!value) return null;
    const s = String(value).trim();

    const formats = [
      "YYYY-MM-DD",
      "YYYY/MM/DD",
      "DD-MM-YYYY",
      "DD/MM/YYYY",
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DD HH:mm",
      "YYYY/MM/DD HH:mm:ss",
      "YYYY/MM/DD HH:mm",
      moment.ISO_8601,
    ];

    let m = moment.tz(s, formats, true, TZ);
    if (!m.isValid()) m = moment.tz(s, formats, TZ);
    if (!m.isValid()) m = moment.tz(s, TZ);

    return m.isValid() ? m : null;
  };

  const parseDateTime = (dateStr, timeStr) => {
    if (!dateStr) return null;

    const dtString = timeStr ? `${dateStr} ${timeStr}` : `${dateStr} 23:59:59`;

    const formats = [
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DD HH:mm",
      "YYYY/MM/DD HH:mm:ss",
      "YYYY/MM/DD HH:mm",
      "DD-MM-YYYY HH:mm:ss",
      "DD-MM-YYYY HH:mm",
      "DD/MM/YYYY HH:mm:ss",
      "DD/MM/YYYY HH:mm",
      moment.ISO_8601,
    ];

    let m = moment.tz(dtString, formats, true, TZ);
    if (!m.isValid()) m = moment.tz(dtString, formats, TZ);

    return m.isValid() ? m : null;
  };

  const getBookingStatus = (item) => {
    const now = getNow();

    const date = getBookDateValue(item);
    const start = getSlotStartValue(item);
    const end = getSlotEndValue(item);

    const hasRecording = hasRecordingUrl(item);
    const inPerson = isInPersonSession(item);

    if (!date) return "upcoming";

    const startDT = start ? parseDateTime(date, start) : null;
    const endDT = end ? parseDateTime(date, end) : null;

    if (endDT) {
      if (now.isAfter(endDT)) {
        if (inPerson) return "completed";
        return hasRecording ? "completed" : "missed";
      }

      if (startDT && now.isSameOrAfter(startDT) && now.isSameOrBefore(endDT)) {
        return "ongoing";
      }

      return "upcoming";
    }

    const dayEnd = parseDateTime(date, "23:59:59");
    if (dayEnd && now.isAfter(dayEnd)) {
      if (inPerson) return "completed";
      return hasRecording ? "completed" : "missed";
    }

    return "upcoming";
  };

  const isRescheduleDisabled = (item) => {
    const bd = parseBookDate(getBookDateValue(item));
    if (!bd) return false;
    return bd.isBefore(getNow(), "day");
  };

  const getBookingStatusBadgeClass = (status) => {
    const s = norm(status);
    if (s === "completed") return "bg-success";
    if (s === "ongoing") return "bg-info";
    if (s === "missed") return "bg-danger";
    return "bg-warning text-dark";
  };

  const getPaymentTypeBadgeClass = (type) => {
    const t = norm(type);
    if (t === "direct") return "bg-success";
    if (t === "block") return "bg-primary";
    if (t === "subscription") return "bg-warning text-dark";
    return "bg-secondary";
  };

  const getPaymentStatusBadgeClass = (status) => {
    const s = norm(status);
    if (s === "paid") return "bg-success";
    if (s === "unpaid") return "bg-danger";
    return "bg-secondary";
  };

  const getSessionTypeBadgeClass = (type) => {
    const t = getSessionTypeKey(type);
    if (t === "in-person") return "bg-dark";
    if (t === "online") return "bg-info";
    return "bg-secondary";
  };

  const getBookingTypeBadgeClass = (type) => {
    const t = norm(type);
    if (t === "manual") return "bg-primary";
    if (t === "web app") return "bg-success";
    return "bg-secondary";
  };

  const getAmountText = (item) => {
    const raw = item?.booking_amount ?? 0;
    const n = Number(String(raw ?? "0").replace(/,/g, "").trim());
    const val = Number.isFinite(n) ? n : 0;
    return `AED ${val.toFixed(2)}`;
  };

  const formatTime = (t) => {
    if (!t) return "-";
    const m = moment(t, ["HH:mm:ss", "HH:mm"], true);
    if (!m.isValid()) return "-";
    return m.format("hh:mm A");
  };

  const makeRowKey = (item) => {
    const bookingid = item?.bookingid ?? item?.booking_id ?? item?.id ?? "na";
    const date = getBookDateValue(item) || "na";
    const ss = getSlotStartValue(item) || "na";
    const se = getSlotEndValue(item) || "na";
    const t = item?.teachername ?? "na";
    const s = item?.studentname ?? "na";
    const sid = item?.studentid ?? "na";
    return `${bookingid}|${date}|${ss}|${se}|${t}|${s}|${sid}`;
  };

  const dedupeBookings = (list) => {
    const seen = new Set();
    const out = [];
    for (const item of list || []) {
      const k = makeRowKey(item);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
    return out;
  };

  useEffect(() => {
    let alive = true;

    const fetchData = async () => {
      setInitialLoading(true);
      setLoadError("");

      try {
        const data = await getAllBookings();

        const raw = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.getall_bookings)
          ? data.getall_bookings
          : Array.isArray(data?.getallbookings)
          ? data.getallbookings
          : [];

        const deduped = dedupeBookings(raw);

        const sorted = deduped.slice().sort((a, b) => {
          const ma = parseBookDate(getBookDateValue(a));
          const mb = parseBookDate(getBookDateValue(b));
          return (mb?.valueOf?.() || 0) - (ma?.valueOf?.() || 0);
        });

        if (!alive) return;
        setRows(sorted);
      } catch (err) {
        if (!alive) return;
        console.error("getAllBookings failed:", err);
        setRows([]);
        setLoadError("Bookings load nahi ho rahi. API/Network check karo.");
      } finally {
        if (!alive) return;
        setInitialLoading(false);
      }
    };

    fetchData();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadNonce]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    bookingStatusFilter,
    paymentStatusFilter,
    sessionTypeFilter,
    bookingTypeFilter,
    startDate,
    endDate,
  ]);

  const filteredData = useMemo(() => {
    const sTerm = norm(searchTerm);
    const bFilter = norm(bookingStatusFilter);
    const psFilter = norm(paymentStatusFilter);
    const stFilter = getSessionTypeKey(sessionTypeFilter);
    const btFilter = norm(bookingTypeFilter);

    const startM = startDate ? moment.tz(startDate, "YYYY-MM-DD", true, TZ) : null;
    const endM = endDate ? moment.tz(endDate, "YYYY-MM-DD", true, TZ) : null;

    return (rows || []).filter((item) => {
      const bookingStatus = getBookingStatus(item);

      const isDirect = norm(item?.payment_type) === "direct";
      if (!isDirect) return false;

      const fullText = [
        item?.studentname || "",
        item?.teachername || "",
        item?.payment_type || "",
        item?.payment_status || "",
        item?.session_type || "",
        item?.booking_type || "",
        getAmountText(item),
        bookingStatus,
        getBookDateValue(item),
        getSlotStartValue(item),
        getSlotEndValue(item),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !sTerm || fullText.includes(sTerm);
      const matchesStatus = !bFilter || norm(bookingStatus) === bFilter;
      const matchesPaymentStatus = !psFilter || norm(item?.payment_status) === psFilter;
      const matchesSessionType = !stFilter || getSessionTypeKey(item?.session_type) === stFilter;
      const matchesBookingType = !btFilter || norm(item?.booking_type) === btFilter;

      const itemDate = parseBookDate(getBookDateValue(item));
      const fromOk = startM ? (itemDate ? itemDate.isSameOrAfter(startM, "day") : false) : true;
      const toOk = endM ? (itemDate ? itemDate.isSameOrBefore(endM, "day") : false) : true;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPaymentStatus &&
        matchesSessionType &&
        matchesBookingType &&
        fromOk &&
        toOk
      );
    });
  }, [
    rows,
    searchTerm,
    bookingStatusFilter,
    paymentStatusFilter,
    sessionTypeFilter,
    bookingTypeFilter,
    startDate,
    endDate,
  ]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  const indexOfLastItem = safePage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    if (currentPage !== safePage) setCurrentPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  const exportToExcel = () => {
    const heading = [["Direct Booking List"]];
    const data = filteredData.map((item, i) => {
      const status = getBookingStatus(item);
      const bd = parseBookDate(getBookDateValue(item));

      return {
        "S.L": i + 1,
        "Book Date": bd ? bd.format("DD MMM YYYY") : "-",
        "Student Name": item?.studentname || "-",
        "Booked Teacher": item?.teachername || "-",
        "Slot Start": formatTime(getSlotStartValue(item)),
        "Slot End": formatTime(getSlotEndValue(item)),
        Amount: getAmountText(item),
        "Payment Type": item?.payment_type || "-",
        "Payment Status": item?.payment_status || "-",
        "Session Type": item?.session_type || "-",
        "Booking Type": item?.booking_type || "-",
        Status: status ? status.charAt(0).toUpperCase() + status.slice(1) : "-",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { origin: -1 });
    XLSX.utils.sheet_add_aoa(worksheet, heading, { origin: "A1" });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Direct Bookings");
    XLSX.writeFile(workbook, "direct_bookings.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Direct Booking List", 14, 20);

    const columns = [
      "S.L",
      "Book Date",
      "Student Name",
      "Booked Teacher",
      "Slot Start",
      "Slot End",
      "Amount",
      "Payment Type",
      "Payment Status",
      "Session Type",
      "Booking Type",
      "Status",
    ];

    const rowsPdf = filteredData.map((item, i) => {
      const status = getBookingStatus(item);
      const bd = parseBookDate(getBookDateValue(item));

      return [
        i + 1,
        bd ? bd.format("DD MMM YYYY") : "-",
        item?.studentname || "-",
        item?.teachername || "-",
        formatTime(getSlotStartValue(item)),
        formatTime(getSlotEndValue(item)),
        getAmountText(item),
        item?.payment_type || "-",
        item?.payment_status || "-",
        item?.session_type || "-",
        item?.booking_type || "-",
        status ? status.charAt(0).toUpperCase() + status.slice(1) : "-",
      ];
    });

    autoTable(doc, {
      startY: 25,
      head: [columns],
      body: rowsPdf,
      styles: { fontSize: 8 },
      headStyles: { fontSize: 8 },
    });
    doc.save("direct_bookings.pdf");
  };

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
        <style>{`@keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  return (
    <div className="card h-100 p-0 radius-12">
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between">
        <div className="d-flex align-items-center flex-wrap gap-3">
          <input
            type="text"
            className="form-control w-auto"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <input
            type="date"
            className="form-control w-auto"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            type="date"
            className="form-control w-auto"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          <select
            className="form-select form-select-sm w-auto"
            value={bookingStatusFilter}
            onChange={(e) => setBookingStatusFilter(e.target.value)}
          >
            <option value="">Status: All</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="ongoing">Ongoing</option>
            <option value="missed">Missed</option>
          </select>

          <select
            className="form-select form-select-sm w-auto"
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
          >
            <option value="">Payment Status: All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>

          <select
            className="form-select form-select-sm w-auto"
            value={sessionTypeFilter}
            onChange={(e) => setSessionTypeFilter(e.target.value)}
          >
            <option value="">Session Type: All</option>
            <option value="in-person">In-Person</option>
            <option value="online">Online</option>
          </select>

          <select
            className="form-select form-select-sm w-auto"
            value={bookingTypeFilter}
            onChange={(e) => setBookingTypeFilter(e.target.value)}
          >
            <option value="">Booking Type: All</option>
            <option value="manual">Manual</option>
            <option value="web app">Web App</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm("");
              setBookingStatusFilter("");
              setPaymentStatusFilter("");
              setSessionTypeFilter("");
              setBookingTypeFilter("");
              setStartDate("");
              setEndDate("");
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

      <div className="card-body p-24">
        {loadError ? (
          <div className="alert alert-danger d-flex align-items-center justify-content-between">
            <div>{loadError}</div>
            <button className="btn btn-sm btn-outline-light" onClick={refreshBookings}>
              Reload
            </button>
          </div>
        ) : null}

        <div className="table-responsive">
          <table className="table bordered-table sm-table mb-0">
            <thead>
              <tr>
                <th>S.L</th>
                <th>Reschedule Booking</th>
                <th>Book Date</th>
                <th>Recording</th>
                <th>Student Name</th>
                <th>Teacher Name</th>
                <th>Slot Start</th>
                <th>Slot End</th>
                <th>Amount</th>
                <th>Payment Type</th>
                <th>Payment Status</th>
                <th>Session Type</th>
                <th>Booking Type</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center">
                    No records found.
                  </td>
                </tr>
              ) : (
                currentItems.map((item, index) => {
                  const status = getBookingStatus(item);
                  const recUrl = normalizeRecordingUrl(item?.recording_s3_url);
                  const bd = parseBookDate(getBookDateValue(item));
                  const isDisabled = isRescheduleDisabled(item);

                  return (
                    <tr key={makeRowKey(item)}>
                      <td>{indexOfFirstItem + index + 1}</td>

                      <td>
                        <button
                          type="button"
                          className={`btn btn-sm ${
                            isDisabled ? "btn-outline-secondary" : "btn-outline-primary"
                          }`}
                          onClick={() => {
                            if (!isDisabled) openRescheduleModal(item);
                          }}
                          disabled={isDisabled}
                          title={isDisabled ? "Past bookings cannot be rescheduled" : "Reschedule booking"}
                          style={{
                            minWidth: "110px",
                            borderRadius: "8px",
                            fontWeight: 600,
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            opacity: isDisabled ? 0.6 : 1,
                          }}
                        >
                          Reschedule
                        </button>
                      </td>

                      <td>{bd ? bd.format("DD MMM YYYY") : "-"}</td>

                      <td>
                        {recUrl ? (
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => openRecording(item)}
                          >
                            View
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td>{item?.studentname || "-"}</td>
                      <td>{item?.teachername || "-"}</td>
                      <td>{formatTime(getSlotStartValue(item))}</td>
                      <td>{formatTime(getSlotEndValue(item))}</td>

                      <td>{getAmountText(item)}</td>

                      <td>
                        <span className={`badge ${getPaymentTypeBadgeClass(item?.payment_type)}`}>
                          {item?.payment_type || "-"}
                        </span>
                      </td>

                      <td>
                        <span className={`badge ${getPaymentStatusBadgeClass(item?.payment_status)}`}>
                          {item?.payment_status || "-"}
                        </span>
                      </td>

                      <td>
                        <span className={`badge ${getSessionTypeBadgeClass(item?.session_type)}`}>
                          {item?.session_type || "-"}
                        </span>
                      </td>

                      <td>
                        <span className={`badge ${getBookingTypeBadgeClass(item?.booking_type)}`}>
                          {item?.booking_type || "-"}
                        </span>
                      </td>

                      <td>
                        <span className={`badge ${getBookingStatusBadgeClass(status)}`}>
                          {status ? status.charAt(0).toUpperCase() + status.slice(1) : "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="d-flex justify-content-between mt-3">
          <span>
            Showing {filteredData.length === 0 ? 0 : indexOfFirstItem + 1} to{" "}
            {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
          </span>

          <ul className="pagination">
            {Array.from({ length: totalPages }).map((_, i) => (
              <li key={i} className={`page-item ${safePage === i + 1 ? "active" : ""}`}>
                <button onClick={() => setCurrentPage(i + 1)} className="page-link">
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {isRecordingOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 1050 }}
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
              <video
                src={activeRecordingUrl}
                controls
                autoPlay
                style={{ width: "100%", maxHeight: "70vh", background: "#000" }}
              />
            ) : (
              <div className="text-center py-5">Recording not available</div>
            )}
          </div>
        </div>
      )}

      <RescheduleBookingModal
        key={
          selectedBooking?.bookingid ||
          selectedBooking?.booking_id ||
          selectedBooking?.id ||
          "reschedule"
        }
        isOpen={isRescheduleOpen}
        onClose={closeRescheduleModal}
        onSuccess={refreshBookings}
        booking={selectedBooking}
        timezone={selectedBooking?.studentTime_zone || TZ}
      />
    </div>
  );
};

export default DirectBookingLayer;