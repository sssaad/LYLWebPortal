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

const GroupPaymentsLayer = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  const fetchGroupPayments = async () => {
    try {
      setLoading(true);
      setError("");

      const token = await getToken();

      if (!token) {
        setError("Token missing");
        setPayments([]);
        return;
      }

      const payload = {
        procedureName: "sp_get_group_payments_admin_review_list",
      };

      const res = await axios.post(API_URL, payload, {
        headers: { ...headers, token },
      });

      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      setPayments(rows);
    } catch (err) {
      console.error("Group payments API error:", err);
      setPayments([]);
      setError(
        err?.response?.data?.message || err?.message || "Internal API error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupPayments();
  }, []);

  const normalize = (value) => String(value || "").toLowerCase().trim();

  const getPaymentId = (item) =>
    item?.group_payment_id || item?.id || item?.payment_id || "-";

  const getStudentName = (item) =>
    item?.student_name ||
    item?.student_fullname ||
    `${item?.student_firstname || ""} ${item?.student_lastname || ""}`.trim() ||
    item?.firstname ||
    item?.username ||
    "-";

  const getProgrammeName = (item) =>
    item?.programme_name ||
    item?.group_programme_name ||
    item?.program_name ||
    item?.name ||
    "-";

  const getProgrammeStage = (item) =>
    item?.programme_stage || item?.stage || "";

  const getTeacherName = (item) =>
    item?.teachers || item?.teacher_names || item?.teacher_name || "-";

  const getSubjectName = (item) =>
    item?.subjects ||
    item?.subject_names ||
    item?.subjectname ||
    item?.subject_name ||
    "-";

  const getStatus = (item) =>
    item?.group_payment_status ||
    item?.payment_status ||
    item?.status ||
    item?.payment_status_label ||
    "-";

  const getStatusLabel = (item) =>
    item?.payment_status_label || getStatus(item) || "-";

  const getMethod = (item) =>
    item?.payment_method || item?.paymentType || item?.method || "-";

  const getAmount = (item) => {
    const value = Number(item?.amount || item?.programme_price || 0);
    return Number.isFinite(value) ? value : 0;
  };

  const getAmountText = (item) => {
    return `AED ${getAmount(item).toFixed(2)}`;
  };

  const getBookedClasses = (item) => item?.booked_classes || "-";

  const toMoment = (dateValue) => {
    if (!dateValue) return null;

    const raw = String(dateValue).trim();

    const clean = raw
      .replace(/\.([0-9]{3})[0-9]+$/, ".$1")
      .replace(/\.0{6}\b/, ".000");

    const isoish = clean.includes(" ") ? clean.replace(" ", "T") : clean;

    let m = moment(isoish, moment.ISO_8601, true);

    if (!m.isValid()) {
      m = moment(
        clean,
        ["YYYY-MM-DD HH:mm:ss.SSS", "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD"],
        true
      );
    }

    return m.isValid() ? m : null;
  };

  const getCreated = (item) =>
    item?.createddate || item?.created_at || item?.payment_date || "";

  const badgeClassByStatus = (status) => {
    const s = normalize(status);

    if (s === "paid") return "bg-success";
    if (s === "unpaid") return "bg-warning";
    if (s === "pending") return "bg-info";
    if (s === "failed") return "bg-danger";
    if (s === "cancelled" || s === "canceled") return "bg-secondary";

    return "bg-secondary";
  };

  const filteredData = useMemo(() => {
    const term = normalize(searchTerm);

    return (payments || []).filter((item) => {
      const fullText = `
        ${getPaymentId(item)}
        ${getStudentName(item)}
        ${getProgrammeName(item)}
        ${getProgrammeStage(item)}
        ${getTeacherName(item)}
        ${getSubjectName(item)}
        ${item?.group_batch_id || ""}
        ${getAmountText(item)}
        ${getBookedClasses(item)}
        ${getStatus(item)}
        ${getStatusLabel(item)}
        ${getMethod(item)}
      `
        .toLowerCase()
        .trim();

      const matchesSearch = term ? fullText.includes(term) : true;

      const matchesStatus =
        statusFilter === "" ||
        normalize(getStatus(item)) === normalize(statusFilter) ||
        normalize(getStatusLabel(item)) === normalize(statusFilter);

      const created = getCreated(item);
      const itemDate = created
        ? new Date(String(created).replace(".000000", ""))
        : null;

      const fromDateMatch = startDate
        ? itemDate
          ? itemDate >= new Date(startDate)
          : false
        : true;

      const toDateMatch = endDate
        ? itemDate
          ? itemDate <= new Date(`${endDate}T23:59:59`)
          : false
        : true;

      return matchesSearch && matchesStatus && fromDateMatch && toDateMatch;
    });
  }, [payments, searchTerm, statusFilter, startDate, endDate]);

  const summary = useMemo(() => {
    const total = filteredData.length;

    const paid = filteredData.filter(
      (item) => normalize(getStatus(item)) === "paid"
    ).length;

    const unpaid = filteredData.filter(
      (item) => normalize(getStatus(item)) === "unpaid"
    ).length;

    const pending = filteredData.filter(
      (item) => normalize(getStatus(item)) === "pending"
    ).length;

    const totalAmount = filteredData.reduce(
      (sum, item) => sum + getAmount(item),
      0
    );

    const paidAmount = filteredData
      .filter((item) => normalize(getStatus(item)) === "paid")
      .reduce((sum, item) => sum + getAmount(item), 0);

    const unpaidAmount = filteredData
      .filter((item) => normalize(getStatus(item)) === "unpaid")
      .reduce((sum, item) => sum + getAmount(item), 0);

    return {
      total,
      paid,
      unpaid,
      pending,
      totalAmount,
      paidAmount,
      unpaidAmount,
    };
  }, [filteredData]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

  return (
    <div className="card h-100 p-0 radius-12">
      <style>{`
        .gp-muted {
          opacity: 0.75;
          font-size: 12px;
        }

        .gp-card {
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 14px 16px;
          background: rgba(0,0,0,0.02);
        }

        [data-bs-theme="dark"] .gp-card,
        [data-theme="dark"] .gp-card,
        .dark .gp-card {
          border-color: rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
        }

        .gp-main-text {
          font-size: 22px;
          font-weight: 700;
        }

        .gp-name-cell {
          min-width: 220px;
        }

        .gp-programme-cell {
          min-width: 240px;
        }

        .gp-teacher-cell {
          min-width: 170px;
        }

        .gp-classes-cell {
          min-width: 300px;
          max-width: 430px;
          white-space: normal;
          line-height: 1.5;
        }

        .gp-badge {
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          display: inline-block;
          text-transform: capitalize;
        }
      `}</style>

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
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
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
          onClick={fetchGroupPayments}
          className="btn btn-outline-primary btn-sm"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="card-body p-24">
        {error ? <div className="alert alert-danger mb-3">{error}</div> : null}

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-4 col-xl-3">
            <div className="gp-card">
              <div className="gp-muted">Total Group Payments</div>
              <div className="gp-main-text">{summary.total}</div>
            </div>
          </div>

          <div className="col-12 col-md-4 col-xl-3">
            <div className="gp-card">
              <div className="gp-muted">Paid</div>
              <div className="gp-main-text">{summary.paid}</div>
              <div className="gp-muted">AED {summary.paidAmount.toFixed(2)}</div>
            </div>
          </div>

          <div className="col-12 col-md-4 col-xl-3">
            <div className="gp-card">
              <div className="gp-muted">Unpaid</div>
              <div className="gp-main-text">{summary.unpaid}</div>
              <div className="gp-muted">
                AED {summary.unpaidAmount.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4 col-xl-3">
            <div className="gp-card">
              <div className="gp-muted">Total Amount</div>
              <div className="gp-main-text">
                AED {summary.totalAmount.toFixed(2)}
              </div>
              <div className="gp-muted">Pending: {summary.pending}</div>
            </div>
          </div>
        </div>

        <div className="table-responsive scroll-sm">
          <table className="table bordered-table sm-table mb-0">
            <thead>
              <tr>
                <th style={{ width: 70 }}>S.L</th>
                <th>Student</th>
                <th>Programme</th>
                <th>Batch ID</th>
                <th>Teacher</th>
                <th>Subject</th>
                <th>Classes</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center">
                    <div className="py-4">Loading...</div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center">
                    <div className="py-4">
                      <div style={{ fontWeight: 700 }}>No records found.</div>
                      <div className="gp-muted">
                        Try clearing filters or search.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item, index) => {
                  return (
                    <tr key={`${getPaymentId(item)}-${index}`}>
                      <td>{indexOfFirstItem + index + 1}</td>

                      <td>
                        <div className="gp-name-cell">
                          <div style={{ fontWeight: 600 }}>
                            {getStudentName(item)}
                          </div>
                          <div className="gp-muted">
                            Payment ID: {getPaymentId(item)}
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="gp-programme-cell">
                          <div style={{ fontWeight: 600 }}>
                            {getProgrammeName(item)}
                          </div>
                          {getProgrammeStage(item) ? (
                            <div className="gp-muted">
                              {getProgrammeStage(item)}
                            </div>
                          ) : null}
                        </div>
                      </td>

                      <td>{item?.group_batch_id || "-"}</td>

                      <td>
                        <div className="gp-teacher-cell">
                          {getTeacherName(item)}
                        </div>
                      </td>

                      <td>{getSubjectName(item)}</td>

                      <td>
                        <div className="gp-classes-cell">
                          {getBookedClasses(item)}
                        </div>
                      </td>

                      <td style={{ fontWeight: 700 }}>{getAmountText(item)}</td>

                      <td>{getMethod(item)}</td>

                      <td>
                        <span
                          className={`gp-badge ${badgeClassByStatus(
                            getStatus(item)
                          )}`}
                        >
                          {getStatusLabel(item)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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

export default GroupPaymentsLayer;