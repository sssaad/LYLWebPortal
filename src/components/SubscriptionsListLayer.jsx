import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import { getToken } from "../api/getToken";

const API_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

const SubscriptionsListLayer = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const FALLBACK_IMG = "https://gostudy.ae/assets/invalid-square.png";

  const getImageSrc = (item) => {
    const src = item?.imagepath;
    if (!src) return FALLBACK_IMG;

    const s = String(src).trim();
    if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
      return FALLBACK_IMG;
    }

    return s;
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  // ✅ INLINE AXIOS API CALL
  const fetchMonthlySubscriptions = async () => {
    try {
      setLoading(true);
      setError("");

      const token = await getToken();
      if (!token) {
        setError("Token missing");
        setSubscriptions([]);
        return;
      }

      const payload = { procedureName: "sp_get_monthly_subscriptions" };

      const res = await axios.post(API_URL, payload, {
        headers: { ...headers, token },
      });

      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      setSubscriptions(rows);
    } catch (err) {
      setSubscriptions([]);
      setError(
        err?.response?.data?.message || err?.message || "Internal API error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlySubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== helpers (API shape) =====
  const getStatus = (s) => s?.status || "-";
  const isActive = (s) => String(getStatus(s)).toLowerCase() === "active";

  const getName = (s) =>
    `${s?.firstname || ""} ${s?.lastname || ""}`.trim() ||
    s?.username ||
    "—";

  // ✅ RULE: username exists => use username, otherwise email
  const getStudentLogin = (s) => {
    const u = s?.username;
    if (u && String(u).trim() && String(u).toLowerCase() !== "null") {
      return String(u).trim();
    }
    return s?.email || "—";
  };

  // ✅ phone: always show with + (E.164 style). if already has +, keep it.
  const getPhoneText = (s) => {
    const raw = s?.phonenumber;
    if (!raw) return "—";
    const str = String(raw).trim();
    if (!str) return "—";
    return str.startsWith("+") ? str : `+${str}`;
  };

  const getCreated = (s) => s?.purchase_date || "";

  // ✅ purchase_date normalize + safe moment parse
  const toMoment = (d) => {
    if (!d) return null;
    const s0 = String(d).trim();

    // ".000000" (microseconds) -> ".000" (milliseconds)
    const s1 = s0
      .replace(/\.([0-9]{3})[0-9]+$/, ".$1")
      .replace(/\.0{6}\b/, ".000");

    // "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss" (ISO-ish)
    const isoish = s1.includes(" ") ? s1.replace(" ", "T") : s1;

    let m = moment(isoish, moment.ISO_8601, true);
    if (!m.isValid()) {
      m = moment(
        s1,
        ["YYYY-MM-DD HH:mm:ss.SSS", "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD"],
        true
      );
    }
    return m.isValid() ? m : null;
  };

  const getCreatedText = (s) => {
    const m = toMoment(getCreated(s));
    return m ? m.format("DD MMM YYYY") : "—";
  };

  // ✅ NEXT BILLING: ALWAYS + 1 MONTH
  const getNextBillingText = (s) => {
    if (!isActive(s)) return "-";

    const m = toMoment(s?.purchase_date);
    if (!m) return "-";

    return m.clone().add(1, "month").format("DD MMM YYYY");
  };

  // ✅ Revenue: parse "2750 AED" from package_name
  const getAmountNumber = (s) => {
    const pkg = String(s?.package_name || "");
    const m = pkg.match(/(\d[\d,]*)\s*AED/i);
    if (!m) return 0;
    const n = Number(String(m[1]).replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  // ✅ USED / REMAINING (from API)
  const getUsed = (s) => {
    const n = Number(s?.used_bookings ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  const getRemaining = (s) => {
    const n = Number(s?.remaining ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  // Optional helper (for "9/10 used" style)
  const getTotalSessions = (s) => {
    const used = getUsed(s);
    const rem = getRemaining(s);
    const total = used + rem;
    return total > 0 ? total : 0;
  };

  const badgeClassByStatus = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "active") return "bg-success";
    if (s === "expired") return "bg-secondary";
    if (s === "cancelled") return "bg-danger";
    return "bg-warning";
  };

  // ===== filters =====
  const filteredData = useMemo(() => {
    const term = (searchTerm || "").toLowerCase().trim();

    return (subscriptions || []).filter((item) => {
      const fullText = `${getName(item)} ${getStudentLogin(item)} ${item?.package_name || ""
        } ${getPhoneText(item)} ${item?.parentemail || ""} ${getStatus(item)}`
        .toLowerCase()
        .trim();

      const matchesSearch = term ? fullText.includes(term) : true;

      const matchesStatus =
        statusFilter === "" ||
        String(getStatus(item)).toLowerCase() ===
        String(statusFilter).toLowerCase();

      const cd = getCreated(item);
      const itemDate = cd ? new Date(String(cd).replace(".000000", "")) : null;

      const fromDateMatch = startDate
        ? itemDate
          ? itemDate >= new Date(startDate)
          : false
        : true;

      const toDateMatch = endDate
        ? itemDate
          ? itemDate <= new Date(endDate)
          : false
        : true;

      return matchesSearch && matchesStatus && fromDateMatch && toDateMatch;
    });
  }, [subscriptions, searchTerm, statusFilter, startDate, endDate]);

  // ✅ summary boxes (based on filtered results)
  const summary = useMemo(() => {
    const total = filteredData.length;
    const active = filteredData.filter((x) => isActive(x)).length;
    const revenue = filteredData.reduce((sum, x) => sum + getAmountNumber(x), 0);
    return { total, active, revenue };
  }, [filteredData]);

  // paging
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

  return (
    <div className="card h-100 p-0 radius-12">
      <style>{`
        .sub-muted { opacity: 0.75; font-size: 12px; }
        .sub-card {
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 14px 16px;
          background: rgba(0,0,0,0.02);
        }
        [data-bs-theme="dark"] .sub-card,
        [data-theme="dark"] .sub-card,
        .dark .sub-card {
          border-color: rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
        }
        .thumb {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          object-fit: cover;
          flex: 0 0 auto;
        }
        .name-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 240px;
        }
        .sessions-wrap { min-width: 170px; }
        .sessions-text { font-size: 12px; opacity: 0.8; }
      `}</style>

      {/* Header (filters) */}
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

          <select
            className="form-select form-select-sm w-auto"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Status: All</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("");
              setStartDate("");
              setEndDate("");
              setCurrentPage(1);
            }}
            className="btn btn-outline-secondary btn-sm"
          >
            Reset Filters
          </button>
        </div>

        <button
          onClick={fetchMonthlySubscriptions}
          className="btn btn-outline-primary btn-sm"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="card-body p-24">
        {error ? <div className="alert alert-danger mb-3">{error}</div> : null}

        {/* ✅ Summary boxes */}
        <div className="row g-3 mb-3">
          <div className="col-12 col-md-4">
            <div className="sub-card">
              <div className="sub-muted">Total Subscriptions</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {summary.total}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="sub-card">
              <div className="sub-muted">Active</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {summary.active}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="sub-card">
              <div className="sub-muted">Revenue</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                AED {summary.revenue.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive scroll-sm">
          <table className="table bordered-table sm-table mb-0">
            <thead>
              <tr>
                <th style={{ width: 70 }}>S.L</th>
                <th>Student Name</th>
                <th>Student Email/Username</th>
                <th>Package Type</th>
                <th>Contact No</th>
                <th>Parent Email</th>
                <th>Purchase Date</th>
                <th>Next Billing Date</th>

                {/* ✅ ADDED */}
                <th>Used</th>
                <th>Remaining</th>

                <th>Invoice</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center">
                    <div className="py-4">Loading...</div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center">
                    <div className="py-4">
                      <div style={{ fontWeight: 700 }}>No records found.</div>
                      <div className="sub-muted">
                        Try clearing filters or search.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item, index) => {
                  const used = getUsed(item);
                  const rem = getRemaining(item);
                  const total = getTotalSessions(item);
                  const pct =
                    total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;

                  return (
                    <tr key={`${item?.userid ?? "u"}-${index}`}>
                      <td>{indexOfFirstItem + index + 1}</td>

                      <td>
                        <div className="name-cell">
                          <img
                            className="thumb"
                            src={getImageSrc(item)}
                            alt="student"
                            onError={(e) => {
                              e.currentTarget.onerror = null; // prevent infinite loop
                              e.currentTarget.src = FALLBACK_IMG;
                            }}
                          />

                          <div>
                            <div style={{ fontWeight: 600 }}>{getName(item)}</div>
                            <div className="sub-muted">
                              User ID: {item?.userid ?? "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>{getStudentLogin(item)}</td>
                      <td>{item?.package_name || "—"}</td>
                      <td>{getPhoneText(item)}</td>
                      <td>{item?.parentemail || "—"}</td>
                      <td>{getCreatedText(item)}</td>
                      <td>{getNextBillingText(item)}</td>

                      {/* ✅ ADDED: Used */}
                      <td className="sessions-wrap">
                        <div style={{ fontWeight: 600 }}>
                          {total > 0 ? `${used}/${total} used` : `${used}`}
                        </div>
                        {total > 0 ? (
                          <>
                            <div className="progress mt-1" style={{ height: 6 }}>
                              <div
                                className="progress-bar"
                                role="progressbar"
                                style={{ width: `${pct}%` }}
                                aria-valuenow={pct}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              />
                            </div>
                            <div className="sessions-text mt-1">
                              Sessions this month
                            </div>
                          </>
                        ) : null}
                      </td>

                      {/* ✅ ADDED: Remaining */}
                      <td style={{ fontWeight: 600 }}>{rem}</td>

                      <td>
                        {item?.stripe_receipt_url ? (
                          <a
                            className="btn btn-primary btn-sm"
                            href={item.stripe_receipt_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>
                        <span
                          className={`badge ${badgeClassByStatus(getStatus(item))}`}
                        >
                          {getStatus(item)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="d-flex justify-content-between mt-3">
          <span>
            Showing {filteredData.length === 0 ? 0 : indexOfFirstItem + 1} to{" "}
            {Math.min(indexOfLastItem, filteredData.length)} of{" "}
            {filteredData.length} entries
          </span>

          <ul className="pagination">
            {Array.from({ length: totalPages }).map((_, i) => (
              <li
                key={i}
                className={`page-item ${currentPage === i + 1 ? "active" : ""}`}
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

export default SubscriptionsListLayer;
