import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import moment from "moment";
import { getToken } from "../api/getToken";
import { getDashboardCounts } from "../api/getDashboardCounts";

/**
 * ✅ GET API:
 * https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_lookup_data
 *
 * ✅ SAVE API:
 * https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data
 *
 * Token BODY me jayega (getToken se).
 * Single-row Save (prefer unique teacher_payout_id).
 * Swal alerts on save success/fail.
 */

const GET_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_lookup_data";

const SAVE_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

const TeacherPayoutListPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ Total Revenue (Dashboard API: totalpayments)
  const [totalRevenue, setTotalRevenue] = useState(0);

  // filters
  const [searchTerm, setSearchTerm] = useState("");
  const [paidFilter, setPaidFilter] = useState(""); // All / Paid / Unpaid
  const [methodFilter, setMethodFilter] = useState(""); // All / Cash / Bank / Online
  const [startDate, setStartDate] = useState(""); // YYYY-MM-DD
  const [endDate, setEndDate] = useState(""); // YYYY-MM-DD
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  // token cache
  const tokenRef = useRef("");

  // avoid setState after unmount + cancel requests
  const isMountedRef = useRef(true);
  const fetchAbortRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (fetchAbortRef.current) fetchAbortRef.current.abort();
    };
  }, []);

  const ensureToken = async () => {
    if (tokenRef.current) return tokenRef.current;

    try {
      const t = await getToken();
      tokenRef.current = t || "";
      return tokenRef.current;
    } catch (e) {
      tokenRef.current = "";
      return "";
    }
  };

  const clearTokenIfLooksInvalid = (msg) => {
    const m = String(msg || "").toLowerCase();
    if (
      m.includes("token") ||
      m.includes("unauthorized") ||
      m.includes("invalid") ||
      m.includes("expired")
    ) {
      tokenRef.current = "";
    }
  };

  // ========= helpers =========
  const safeId = (v) => String(v ?? "").trim();

  const makeFallbackKey = () =>
    `row_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const parseSqlLikeDateTime = (s) => {
    // supports: "YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss", ISO
    if (!s) return null;
    const str = String(s).trim();
    if (!str) return null;

    const normalized = str.includes(" ") ? str.replace(" ", "T") : str;
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const ymdLocalStart = (ymd) => {
    if (!ymd) return null;
    const d = new Date(`${ymd}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const ymdLocalEnd = (ymd) => {
    if (!ymd) return null;
    const d = new Date(`${ymd}T23:59:59.999`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const fmtDate = (d) => {
    if (!d) return "—";
    const dd = parseSqlLikeDateTime(d);
    if (!dd) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(dd);
  };

  // ✅ Moment time formatter (robust)
  const fmtTime = (t) => {
    if (!t) return "—";

    const s = String(t).trim();
    if (!s) return "—";

    // handle cases:
    // "14:30", "14:30:00", "2:30 PM", "02:30 pm", etc
    const m = moment(s, ["HH:mm:ss", "HH:mm", "h:mm A", "hh:mm A"], true);

    if (m.isValid()) {
      // change to "HH:mm" if you want 24-hour
      return m.format("hh:mm A");
    }

    // fallback: try slicing if it's like "14:30:00"
    if (s.length >= 5) return s.slice(0, 5);
    return s;
  };

  const parseAmount = (v) => {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const money = (n) => `AED ${Number(n || 0).toFixed(2)}`;

  const toYMD = (v) => {
    if (!v) return "";
    const s = String(v).trim();
    if (!s) return "";

    if (s.includes(" ")) return s.split(" ")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  const ymdToSqlDatetime = (ymd) => {
    if (!ymd) return null;
    return `${ymd} 00:00:00`;
  };

  const todayYMD = () => new Date().toISOString().slice(0, 10);

  const getPaidStatus = (row) =>
    String(row?.paid_status).toLowerCase() === "paid" ? "Paid" : "Unpaid";

  const badgeClassByStatus = (status) =>
    String(status).toLowerCase() === "paid" ? "bg-success" : "bg-secondary";

  const toAmountString2dpOrNull = (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null; // empty => null
    const n = parseAmount(s);
    return Number.isFinite(n) ? n.toFixed(2) : null;
  };

  // ========= Dashboard Total Revenue (totalpayments) =========
  const fetchTotalRevenue = async () => {
    try {
      const res = await getDashboardCounts();

      // ✅ handle both shapes: nested OR already-flat
      const counts = res?.get_dashboardcounts || res;

      const rev = parseAmount(counts?.totalpayments);
      if (!isMountedRef.current) return;
      setTotalRevenue(rev);
    } catch (e) {
      console.error("Total revenue fetch error:", e);
      if (!isMountedRef.current) return;
      setTotalRevenue(0);
    }
  };

  // ========= GET API =========
  const fetchTeacherPayouts = async () => {
    try {
      if (fetchAbortRef.current) fetchAbortRef.current.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      setLoading(true);
      setError("");

      const token = await ensureToken();
      if (!token) {
        if (!isMountedRef.current) return;
        setRows([]);
        setError("Token missing");
        return;
      }

      const body = { token, tablename: "teacher_payouts" };
      const res = await axios.post(GET_URL, body, {
        headers,
        signal: controller.signal,
      });

      const data = Array.isArray(res?.data?.data) ? res.data.data : [];

      const mapped = data.map((x) => {
        const teacher_payout_id = safeId(x?.teacher_payout_id);
        const booking_id = safeId(x?.booking_id);

        // stable unique key for UI + updates + radio groups
        const _key = teacher_payout_id || booking_id || makeFallbackKey();

        const isTutorPaid = String(x?.is_tutor_paid ?? "0") === "1";

        return {
          _key,

          teacher_payout_id,
          booking_id,

          teacher_name: x?.teacher_name ?? "—",
          student_name: x?.student_name ?? "—",
          subject_name: x?.subject_name ?? "—",

          booking_date: x?.session_date ?? "",
          slot_start: x?.start_time ?? "",
          slot_end: x?.end_time ?? "",

          session_fee_aed: x?.session_fee_aed ?? "0",

          // editable fields
          payment_amount_aed:
            x?.tutor_payout_aed !== null &&
            x?.tutor_payout_aed !== undefined &&
            String(x?.tutor_payout_aed).trim() !== ""
              ? String(x?.tutor_payout_aed)
              : "",

          paid_status: isTutorPaid ? "Paid" : "Unpaid",
          paid_on: toYMD(x?.tutor_paid_on) || "",
          payout_method: x?.payout_method ? String(x.payout_method) : "",

          // ui meta
          _dirty: false,
          _saving: false,
          _rowError: "",
        };
      });

      if (!isMountedRef.current) return;
      setRows(mapped);
      setCurrentPage(1);
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;

      const msg =
        err?.response?.data?.message || err?.message || "Internal API error";

      clearTokenIfLooksInvalid(msg);

      if (!isMountedRef.current) return;
      setRows([]);
      setError(msg);
    } finally {
      if (!isMountedRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherPayouts();
    fetchTotalRevenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========= EDIT =========
  const markDirty = (r) => ({ ...r, _dirty: true, _rowError: "" });

  const updatePaymentAmount = (_key, val) => {
    setRows((prev) =>
      prev.map((r) =>
        r._key === _key ? markDirty({ ...r, payment_amount_aed: val }) : r
      )
    );
  };

  const updatePaidStatus = (_key, status) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._key !== _key) return r;

        if (status === "Paid") {
          return markDirty({
            ...r,
            paid_status: "Paid",
            paid_on: r.paid_on || todayYMD(),
          });
        }

        return markDirty({
          ...r,
          paid_status: "Unpaid",
          paid_on: "",
        });
      })
    );
  };

  const updatePaidOn = (_key, val) => {
    setRows((prev) =>
      prev.map((r) => (r._key === _key ? markDirty({ ...r, paid_on: val }) : r))
    );
  };

  const updateMethod = (_key, val) => {
    setRows((prev) =>
      prev.map((r) =>
        r._key === _key ? markDirty({ ...r, payout_method: val }) : r
      )
    );
  };

  const setRowError = (_key, msg) => {
    setRows((prev) =>
      prev.map((r) => (r._key === _key ? { ...r, _rowError: msg } : r))
    );
  };

  // ========= SAVE (update_dynamic_data) =========
  const buildConditions = (row) => {
    const conditions = [];

    if (safeId(row?.teacher_payout_id)) {
      conditions.push({ teacher_payout_id: String(row.teacher_payout_id) });
    }
    if (safeId(row?.booking_id)) {
      conditions.push({ booking_id: String(row.booking_id) });
    }

    return conditions;
  };

  const saveRow = async (row) => {
    const isPaid = getPaidStatus(row) === "Paid";

    const hasTeacherPayoutId = !!safeId(row?.teacher_payout_id);
    const hasBookingId = !!safeId(row?.booking_id);

    if (!hasTeacherPayoutId && !hasBookingId) {
      setRowError(
        row._key,
        "No unique id found (teacher_payout_id / booking_id). Cannot update."
      );
      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: "No unique id found (teacher_payout_id / booking_id). Cannot update.",
      });
      return;
    }

    if (!hasTeacherPayoutId && hasBookingId) {
      Swal.fire({
        icon: "warning",
        title: "Warning",
        text:
          "teacher_payout_id missing. Saving with booking_id only (may update multiple rows if duplicates exist).",
        timer: 2200,
        showConfirmButton: false,
      });
    }

    if (isPaid && !row.paid_on) {
      setRowError(row._key, "Paid on date is required when status is Paid.");
      Swal.fire({
        icon: "warning",
        title: "Missing Paid Date",
        text: "Paid on date is required when status is Paid.",
      });
      return;
    }

    const controller = new AbortController();

    try {
      setRows((prev) =>
        prev.map((r) =>
          r._key === row._key ? { ...r, _saving: true, _rowError: "" } : r
        )
      );

      const token = await ensureToken();
      if (!token) throw new Error("Token missing");

      const conditions = buildConditions(row);
      if (!conditions.length) throw new Error("No valid conditions to update");

      const payload = {
        token,
        tablename: "teacher_payouts",
        conditions,
        updatedata: [
          {
            tutor_payout_aed: toAmountString2dpOrNull(row.payment_amount_aed),
            is_tutor_paid: isPaid ? "1" : "0",
            tutor_paid_on: isPaid ? ymdToSqlDatetime(row.paid_on) : null,
            payout_method: row.payout_method ? String(row.payout_method) : null,
          },
        ],
      };

      const res = await axios.post(SAVE_URL, payload, {
        headers,
        signal: controller.signal,
      });

      const ok =
        res?.data?.statusCode === 200 ||
        String(res?.data?.message || "").toLowerCase().includes("successful");

      if (!ok) throw new Error(res?.data?.message || "Save failed");

      if (!isMountedRef.current) return;

      setRows((prev) =>
        prev.map((r) =>
          r._key === row._key
            ? { ...r, _saving: false, _dirty: false, _rowError: "" }
            : r
        )
      );

      Swal.fire({
        icon: "success",
        title: "Saved",
        text: "Record updated successfully ✅",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;

      const msg =
        err?.response?.data?.message || err?.message || "Save failed";

      clearTokenIfLooksInvalid(msg);

      if (!isMountedRef.current) return;

      setRows((prev) =>
        prev.map((r) =>
          r._key === row._key ? { ...r, _saving: false, _rowError: msg } : r
        )
      );

      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: msg,
      });
    }
  };

  // ========= filtering =========
  const resetFilters = () => {
    setSearchTerm("");
    setPaidFilter("");
    setMethodFilter("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const filteredData = useMemo(() => {
    const term = (searchTerm || "").toLowerCase().trim();
    const fromD = startDate ? ymdLocalStart(startDate) : null;
    const toD = endDate ? ymdLocalEnd(endDate) : null;

    const filtered = (rows || []).filter((x) => {
      const fullText = `${x?.booking_id ?? ""} ${x?.teacher_name ?? ""} ${x?.student_name ?? ""} ${
        x?.subject_name ?? ""
      } ${x?.booking_date ?? ""} ${x?.slot_start ?? ""} ${x?.slot_end ?? ""} ${
        x?.paid_status ?? ""
      } ${x?.payout_method ?? ""}`
        .toLowerCase()
        .trim();

      const matchesSearch = term ? fullText.includes(term) : true;

      const matchesPaid =
        paidFilter === ""
          ? true
          : String(x?.paid_status || "").toLowerCase() ===
            String(paidFilter).toLowerCase();

      const matchesMethod =
        methodFilter === ""
          ? true
          : String(x?.payout_method || "").toLowerCase() ===
            String(methodFilter).toLowerCase();

      const itemDate = parseSqlLikeDateTime(x?.booking_date);

      const fromMatch = fromD ? (itemDate ? itemDate >= fromD : false) : true;
      const toMatch = toD ? (itemDate ? itemDate <= toD : false) : true;

      return matchesSearch && matchesPaid && matchesMethod && fromMatch && toMatch;
    });

    // ✅ SORT: latest date first (current date on top)
    return filtered.slice().sort((a, b) => {
      const da = parseSqlLikeDateTime(a?.booking_date);
      const db = parseSqlLikeDateTime(b?.booking_date);

      const ta = da ? da.getTime() : -Infinity;
      const tb = db ? db.getTime() : -Infinity;

      return tb - ta; // DESC
    });
  }, [rows, searchTerm, paidFilter, methodFilter, startDate, endDate]);

  const summary = useMemo(() => {
    const total = filteredData.length;
    const paid = filteredData.filter(
      (x) => String(x?.paid_status).toLowerCase() === "paid"
    ).length;
    const unpaid = total - paid;

    const totalPayment = filteredData.reduce(
      (sum, x) => sum + parseAmount(x?.payment_amount_aed),
      0
    );

    // ✅ Profit = Total Revenue - Total Paid Amount
    const totalProfit = (Number(totalRevenue) || 0) - (Number(totalPayment) || 0);

    return { total, paid, unpaid, totalProfit, totalPayment };
  }, [filteredData, totalRevenue]);

  // ========= pagination =========
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="card h-100 p-0 radius-12">
      <style>{`
        .sub-muted { opacity: 0.75; font-size: 12px; }
        .sub-card {
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 14px 16px;
          background: rgba(0,0,0,0.02);
          height: 100%;
        }
        [data-bs-theme="dark"] .sub-card,
        [data-theme="dark"] .sub-card,
        .dark .sub-card {
          border-color: rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
        }

        .cell-strong { font-weight: 600; }
        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }

        .amount-input { min-width: 170px; }
        .date-input { min-width: 160px; }
        .method-select { min-width: 140px; }

        /* ✅ Dark theme date input + disabled fix */
        [data-bs-theme="dark"] .date-input,
        [data-theme="dark"] .date-input,
        .dark .date-input {
          background-color: rgba(255,255,255,0.04) !important;
          border-color: rgba(255,255,255,0.12) !important;
          color: rgba(255,255,255,0.92) !important;
          color-scheme: dark;
        }
        [data-bs-theme="dark"] .date-input:disabled,
        [data-theme="dark"] .date-input:disabled,
        .dark .date-input:disabled {
          background-color: rgba(255,255,255,0.06) !important;
          border-color: rgba(255,255,255,0.12) !important;
          color: rgba(255,255,255,0.45) !important;
          opacity: 1 !important;
          -webkit-text-fill-color: rgba(255,255,255,0.45) !important;
        }
        [data-bs-theme="dark"] .date-input::-webkit-calendar-picker-indicator,
        [data-theme="dark"] .date-input::-webkit-calendar-picker-indicator,
        .dark .date-input::-webkit-calendar-picker-indicator {
          filter: invert(1);
          opacity: 0.9;
        }

        .row-error { color: #dc3545; font-size: 12px; margin-top: 6px; }
      `}</style>

      {/* Header */}
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between">
        <div className="d-flex align-items-center flex-wrap gap-3">
          <input
            type="text"
            className="form-control w-auto"
            placeholder="Search booking / teacher / student / subject"
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
            title="From (booking date)"
          />
          <input
            type="date"
            className="form-control w-auto"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
            title="To (booking date)"
          />

          <select
            className="form-select form-select-sm w-auto"
            value={paidFilter}
            onChange={(e) => {
              setPaidFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Paid: All</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>

          <select
            className="form-select form-select-sm w-auto"
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Method: All</option>
            <option value="Cash">Cash</option>
            <option value="Bank">Bank</option>
            <option value="Online">Online</option>
          </select>

          <button onClick={resetFilters} className="btn btn-outline-secondary btn-sm">
            Reset Filters
          </button>
        </div>

        <button
          onClick={() => {
            fetchTeacherPayouts();
            fetchTotalRevenue();
          }}
          className="btn btn-outline-primary btn-sm"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Body */}
      <div className="card-body p-24">
        {error ? <div className="alert alert-danger mb-3">{error}</div> : null}

        {/* Summary (Design same + Total Revenue after Paid/Unpaid) */}
        <div className="row g-3 mb-3">
          <div className="col-12 col-md-3">
            <div className="sub-card">
              <div className="sub-muted">Total</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.total}</div>
            </div>
          </div>

          <div className="col-12 col-md-3">
            <div className="sub-card">
              <div className="sub-muted">Paid / Unpaid</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {summary.paid} / {summary.unpaid}
              </div>
            </div>
          </div>

          {/* ✅ Total Revenue box (after Paid/Unpaid) */}
          <div className="col-12 col-md-3">
            <div className="sub-card">
              <div className="sub-muted">Total Revenue</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {money(totalRevenue)}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-3">
            <div className="sub-card">
              <div className="sub-muted">Total Profit</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {money(summary.totalProfit)}
              </div>
            </div>
          </div>

          {/* ✅ Total Paid Amount (same box, same design) */}
          <div className="col-12 col-md-3">
            <div className="sub-card">
              <div className="sub-muted">Total Paid Amount</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {money(summary.totalPayment)}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table className="table bordered-table sm-table mb-0">
            <thead>
              <tr>
                <th style={{ width: 70 }}>S.L</th>
                <th>Booking ID</th>
                <th>Teacher Name</th>
                <th>Student Name</th>
                <th>Subject Name</th>
                <th>Booking Date</th>
                <th>Slot Start</th>
                <th>Slot End</th>
                <th>Grade Wise Session Fee</th>
                <th>Payment Amount (AED)</th>
                <th>Paid?</th>
                <th>Paid on</th>
                <th>Payout Method</th>
                <th style={{ width: 120 }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} className="text-center">
                    <div className="py-4">Loading...</div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center">
                    <div className="py-4">
                      <div style={{ fontWeight: 700 }}>No records found.</div>
                      <div className="sub-muted">Try clearing filters or search.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((x, index) => {
                  const isPaid = getPaidStatus(x) === "Paid";
                  const radioName = `paid-${x._key}`;

                  return (
                    <tr key={x._key}>
                      <td>{indexOfFirstItem + index + 1}</td>

                      <td className="mono cell-strong">{x.booking_id || "—"}</td>
                      <td className="cell-strong">{x.teacher_name}</td>
                      <td>{x.student_name}</td>
                      <td>{x.subject_name}</td>
                      <td>{fmtDate(x.booking_date)}</td>

                      {/* ✅ Moment formatted time */}
                      <td className="mono">{fmtTime(x.slot_start)}</td>
                      <td className="mono">{fmtTime(x.slot_end)}</td>

                      <td>{money(parseAmount(x.session_fee_aed))}</td>

                      <td>
                        <input
                          className="form-control form-control-sm amount-input"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Enter amount"
                          value={x.payment_amount_aed}
                          onChange={(e) =>
                            updatePaymentAmount(x._key, e.target.value)
                          }
                        />
                        {x._rowError ? (
                          <div className="row-error">{x._rowError}</div>
                        ) : null}
                      </td>

                      <td>
                        <div className="d-flex gap-3 flex-wrap">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name={radioName}
                              id={`paid-yes-${x._key}`}
                              checked={isPaid}
                              onChange={() => updatePaidStatus(x._key, "Paid")}
                            />
                            <label
                              className="form-check-label"
                              htmlFor={`paid-yes-${x._key}`}
                            >
                              Paid
                            </label>
                          </div>

                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name={radioName}
                              id={`paid-no-${x._key}`}
                              checked={!isPaid}
                              onChange={() => updatePaidStatus(x._key, "Unpaid")}
                            />
                            <label
                              className="form-check-label"
                              htmlFor={`paid-no-${x._key}`}
                            >
                              Unpaid
                            </label>
                          </div>
                        </div>

                        <div className="mt-2">
                          <span
                            className={`badge ${badgeClassByStatus(
                              x.paid_status
                            )}`}
                          >
                            {x.paid_status}
                          </span>
                          {x._dirty ? (
                            <span className="badge bg-warning text-dark ms-2">
                              Unsaved
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td>
                        <input
                          className="form-control form-control-sm date-input"
                          type="date"
                          value={x.paid_on || ""}
                          disabled={!isPaid}
                          onChange={(e) => updatePaidOn(x._key, e.target.value)}
                        />
                      </td>

                      <td>
                        <select
                          className="form-select form-select-sm method-select"
                          value={x.payout_method || ""}
                          onChange={(e) => updateMethod(x._key, e.target.value)}
                        >
                          <option value="">Select</option>
                          <option value="Cash">Cash</option>
                          <option value="Bank">Bank</option>
                          <option value="Online">Online</option>
                        </select>
                      </td>

                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={!x._dirty || x._saving}
                          onClick={() => saveRow(x)}
                        >
                          {x._saving ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="d-flex justify-content-between mt-3 flex-wrap gap-2">
          <span>
            Showing {filteredData.length === 0 ? 0 : indexOfFirstItem + 1} to{" "}
            {Math.min(indexOfLastItem, filteredData.length)} of{" "}
            {filteredData.length} entries
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
  );
};

export default TeacherPayoutListPage;