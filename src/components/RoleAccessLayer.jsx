import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment-timezone";
import { getAllBookings } from "../api/getAllBookings";
import { getToken } from "../api/getToken";
import ManualBookingModal from "./ManualBookingModal";
import RescheduleBookingModal from "./RescheduleBookingModal";

const UPDATE_DYNAMIC_DATA_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const API_HEADERS = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

const PAYMENT_STATUS_OPTIONS = ["Paid", "Unpaid", "Free"];
const SESSION_TYPE_OPTIONS = ["Online", "In-Person"];

const DarkSelectEditor = ({ value, options, onChange, loading }) => {
  return (
    <div className="lyl-select-wrap">
      <select
        className="lyl-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

const ConfirmActionModal = ({ open, title, message, confirmText, cancelText, onConfirm, onClose, loading }) => {
  if (!open) return null;

  return (
    <div className="lyl-modal-overlay" onClick={loading ? undefined : onClose}>
      <div className="lyl-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="lyl-modal-icon">!</div>
        <h4 className="lyl-modal-title">{title}</h4>
        <p className="lyl-modal-text">{message}</p>

        <div className="lyl-modal-actions">
          <button
            type="button"
            className="lyl-btn lyl-btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText || "Cancel"}
          </button>
          <button
            type="button"
            className="lyl-btn lyl-btn-primary"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Updating..." : confirmText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

const AlertToast = ({ alertData, onClose }) => {
  if (!alertData?.open) return null;

  return (
    <div className={`lyl-toast ${alertData.type === "success" ? "success" : "error"}`}>
      <div className="lyl-toast-content">
        <div className="lyl-toast-title">{alertData.title}</div>
        <div className="lyl-toast-message">{alertData.message}</div>
      </div>

      <button type="button" className="lyl-toast-close" onClick={onClose}>
        ×
      </button>
    </div>
  );
};

const RoleAccessLayer = () => {
  const [rows, setRows] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [sessionTypeFilter, setSessionTypeFilter] = useState("");
  const [bookingTypeFilter, setBookingTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);

  const [isRecordingOpen, setIsRecordingOpen] = useState(false);
  const [activeRecordingUrl, setActiveRecordingUrl] = useState("");

  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const [savingMap, setSavingMap] = useState({});
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    item: null,
    field: "",
    newValue: "",
    title: "",
    message: "",
  });
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [amountDraftMap, setAmountDraftMap] = useState({});

  const [alertData, setAlertData] = useState({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  const TZ = "Asia/Dubai";

  const norm = (v) => String(v ?? "").toLowerCase().trim();

  const showAlert = (type, title, message) => {
    setAlertData({
      open: true,
      type,
      title,
      message,
    });

    setTimeout(() => {
      setAlertData((prev) => ({ ...prev, open: false }));
    }, 3000);
  };

  const getBookDateValue = (item) => item?.bookdate || item?.booking_date || "";
  const getSlotStartValue = (item) => item?.slot_start || item?.booking_start_time || "";
  const getSlotEndValue = (item) => item?.slot_end || item?.booking_end_time || "";
  const getBookingId = (item) => item?.bookingid ?? item?.booking_id ?? item?.id ?? "";

  const getSessionTypeKey = (value) => {
    const t = norm(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

    if (t === "in person") return "in-person";
    if (t === "online") return "online";

    return t;
  };

  const getSessionTypeDisplay = (value) => {
    const t = norm(value).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

    if (t === "in person") return "In-Person";
    if (t === "online") return "Online";

    return "Online";
  };

  const getPaymentStatusDisplay = (value) => {
    const s = norm(value);

    if (s === "paid") return "Paid";
    if (s === "unpaid") return "Unpaid";
    if (s === "free") return "Free";

    return "Unpaid";
  };

  const getInpersonStatusDisplay = (value) => {
    const s = norm(value);

    if (s === "upcoming") return "Upcoming";
    if (s === "ongoing") return "Ongoing";
    if (s === "completed") return "Completed";
    if (s === "cancelled") return "Cancelled";
    if (s === "missed") return "Missed";

    return "";
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
    const inpersonDbStatus = getInpersonStatusDisplay(item?.inperson_status);

    if (isInPersonSession(item) && inpersonDbStatus) {
      return norm(inpersonDbStatus);
    }

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
    if (s === "cancelled") return "bg-danger";
    return "bg-warning text-dark";
  };

  const getPaymentTypeBadgeClass = (type) => {
    const t = norm(type);
    if (t === "direct") return "bg-success";
    if (t === "block") return "bg-primary";
    if (t === "subscription") return "bg-warning text-dark";
    return "bg-secondary";
  };

  const getBookingTypeBadgeClass = (type) => {
    const t = norm(type);
    if (t === "manual") return "bg-primary";
    if (t === "web app") return "bg-success";
    return "bg-secondary";
  };

  const getAmountValue = (item) => {
    const raw = item?.booking_amount ?? item?.amount ?? 0;
    const n = Number(String(raw ?? "0").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const getAmountText = (item) => {
    const val = getAmountValue(item);
    return `AED ${val.toFixed(2)}`;
  };

  const isDirectBooking = (item) => norm(item?.payment_type) === "direct";
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

  const getTokenValue = async () => {
    const tokenResponse = await getToken();

    if (typeof tokenResponse === "string") return tokenResponse;
    if (typeof tokenResponse?.token === "string") return tokenResponse.token;
    if (typeof tokenResponse?.data?.token === "string") return tokenResponse.data.token;
    if (typeof tokenResponse?.data?.data?.token === "string") return tokenResponse.data.data.token;

    return "";
  };

  const setFieldSaving = (bookingId, field, isSaving) => {
    const key = `${bookingId}_${field}`;
    setSavingMap((prev) => ({
      ...prev,
      [key]: isSaving,
    }));
  };

  const isFieldSaving = (bookingId, field) => {
    const key = `${bookingId}_${field}`;
    return !!savingMap[key];
  };

  const patchRow = (bookingId, patch) => {
    setRows((prev) =>
      prev.map((row) =>
        String(getBookingId(row)) === String(bookingId)
          ? {
            ...row,
            ...patch,
          }
          : row
      )
    );
  };

  const updateDynamicBookingData = async (item, updates = {}) => {
    const bookingId = getBookingId(item);

    if (!bookingId) {
      throw new Error("Booking ID nahi mila.");
    }

    const token = await getTokenValue();

    if (!token) {
      throw new Error("Token nahi mila.");
    }

    const conditionId = /^\d+$/.test(String(bookingId)) ? Number(bookingId) : bookingId;

    const updateData = {};

    if (Object.prototype.hasOwnProperty.call(updates, "payment_status")) {
      updateData.payment_status = updates.payment_status;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "sessionType")) {
      updateData.sessionType = updates.sessionType;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "amount")) {
      updateData.amount = updates.amount;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error("Update data nahi mila.");
    }

    const payload = {
      token,
      tablename: "bookteacher",
      conditions: [
        {
          id: conditionId,
        },
      ],
      updatedata: [updateData],
    };

    const response = await axios.post(UPDATE_DYNAMIC_DATA_URL, payload, {
      headers: API_HEADERS,
    });

    if (response?.data?.statusCode !== 200) {
      throw new Error(response?.data?.message || "Update failed");
    }

    return response.data;
  };

  const openConfirmModal = (item, field, newValue) => {
    if (field === "payment_status") {
      const currentValue = getPaymentStatusDisplay(item?.payment_status);
      if (currentValue === newValue) return;

      setConfirmModal({
        open: true,
        item,
        field,
        newValue,
        title: "Update Payment Status",
        message: `Are you sure you want to change payment status from "${currentValue}" to "${newValue}"?`,
      });
      return;
    }

    if (field === "session_type") {
      const currentValue = getSessionTypeDisplay(item?.session_type);
      if (currentValue === newValue) return;

      setConfirmModal({
        open: true,
        item,
        field,
        newValue,
        title: "Update Session Type",
        message: `Are you sure you want to change session type from "${currentValue}" to "${newValue}"?`,
      });
      return;
    }

    if (field === "amount") {
      const currentValue = getAmountValue(item);
      const nextValue = Number(String(newValue ?? "0").replace(/,/g, "").trim());

      if (!Number.isFinite(nextValue) || nextValue < 0) {
        showAlert("error", "Invalid Amount", "Please enter a valid amount.");
        return;
      }

      if (currentValue === nextValue) return;

      setConfirmModal({
        open: true,
        item,
        field,
        newValue: nextValue,
        title: "Update Amount",
        message: `Are you sure you want to change amount from "AED ${currentValue.toFixed(
          2
        )}" to "AED ${nextValue.toFixed(2)}"?`,
      });
    }
  };

  const closeConfirmModal = () => {
    if (confirmLoading) return;
    setConfirmModal({
      open: false,
      item: null,
      field: "",
      newValue: "",
      title: "",
      message: "",
    });
  };

  const handleConfirmUpdate = async () => {
    const { item, field, newValue } = confirmModal;

    if (!item || !field || newValue === "" || newValue === null || newValue === undefined) return;

    const bookingId = getBookingId(item);
    if (!bookingId) {
      showAlert("error", "Update Failed", "Booking ID nahi mila.");
      closeConfirmModal();
      return;
    }

    setConfirmLoading(true);
    setFieldSaving(bookingId, field, true);

    const previousValue =
      field === "payment_status"
        ? getPaymentStatusDisplay(item?.payment_status)
        : field === "session_type"
          ? getSessionTypeDisplay(item?.session_type)
          : getAmountValue(item);

    const optimisticPatch =
      field === "payment_status"
        ? { payment_status: newValue }
        : field === "session_type"
          ? { session_type: newValue }
          : { booking_amount: newValue };

    patchRow(bookingId, optimisticPatch);

    try {
      await updateDynamicBookingData(
        {
          ...item,
          ...optimisticPatch,
        },
        field === "payment_status"
          ? { payment_status: newValue }
          : field === "session_type"
            ? { sessionType: newValue }
            : { amount: newValue }
      );

      if (field === "amount") {
        setAmountDraftMap((prev) => ({
          ...prev,
          [bookingId]: newValue,
        }));
      }

      showAlert("success", "Updated Successfully", `${confirmModal.title} done successfully.`);
      closeConfirmModal();
    } catch (error) {
      patchRow(
        bookingId,
        field === "payment_status"
          ? { payment_status: previousValue }
          : field === "session_type"
            ? { session_type: previousValue }
            : { booking_amount: previousValue }
      );

      if (field === "amount") {
        setAmountDraftMap((prev) => ({
          ...prev,
          [bookingId]: previousValue,
        }));
      }

      showAlert("error", "Update Failed", error?.message || "Something went wrong.");
    } finally {
      setConfirmLoading(false);
      setFieldSaving(bookingId, field, false);
    }
  };

  const fetchBookings = useCallback(async () => {
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

      setRows(sorted);
    } catch (err) {
      console.error("getAllBookings failed:", err);
      setRows([]);
      setLoadError("Bookings are not loading. Please check the Network.");
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    paymentTypeFilter,
    bookingStatusFilter,
    paymentStatusFilter,
    sessionTypeFilter,
    bookingTypeFilter,
    startDate,
    endDate,
  ]);

  const paymentOptions = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => {
      const p = norm(r?.payment_type);
      if (p) set.add(p);
    });
    return Array.from(set);
  }, [rows]);

  const sessionTypeOptions = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => {
      const s = getSessionTypeKey(r?.session_type);
      if (s) set.add(s);
    });
    return Array.from(set);
  }, [rows]);

  const bookingTypeOptions = useMemo(() => {
    const set = new Set();
    (rows || []).forEach((r) => {
      const b = norm(r?.booking_type);
      if (b) set.add(b);
    });
    return Array.from(set);
  }, [rows]);

  const filteredData = useMemo(() => {
    const sTerm = norm(searchTerm);
    const pFilter = norm(paymentTypeFilter);
    const bFilter = norm(bookingStatusFilter);
    const psFilter = norm(paymentStatusFilter);
    const stFilter = getSessionTypeKey(sessionTypeFilter);
    const btFilter = norm(bookingTypeFilter);

    const startM = startDate ? moment.tz(startDate, "YYYY-MM-DD", true, TZ) : null;
    const endM = endDate ? moment.tz(endDate, "YYYY-MM-DD", true, TZ) : null;

    return (rows || []).filter((item) => {
      const bookingStatus = getBookingStatus(item);

      const fullText = [
        item?.studentname || "",
        item?.teachername || "",
        item?.payment_type || "",
        getPaymentStatusDisplay(item?.payment_status),
        getSessionTypeDisplay(item?.session_type),
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
      const matchesPayment = !pFilter || norm(item?.payment_type) === pFilter;
      const matchesStatus = !bFilter || norm(bookingStatus) === bFilter;
      const matchesPaymentStatus =
        !psFilter || norm(getPaymentStatusDisplay(item?.payment_status)) === psFilter;
      const matchesSessionType =
        !stFilter || getSessionTypeKey(item?.session_type) === stFilter;
      const matchesBookingType = !btFilter || norm(item?.booking_type) === btFilter;

      const itemDate = parseBookDate(getBookDateValue(item));

      const fromOk = startM ? (itemDate ? itemDate.isSameOrAfter(startM, "day") : false) : true;
      const toOk = endM ? (itemDate ? itemDate.isSameOrBefore(endM, "day") : false) : true;

      return (
        matchesSearch &&
        matchesPayment &&
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
    paymentTypeFilter,
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
  }, [safePage, currentPage]);

  const exportToExcel = () => {
    const heading = [["Booking List"]];
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
        "Payment Status": getPaymentStatusDisplay(item?.payment_status) || "-",
        "Session Type": getSessionTypeDisplay(item?.session_type) || "-",
        "Booking Type": item?.booking_type || "-",
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
        getPaymentStatusDisplay(item?.payment_status) || "-",
        getSessionTypeDisplay(item?.session_type) || "-",
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
        <style>{`@keyframes spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  return (
    <div className="card h-100 p-0 radius-12">
      <style>{`
        .lyl-select-wrap {
          position: relative;
          min-width: 170px;
        }

       .lyl-select {
  width: 100%;
  height: 46px;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  border: 1px solid #2d7ff9;
  border-radius: 16px;
  padding: 0 42px 0 16px;
  background: #22324a;
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  outline: none;
  box-shadow: none;
  transition: all 0.2s ease;
}

        .lyl-select:hover {
          border-color: #2f83ff;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.03),
            0 10px 22px rgba(0,0,0,0.2);
        }

        .lyl-select-wrap::after {
          content: "";
          position: absolute;
          right: 16px;
          top: 50%;
          width: 10px;
          height: 10px;
          border-right: 2px solid rgba(255,255,255,0.9);
          border-bottom: 2px solid rgba(255,255,255,0.9);
          transform: translateY(-65%) rotate(45deg);
          pointer-events: none;
        }

        .lyl-select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .lyl-cell-note {
          margin-top: 7px;
          font-size: 11px;
          color: #8aa0bf;
          font-weight: 600;
        }

        .lyl-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1200;
          background: rgba(1, 9, 20, 0.72);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .lyl-modal-card {
          width: 100%;
          max-width: 430px;
          background: linear-gradient(180deg, #0a1d38 0%, #08162a 100%);
          border: 1px solid rgba(52, 123, 255, 0.28);
          border-radius: 24px;
          padding: 28px 24px 22px;
          box-shadow:
            0 24px 70px rgba(0,0,0,0.42),
            inset 0 0 0 1px rgba(255,255,255,0.02);
          text-align: center;
          color: #ffffff;
        }

        .lyl-modal-icon {
          width: 62px;
          height: 62px;
          border-radius: 50%;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 800;
          color: #ffffff;
          background: linear-gradient(180deg, #1d73ff 0%, #1558c8 100%);
          box-shadow: 0 14px 30px rgba(29, 115, 255, 0.25);
        }

        .lyl-modal-title {
          margin: 0 0 10px;
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
        }

        .lyl-modal-text {
          margin: 0;
          color: #aec1dc;
          font-size: 14px;
          line-height: 1.65;
        }

        .lyl-modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          justify-content: center;
        }

        .lyl-btn {
          min-width: 128px;
          height: 46px;
          border: 0;
          border-radius: 14px;
          font-weight: 700;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .lyl-btn-primary {
          color: #fff;
          background: linear-gradient(180deg, #1d73ff 0%, #1459ca 100%);
          box-shadow: 0 12px 24px rgba(29, 115, 255, 0.22);
        }

        .lyl-btn-secondary {
          color: #d7e4f7;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .lyl-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .lyl-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1300;
          min-width: 320px;
          max-width: 420px;
          border-radius: 18px;
          padding: 16px 18px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          color: #fff;
          box-shadow: 0 18px 48px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(6px);
        }

        .lyl-toast.success {
          background: linear-gradient(180deg, rgba(11, 78, 49, 0.97) 0%, rgba(8, 52, 34, 0.97) 100%);
        }

        .lyl-toast.error {
          background: linear-gradient(180deg, rgba(110, 19, 30, 0.97) 0%, rgba(71, 12, 19, 0.97) 100%);
        }

        .lyl-toast-title {
          font-size: 15px;
          font-weight: 800;
          margin-bottom: 3px;
        }

        .lyl-toast-message {
          font-size: 13px;
          line-height: 1.5;
          color: rgba(255,255,255,0.88);
        }

        .lyl-toast-close {
          border: 0;
          background: transparent;
          color: #ffffff;
          font-size: 22px;
          line-height: 1;
          padding: 0;
          opacity: 0.85;
        }

        .lyl-recording-modal {
          background: linear-gradient(180deg, #09192f 0%, #071425 100%);
          border: 1px solid rgba(52, 123, 255, 0.22);
          border-radius: 18px;
          padding: 16px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.35);
        }

        .lyl-recording-title {
          color: #ffffff;
          font-weight: 700;
        }

        .lyl-recording-close {
          border-radius: 12px;
        }
      `}</style>

      <AlertToast
        alertData={alertData}
        onClose={() => setAlertData((prev) => ({ ...prev, open: false }))}
      />

      <ConfirmActionModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Yes, Update"
        cancelText="Cancel"
        onConfirm={handleConfirmUpdate}
        onClose={closeConfirmModal}
        loading={confirmLoading}
      />

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
            value={paymentTypeFilter}
            onChange={(e) => setPaymentTypeFilter(e.target.value)}
          >
            <option value="">Payment: All</option>
            <option value="direct">Direct</option>
            <option value="block">Block</option>
            <option value="subscription">Subscription</option>
            {paymentOptions
              .filter((p) => !["direct", "block", "subscription"].includes(p))
              .map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
          </select>

          <select
            className="form-select form-select-sm w-auto"
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
          >
            <option value="">Payment Status: All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="free">Free</option>
          </select>

          <select
            className="form-select form-select-sm w-auto"
            value={sessionTypeFilter}
            onChange={(e) => setSessionTypeFilter(e.target.value)}
          >
            <option value="">Session Type: All</option>
            <option value="in-person">In-Person</option>
            <option value="online">Online</option>
            {sessionTypeOptions
              .filter((s) => !["in-person", "online"].includes(s))
              .map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
          </select>

          <select
            className="form-select form-select-sm w-auto"
            value={bookingTypeFilter}
            onChange={(e) => setBookingTypeFilter(e.target.value)}
          >
            <option value="">Booking Type: All</option>
            <option value="manual">Manual</option>
            <option value="web app">Web App</option>
            {bookingTypeOptions
              .filter((b) => !["manual", "web app"].includes(b))
              .map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
          </select>

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
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm("");
              setPaymentTypeFilter("");
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

        <button
          type="button"
          className="btn btn-primary btn-sm d-flex align-items-center gap-2"
          style={{
            borderRadius: "999px",
            padding: "10px 18px",
            boxShadow: "0 10px 22px rgba(13,110,253,0.22)",
          }}
          onClick={() => setIsManualBookingOpen(true)}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
            }}
          >
            +
          </span>
          Create Booking
        </button>
      </div>

      <div className="card-body p-24">
        {loadError ? (
          <div className="alert alert-danger d-flex align-items-center justify-content-between">
            <div>{loadError}</div>
            <button className="btn btn-sm btn-outline-light" onClick={fetchBookings}>
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
                  const bookingId = getBookingId(item);

                  const paymentSaving = isFieldSaving(bookingId, "payment_status");
                  const sessionSaving = isFieldSaving(bookingId, "session_type");

                  const currentPaymentStatus = getPaymentStatusDisplay(item?.payment_status);
                  const currentSessionType = getSessionTypeDisplay(item?.session_type);

                  return (
                    <tr key={makeRowKey(item)}>
                      <td>{indexOfFirstItem + index + 1}</td>

                      <td>
                        <button
                          type="button"
                          className={`btn btn-sm ${isDisabled ? "btn-outline-secondary" : "btn-outline-primary"
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
                      <td>
                        {isDirectBooking(item) ? (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="form-control form-control-sm"
                              style={{ width: "110px" }}
                              value={amountDraftMap[bookingId] ?? getAmountValue(item)}
                              disabled={isFieldSaving(bookingId, "amount")}
                              onChange={(e) => {
                                const value = e.target.value;
                                setAmountDraftMap((prev) => ({
                                  ...prev,
                                  [bookingId]: value,
                                }));
                              }}
                            />

                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              disabled={isFieldSaving(bookingId, "amount")}
                              onClick={() => {
                                const value = amountDraftMap[bookingId] ?? getAmountValue(item);
                                openConfirmModal(item, "amount", value);
                              }}
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          getAmountText(item)
                        )}

                        {isFieldSaving(bookingId, "amount") ? (
                          <div className="lyl-cell-note">Updating...</div>
                        ) : null}
                      </td>

                      <td>
                        <span className={`badge ${getPaymentTypeBadgeClass(item?.payment_type)}`}>
                          {item?.payment_type || "-"}
                        </span>
                      </td>

                      <td>
                        <DarkSelectEditor
                          value={currentPaymentStatus}
                          options={PAYMENT_STATUS_OPTIONS}
                          loading={paymentSaving}
                          onChange={(value) => openConfirmModal(item, "payment_status", value)}
                        />
                        {paymentSaving ? <div className="lyl-cell-note">Updating...</div> : null}
                      </td>

                      <td>
                        <DarkSelectEditor
                          value={currentSessionType}
                          options={SESSION_TYPE_OPTIONS}
                          loading={sessionSaving}
                          onChange={(value) => openConfirmModal(item, "session_type", value)}
                        />
                        {sessionSaving ? <div className="lyl-cell-note">Updating...</div> : null}
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
          style={{ background: "rgba(0,0,0,0.68)", zIndex: 1050 }}
          role="dialog"
          aria-modal="true"
          onClick={closeRecording}
        >
          <div
            className="lyl-recording-modal"
            style={{ width: "min(900px, 92vw)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0 lyl-recording-title">Recording</h6>
              <button className="btn btn-sm btn-outline-light lyl-recording-close" onClick={closeRecording}>
                Close
              </button>
            </div>

            {activeRecordingUrl ? (
              <video
                src={activeRecordingUrl}
                controls
                autoPlay
                style={{ width: "100%", maxHeight: "70vh", background: "#000", borderRadius: "12px" }}
              />
            ) : (
              <div className="text-center py-5 text-white">Recording not available</div>
            )}
          </div>
        </div>
      )}

      <RescheduleBookingModal
        key={selectedBooking?.bookingid || selectedBooking?.booking_id || "reschedule"}
        isOpen={isRescheduleOpen}
        onClose={closeRescheduleModal}
        onSuccess={fetchBookings}
        booking={selectedBooking}
        timezone={selectedBooking?.studentTime_zone || TZ}
      />

      <ManualBookingModal
        isOpen={isManualBookingOpen}
        title="Manual Booking"
        onClose={() => setIsManualBookingOpen(false)}
      />
    </div>
  );
};

export default RoleAccessLayer;