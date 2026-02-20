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

const VALIDITY_DAYS = 60;

const BlockSubscriptionsListLayer = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // Active / Expired / Exhausted
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  // ✅ BLOCK SUBSCRIPTIONS API CALL
  const fetchBlockSubscriptions = async () => {
    try {
      setLoading(true);
      setError("");

      const token = await getToken();
      if (!token) {
        setError("Token missing");
        setSubscriptions([]);
        return;
      }

      const payload = { procedureName: "get_all_block_subscriptions" };

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
    fetchBlockSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== helpers =====
  const toNum = (v) => {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const formatAED = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return `AED ${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(x)}`;
  };

  const getUserId = (s) => s?.userid ?? s?.userId ?? "—";

  const getName = (s) => {
    const n = String(s?.studentFullname || "").trim();
    return n || s?.username || s?.email || "—";
  };

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

  const getPurchaseDateRaw = (s) => s?.createdAt || "";

  const toMoment = (d) => {
    if (!d) return null;
    const s0 = String(d).trim();

    const s1 = s0
      .replace(/\.([0-9]{3})[0-9]+$/, ".$1")
      .replace(/\.0{6}\b/, ".000");

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

  const getPurchaseDateText = (s) => {
    const m = toMoment(getPurchaseDateRaw(s));
    return m ? m.format("DD MMM YYYY") : "—";
  };

  // ✅ credits logic
  const getPackageCredits = (s) => toNum(s?.package); // e.g. 10
  const getUsedCredits = (s) => toNum(s?.used); // e.g. 1
  const getRemainingCredits = (s) =>
    Math.max(getPackageCredits(s) - getUsedCredits(s), 0);

  // ✅ validity 60 days
  const getValidTillMoment = (s) => {
    const m = toMoment(getPurchaseDateRaw(s));
    if (!m) return null;
    return m.clone().add(VALIDITY_DAYS, "days");
  };

  const getValidTillText = (s) => {
    const till = getValidTillMoment(s);
    return till ? till.format("DD MMM YYYY") : "—";
  };

  const getDaysLeftText = (s) => {
    const till = getValidTillMoment(s);
    if (!till) return "—";
    const today = moment().startOf("day");
    const endDay = till.clone().startOf("day");
    const diff = endDay.diff(today, "days");
    if (diff < 0) return "Expired";
    return `${diff} day${diff === 1 ? "" : "s"} left`;
  };

  // ✅ price logic (IMPORTANT)
  // price = NET (after discount), discount = discount amount
  // gross/original = price + discount
  const getNetPaid = (s) => toNum(s?.price); // ✅ paid amount (after discount)
  const getDiscountAmount = (s) => toNum(s?.discount);
  const getGrossAmount = (s) => getNetPaid(s) + getDiscountAmount(s);

  // ✅ status by validity + remaining
  const isExpired = (s) => {
    const till = getValidTillMoment(s);
    if (!till) return false;
    return moment().startOf("day").isAfter(till.clone().startOf("day"));
  };

  const getStatus = (s) => {
    if (isExpired(s)) return "Expired";
    if (getRemainingCredits(s) === 0) return "Exhausted";
    return "Active";
  };

  const badgeClassByStatus = (status) => {
    const st = String(status || "").toLowerCase();
    if (st === "active") return "bg-success";
    if (st === "expired") return "bg-danger";
    if (st === "exhausted") return "bg-warning";
    return "bg-secondary";
  };

  // ===== filters =====
  const filteredData = useMemo(() => {
    const term = (searchTerm || "").toLowerCase().trim();

    return (subscriptions || []).filter((item) => {
      const fullText = `${getName(item)} ${getStudentLogin(item)} ${
        item?.code ?? ""
      } ${getPhoneText(item)} ${item?.parentemail || ""} ${
        item?.package ?? ""
      } ${item?.price ?? ""} ${item?.discount ?? ""} ${getStatus(item)}`
        .toLowerCase()
        .trim();

      const matchesSearch = term ? fullText.includes(term) : true;

      const matchesStatus =
        statusFilter === "" ||
        String(getStatus(item)).toLowerCase() ===
          String(statusFilter).toLowerCase();

      const cd = getPurchaseDateRaw(item);
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

  // ✅ summary boxes (filtered)
  const summary = useMemo(() => {
    const total = filteredData.length;
    const active = filteredData.filter((x) => getStatus(x) === "Active").length;
    const remaining = filteredData.reduce(
      (sum, x) => sum + getRemainingCredits(x),
      0
    );

    const netCollected = filteredData.reduce(
      (sum, x) => sum + getNetPaid(x),
      0
    );
    const totalDiscount = filteredData.reduce(
      (sum, x) => sum + getDiscountAmount(x),
      0
    );
    const grossTotal = filteredData.reduce(
      (sum, x) => sum + getGrossAmount(x),
      0
    );

    return { total, active, remaining, netCollected, totalDiscount, grossTotal };
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

        /* ✅ Used credits display (same style vibe) */
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
          onClick={fetchBlockSubscriptions}
          className="btn btn-outline-primary btn-sm"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="card-body p-24">
        {error ? <div className="alert alert-danger mb-3">{error}</div> : null}

        {/* ✅ Summary */}
        <div className="row g-3 mb-3">
          <div className="col-12 col-md-2">
            <div className="sub-card">
              <div className="sub-muted">Total</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {summary.total}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-2">
            <div className="sub-card">
              <div className="sub-muted">Active</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {summary.active}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-2">
            <div className="sub-card">
              <div className="sub-muted">Revenue</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {formatAED(summary.netCollected)}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-2">
            <div className="sub-card">
              <div className="sub-muted">Discount Given</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {formatAED(summary.totalDiscount)}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-2">
            <div className="sub-card">
              <div className="sub-muted">Gross Amount</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {formatAED(summary.grossTotal)}
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
                <th>Package Credits</th>
                <th>Used Credits</th>
                <th>Remaining Credits</th>
                <th>Grade Wise Base Amount</th>
                <th>Discount</th>
                <th>Paid</th>
                <th>Promo Code</th>
                <th>Contact No</th>
                <th>Parent Email</th>
                <th>Purchase Date</th>
                <th>Valid Till</th>
                <th>Days Left</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={16} className="text-center">
                    <div className="py-4">Loading...</div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={16} className="text-center">
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
                  const totalCredits = getPackageCredits(item);
                  const usedCredits = getUsedCredits(item);
                  const pct =
                    totalCredits > 0
                      ? Math.min(
                          100,
                          Math.max(0, (usedCredits / totalCredits) * 100)
                        )
                      : 0;

                  return (
                    <tr key={`${getUserId(item)}-${index}`}>
                      <td>{indexOfFirstItem + index + 1}</td>

                      <td>
                        <div className="name-cell">
                          {/* ✅ imagepath placeholder (aap baad mein bind kar lena) */}
                          {item?.imagepath ? (
                            <img
                              className="thumb"
                              src={item.imagepath}
                              alt="student"
                            />
                          ) : (
                            <div
                              className="thumb"
                              style={{
                                background: "rgba(0,0,0,0.08)",
                                display: "inline-block",
                              }}
                            />
                          )}

                          <div>
                            <div style={{ fontWeight: 600 }}>{getName(item)}</div>
                            <div className="sub-muted">
                              User ID: {getUserId(item)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>{getStudentLogin(item)}</td>
                      <td>{getPackageCredits(item) || "—"}</td>

                      {/* ✅ Used Credits (same style like monthly screen) */}
                      <td className="sessions-wrap">
                        <div style={{ fontWeight: 600 }}>
                          {totalCredits > 0
                            ? `${usedCredits}/${totalCredits} used`
                            : `${usedCredits}`}
                        </div>

                        {totalCredits > 0 ? (
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
                              Credits used
                            </div>
                          </>
                        ) : null}
                      </td>

                      <td style={{ fontWeight: 700 }}>
                        {getRemainingCredits(item)}
                      </td>

                      <td>{formatAED(getGrossAmount(item))}</td>
                      <td>{formatAED(getDiscountAmount(item))}</td>
                      <td style={{ fontWeight: 700 }}>
                        {formatAED(getNetPaid(item))}
                      </td>

                      <td>{item?.code ?? "—"}</td>
                      <td>{getPhoneText(item)}</td>
                      <td>{item?.parentemail || "—"}</td>
                      <td>{getPurchaseDateText(item)}</td>
                      <td>{getValidTillText(item)}</td>
                      <td>{getDaysLeftText(item)}</td>

                      <td>
                        <span
                          className={`badge ${badgeClassByStatus(
                            getStatus(item)
                          )}`}
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

export default BlockSubscriptionsListLayer;
