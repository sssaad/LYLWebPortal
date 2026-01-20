import React, { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment";
import { getAllBookings } from "../api/getAllBookings";

const RoleAccessLayer = () => {
  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // ✅ Payment Type filter
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("");

  // ✅ Booking Status filter (Completed / Upcoming / Ongoing)
  const [bookingStatusFilter, setBookingStatusFilter] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const itemsPerPage = 10;

  // ✅ NOW helper (Asia/Karachi if moment-timezone present)
  const getNow = () => {
    const hasTz = typeof moment.tz === "function";
    return hasTz ? moment.tz("Asia/Karachi") : moment();
  };

  // ✅ Parse datetime from date + time
  const parseDateTime = (dateStr, timeStr) => {
    if (!dateStr) return null;

    const hasTz = typeof moment.tz === "function";
    const dtString = timeStr ? `${dateStr} ${timeStr}` : `${dateStr} 23:59:59`;

    const formats = [
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DD HH:mm",
      "YYYY/MM/DD HH:mm:ss",
      "YYYY/MM/DD HH:mm",
      moment.ISO_8601,
    ];

    let m;
    if (hasTz) {
      m = moment.tz(dtString, formats, true, "Asia/Karachi");
      if (!m.isValid()) m = moment.tz(dtString, formats, "Asia/Karachi");
    } else {
      m = moment(dtString, formats, true);
      if (!m.isValid()) m = moment(dtString, formats);
    }

    return m.isValid() ? m : null;
  };

  // ✅ Booking Status: Completed if end time passed
  const getBookingStatus = (item) => {
    const now = getNow();

    const date = item?.bookdate || item?.booking_date || "";
    const start = item?.slot_start || item?.booking_start_time || "";
    const end = item?.slot_end || item?.booking_end_time || "";

    if (!date) return "upcoming";

    const startDT = start ? parseDateTime(date, start) : null;
    const endDT = end ? parseDateTime(date, end) : null;

    if (endDT) {
      if (now.isAfter(endDT)) return "completed";
      if (startDT && now.isSameOrAfter(startDT) && now.isSameOrBefore(endDT)) return "ongoing";
      return "upcoming";
    }

    const dayEnd = parseDateTime(date, "23:59:59");
    if (dayEnd && now.isAfter(dayEnd)) return "completed";
    return "upcoming";
  };

  const getBookingStatusBadgeClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed") return "bg-success";
    if (s === "ongoing") return "bg-info";
    return "bg-warning text-dark"; // upcoming
  };

  // ✅ Payment Type badge color mapping
  const getPaymentTypeBadgeClass = (type) => {
    const t = String(type || "").trim().toLowerCase();
    if (t === "direct") return "bg-success"; // Green
    if (t === "block") return "bg-primary"; // Blue
    if (t === "subscription") return "bg-warning text-dark"; // Yellow
    return "bg-secondary";
  };

  // ✅ Amount formatter: "AED 400.00" | null => "AED 0.00"
  const getAmountText = (item) => {
    const raw = item?.booking_amount;
    const n = Number(String(raw ?? "0").replace(/,/g, "").trim());
    const val = Number.isFinite(n) ? n : 0;
    return `AED ${val.toFixed(2)}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      const data = await getAllBookings();

      // ✅ safe shape handling (array / {data:[]} / {getall_bookings:[]})
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.getall_bookings)
        ? data.getall_bookings
        : [];

      setBookings((rows || []).sort((a, b) => new Date(b.bookdate) - new Date(a.bookdate)));
      setInitialLoading(false);
    };

    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return (bookings || []).filter((item) => {
      const bookingStatus = getBookingStatus(item);

      const fullText =
        `${item.studentname || ""} ${item.teachername || ""} ${item.payment_type || ""} ` +
        `${getAmountText(item)} ${bookingStatus}`.toLowerCase();

      const matchesSearch = fullText.includes((searchTerm || "").toLowerCase().trim());

      // ✅ Payment Type filter
      const matchesPaymentType =
        paymentTypeFilter === "" ||
        String(item.payment_type || "").toLowerCase() ===
          String(paymentTypeFilter || "").toLowerCase();

      // ✅ Booking Status filter (completed/upcoming/ongoing)
      const matchesBookingStatus =
        bookingStatusFilter === "" ||
        String(bookingStatus).toLowerCase() === String(bookingStatusFilter).toLowerCase();

      // ✅ Date range filter
      const itemDate = item.bookdate
        ? moment(item.bookdate, ["YYYY-MM-DD", "YYYY/MM/DD", moment.ISO_8601], true)
        : null;

      const fromDateMatch = startDate
        ? itemDate
          ? itemDate.isSameOrAfter(moment(startDate, "YYYY-MM-DD", true), "day")
          : false
        : true;

      const toDateMatch = endDate
        ? itemDate
          ? itemDate.isSameOrBefore(moment(endDate, "YYYY-MM-DD", true), "day")
          : false
        : true;

      return matchesSearch && matchesPaymentType && matchesBookingStatus && fromDateMatch && toDateMatch;
    });
  }, [bookings, searchTerm, paymentTypeFilter, bookingStatusFilter, startDate, endDate]);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

  useEffect(() => {
    if (filteredData.length === 0) setCurrentPage(1);
    else if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filteredData.length, totalPages, currentPage]);

  const exportToExcel = () => {
    const heading = [["Booking List"]];
    const data = filteredData.map((item, i) => {
      const status = getBookingStatus(item);
      return {
        "S.L": i + 1,
        "Book Date": item.bookdate ? moment(item.bookdate).format("DD MMM YYYY") : "-",
        "Student Name": item.studentname || "-",
        "Booked Teacher": item.teachername || "-",
        "Slot Start": item.slot_start ? moment(item.slot_start, "HH:mm:ss").format("hh:mm A") : "-",
        "Slot End": item.slot_end ? moment(item.slot_end, "HH:mm:ss").format("hh:mm A") : "-",
        Amount: getAmountText(item),
        "Payment Type": item.payment_type || "-",
        Status: status ? status.charAt(0).toUpperCase() + status.slice(1) : "-",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { origin: -1 });
    XLSX.utils.sheet_add_aoa(worksheet, heading, { origin: "A1" });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings");
    XLSX.writeFile(workbook, "bookings.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Booking List", 14, 20);

    const columns = [
      "S.L",
      "Book Date",
      "Student Name",
      "Booked Teacher",
      "Slot Start",
      "Slot End",
      "Amount",
      "Payment Type",
      "Status",
    ];

    const rowsPdf = filteredData.map((item, i) => {
      const status = getBookingStatus(item);
      return [
        i + 1,
        item.bookdate ? moment(item.bookdate).format("DD MMM YYYY") : "-",
        item.studentname || "-",
        item.teachername || "-",
        item.slot_start ? moment(item.slot_start, "HH:mm:ss").format("hh:mm A") : "-",
        item.slot_end ? moment(item.slot_end, "HH:mm:ss").format("hh:mm A") : "-",
        getAmountText(item),
        item.payment_type || "-",
        status ? status.charAt(0).toUpperCase() + status.slice(1) : "-",
      ];
    });

    autoTable(doc, {
      startY: 25,
      head: [columns],
      body: rowsPdf,
    });

    doc.save("bookings.pdf");
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
    <div className="card h-100 p-0 radius-12">
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

          {/* ✅ Payment Type filter */}
          <select
            className="form-select form-select-sm w-auto"
            value={paymentTypeFilter}
            onChange={(e) => {
              setPaymentTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Payment: All</option>
            <option value="Direct">Direct</option>
            <option value="Block">Block</option>
            <option value="Subscription">Subscription</option>
          </select>

          {/* ✅ Booking Status filter */}
          <select
            className="form-select form-select-sm w-auto"
            value={bookingStatusFilter}
            onChange={(e) => {
              setBookingStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Status: All</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="ongoing">Ongoing</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm("");
              setPaymentTypeFilter("");
              setBookingStatusFilter("");
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
        <div className="table-responsive scroll-sm">
          <table className="table bordered-table sm-table mb-0">
            <thead>
              <tr>
                <th>S.L</th>
                <th>Book Date</th>
                <th>Student Name</th>
                <th>Teacher Name</th>
                <th>Slot Start</th>
                <th>Slot End</th>
                <th>Amount</th>
                <th>Payment Type</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center">
                    No records found.
                  </td>
                </tr>
              ) : (
                currentItems.map((item, index) => {
                  const status = getBookingStatus(item);
                  return (
                    <tr key={item?.bookingid ?? `${indexOfFirstItem}-${index}`}>
                      <td>{indexOfFirstItem + index + 1}</td>
                      <td>{item.bookdate ? moment(item.bookdate).format("DD MMM YYYY") : "-"}</td>
                      <td>{item.studentname || "-"}</td>
                      <td>{item.teachername || "-"}</td>
                      <td>{item.slot_start ? moment(item.slot_start, "HH:mm:ss").format("hh:mm A") : "-"}</td>
                      <td>{item.slot_end ? moment(item.slot_end, "HH:mm:ss").format("hh:mm A") : "-"}</td>

                      {/* ✅ Amount column */}
                      <td>{getAmountText(item)}</td>

                      {/* ✅ Payment Type badge */}
                      <td>
                        <span className={`badge ${getPaymentTypeBadgeClass(item.payment_type)}`}>
                          {item.payment_type || "-"}
                        </span>
                      </td>

                      {/* ✅ Status badge */}
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
              <li key={i} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                <button onClick={() => setCurrentPage(i + 1)} className="page-link">
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RoleAccessLayer;
