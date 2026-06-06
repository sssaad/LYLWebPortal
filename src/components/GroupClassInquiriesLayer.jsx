import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import Swal from "sweetalert2";
import { Icon } from "@iconify/react";
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

const STORED_PROCEDURE_NAME = "sp_get_group_class_inquiries";
const TABLE_NAME = "group_class_inquiries";

const STATUS_OPTIONS = ["New", "Contacted", "Interested", "Not Interested", "Converted"];

const formatDateTime = (value) => {
  if (!value) return "-";

  const m = moment(
    value,
    [
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DDTHH:mm:ss",
      "YYYY-MM-DD",
      moment.ISO_8601,
    ],
    true
  );

  if (m.isValid()) return m.format("DD MMM YYYY, hh:mm A");

  const loose = moment(value);
  return loose.isValid() ? loose.format("DD MMM YYYY, hh:mm A") : String(value);
};

const getStatusClass = (status) => {
  const s = String(status || "").toLowerCase();

  if (s === "converted") return "bg-success-focus text-success-main";
  if (s === "contacted") return "bg-info-focus text-info-main";
  if (s === "interested") return "bg-warning-focus text-warning-main";
  if (s === "not interested") return "bg-danger-focus text-danger-main";
  if (s === "new") return "bg-primary-50 text-primary-600";

  return "bg-neutral-200 text-neutral-700";
};

const getStatusIcon = (status) => {
  const s = String(status || "").toLowerCase();

  if (s === "converted") return "mdi:account-check-outline";
  if (s === "contacted") return "mdi:phone-check-outline";
  if (s === "interested") return "mdi:star-outline";
  if (s === "not interested") return "mdi:account-cancel-outline";
  if (s === "new") return "mdi:clipboard-plus-outline";

  return "mdi:information-outline";
};

const GroupClassInquiriesLayer = () => {
  const [rows, setRows] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const fetchRows = async () => {
    try {
      setInitialLoading(true);

      const token = await getToken();
      if (!token) throw new Error("Token not found");

      const headers = { ...BASE_HEADERS, token };

      const body = {
        procedureName: STORED_PROCEDURE_NAME,
        parameters: [],
      };

      const res = await axios.post(RUN_SP_URL, body, { headers });
      const data = res?.data?.data ?? [];

      if (Array.isArray(data)) {
        const mapped = data.map((item, index) => ({
          key: item.id ?? `row-${index}`,
          id: item.id ?? null,
          programmeFullName: item.programme_full_name ?? "",
          studentName: item.student_name ?? "",
          yearGroup: item.year_group ?? "",
          contact: item.contact ?? "",
          parentEmail: item.parent_email ?? "",
          school: item.school ?? "",
          numberOfStudents: item.number_of_students ?? "",
          message: item.message ?? "",
          inquiryStatus: item.inquiry_status ?? "New",
          createdAt: item.created_at ?? "",
        }));

        setRows(mapped);
      } else {
        setRows([]);
      }

      setCurrentPage(1);
    } catch (error) {
      console.error(error);
      setRows([]);
      Swal.fire("Error", "Failed to load group class enquiries.", "error");
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;

    const fresh = rows.filter(
      (r) => String(r.inquiryStatus).toLowerCase() === "new"
    ).length;

    const contacted = rows.filter(
      (r) => String(r.inquiryStatus).toLowerCase() === "contacted"
    ).length;

    const converted = rows.filter(
      (r) => String(r.inquiryStatus).toLowerCase() === "converted"
    ).length;

    const interested = rows.filter(
      (r) => String(r.inquiryStatus).toLowerCase() === "interested"
    ).length;

    return {
      total,
      fresh,
      contacted,
      converted,
      interested,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();

    return rows.filter((row) => {
      if (statusFilter && row.inquiryStatus !== statusFilter) {
        return false;
      }

      if (q) {
        const blob = `
          ${row.id ?? ""}
          ${row.programmeFullName ?? ""}
          ${row.studentName ?? ""}
          ${row.yearGroup ?? ""}
          ${row.contact ?? ""}
          ${row.parentEmail ?? ""}
          ${row.school ?? ""}
          ${row.numberOfStudents ?? ""}
          ${row.message ?? ""}
          ${row.inquiryStatus ?? ""}
          ${row.createdAt ?? ""}
        `
          .toLowerCase()
          .trim();

        if (!blob.includes(q)) return false;
      }

      return true;
    });
  }, [rows, search, statusFilter]);

  const totalPages = Math.ceil(filteredRows.length / perPage) || 1;
  const indexOfLast = currentPage * perPage;
  const indexOfFirst = indexOfLast - perPage;
  const currentRows = filteredRows.slice(indexOfFirst, indexOfLast);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  const handleStatusUpdate = async (row, newStatus) => {
    if (!row?.id) {
      return Swal.fire("Error", "Enquiry ID is missing.", "error");
    }

    if (!newStatus || newStatus === row.inquiryStatus) return;

    const confirm = await Swal.fire({
      title: "Update Status?",
      text: `Do you want to update this Enquiry status to "${newStatus}"?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Update",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      setUpdatingId(row.id);

      const token = await getToken();
      if (!token) throw new Error("Token not found");

      Swal.fire({
        title: "Updating...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const payload = {
        token,
        tablename: TABLE_NAME,
        conditions: [{ id: Number(row.id) }],
        updatedata: [
          {
            inquiry_status: newStatus,
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
          res?.data?.message || "Failed to update inquiry status.",
          "error"
        );
      }

      setRows((prev) =>
        prev.map((item) =>
          Number(item.id) === Number(row.id)
            ? { ...item, inquiryStatus: newStatus }
            : item
        )
      );

      Swal.fire({
        icon: "success",
        title: "Updated!",
        text: "Enquiry status updated successfully.",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        "Something went wrong while updating inquiry status.",
        "error"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSoftDelete = async (row) => {
    if (!row?.id) {
      return Swal.fire("Error", "Enquiry ID is missing.", "error");
    }

    const confirm = await Swal.fire({
      title: "Delete Enquiry?",
      text: "Are you sure you want to delete this enquiry?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc3545",
    });

    if (!confirm.isConfirmed) return;

    try {
      setDeletingId(row.id);

      const token = await getToken();
      if (!token) throw new Error("Token not found");

      Swal.fire({
        title: "Deleting...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const payload = {
        token,
        tablename: TABLE_NAME,
        conditions: [{ id: Number(row.id) }],
        updatedata: [
          {
            deleted: 1,
            deleted_at: moment().format("YYYY-MM-DD HH:mm:ss"),
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
          res?.data?.message || "Failed to delete inquiry.",
          "error"
        );
      }

      setRows((prev) =>
        prev.filter((item) => Number(item.id) !== Number(row.id))
      );

      Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Enquiry deleted successfully.",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        "Something went wrong while deleting inquiry.",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const statCards = [
    {
      title: "Total Enquiries",
      value: stats.total,
      icon: "mdi:clipboard-list-outline",
      className: "bg-primary-50 text-primary-600",
    },
    {
      title: "New",
      value: stats.fresh,
      icon: "mdi:clipboard-plus-outline",
      className: "bg-primary-50 text-primary-600",
    },
    {
      title: "Contacted",
      value: stats.contacted,
      icon: "mdi:phone-check-outline",
      className: "bg-info-focus text-info-main",
    },
    {
      title: "Converted",
      value: stats.converted,
      icon: "mdi:account-check-outline",
      className: "bg-success-focus text-success-main",
    },
  ];

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
        .gci-card {
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,.035);
          overflow: hidden;
        }

        .gci-stat-card {
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,.06);
          background: var(--white);
          padding: 18px;
          height: 100%;
          transition: all .2s ease;
        }

        .gci-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0,0,0,.06);
        }

        .gci-stat-icon {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .gci-toolbar {
          background: linear-gradient(180deg, rgba(72,127,255,.06), rgba(72,127,255,0));
          border-bottom: 1px solid rgba(0,0,0,.06);
          padding: 18px;
        }

        .gci-title-icon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(72,127,255,.12);
          color: #487fff;
          font-size: 24px;
        }

        .gci-search-wrap {
          position: relative;
        }

        .gci-search-wrap .gci-search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          opacity: .6;
          font-size: 18px;
        }

        .gci-search-wrap input {
          padding-left: 42px;
        }

        .gci-table thead th {
          background: rgba(0,0,0,.025);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .03em;
          color: var(--text-secondary-light);
          white-space: nowrap;
          padding-top: 14px;
          padding-bottom: 14px;
        }

        .gci-table tbody td {
          vertical-align: middle;
          padding-top: 14px;
          padding-bottom: 14px;
        }

        .gci-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          background: rgba(72,127,255,.12);
          color: #487fff;
          flex: 0 0 auto;
        }

        .gci-contact-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: inherit;
          text-decoration: none;
        }

        .gci-contact-link:hover {
          color: #487fff;
        }

        .gci-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .gci-id-badge {
          border-radius: 10px;
          padding: 6px 10px;
          background: rgba(0,0,0,.04);
          font-weight: 700;
          font-size: 12px;
        }

        .gci-empty {
          padding: 56px 16px;
          text-align: center;
        }

        .gci-empty-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(72,127,255,.10);
          color: #487fff;
          font-size: 36px;
          margin-bottom: 14px;
        }

        .gci-action-select {
          min-width: 155px;
          border-radius: 10px;
        }

        .gci-delete-btn {
          border-radius: 10px;
          min-width: 92px;
        }

        .gci-footer {
          padding: 18px 24px 26px;
          min-height: 76px;
        }

        .gci-message {
          max-width: 280px;
          white-space: normal;
          line-height: 1.5;
        }

        .gci-card .pagination .page-link {
          min-width: 34px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-color: rgba(0,0,0,.08);
          font-weight: 600;
          box-shadow: none;
        }

        .gci-card .pagination .page-item.active .page-link {
          background: #0d6efd;
          border-color: #0d6efd;
          color: #fff;
        }

        @media (max-width: 767px) {
          .gci-toolbar {
            padding: 14px;
          }

          .gci-stat-card {
            padding: 14px;
          }

          .gci-footer {
            padding: 16px;
          }
        }
      `}</style>

      <div className="col-12">
        <div className="row gy-3">
          {statCards.map((card) => (
            <div className="col-xxl-3 col-sm-6" key={card.title}>
              <div className="gci-stat-card">
                <div className="d-flex align-items-center justify-content-between gap-3">
                  <div>
                    <span className="text-secondary-light text-sm fw-medium">
                      {card.title}
                    </span>
                    <h4 className="mb-0 mt-1">{card.value}</h4>
                  </div>

                  <div className={`gci-stat-icon ${card.className}`}>
                    <Icon icon={card.icon} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-xxl-12">
        <div className="card gci-card h-100 p-0">
          <div className="gci-toolbar">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div className="d-flex align-items-center gap-3">
                <div className="gci-title-icon">
                  <Icon icon="mdi:account-question-outline" />
                </div>

                <div>
                  <h6 className="mb-1">Group Class Enquiries</h6>
                  <p className="mb-0 text-secondary-light text-sm">
                    Manage group class enquiries from the website.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline-primary d-inline-flex align-items-center gap-2"
                onClick={fetchRows}
              >
                <Icon icon="mdi:refresh" />
                Refresh
              </button>
            </div>

            <div className="row gy-2 align-items-end">
              <div className="col-lg-6">
                <label className="form-label fw-semibold">Search</label>
                <div className="gci-search-wrap">
                  <Icon icon="mdi:magnify" className="gci-search-icon" />
                  <input
                    className="form-control"
                    placeholder="Search by programme, student, parent email, phone, school..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-lg-3 col-md-6">
                <label className="form-label fw-semibold">Status</label>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-lg-3 col-md-6">
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table gci-table bordered-table mb-0">
                <thead>
                  <tr>
                    <th className="text-center">Enquiry ID</th>
                    <th>Programme</th>
                    <th>Student</th>
                    <th>Contact</th>
                    <th>School / Year</th>
                    <th>Students</th>
                    <th>Message</th>
                    <th className="text-center">Status</th>
                    <th>Submitted On</th>
                    <th className="text-center">Change Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {currentRows.length === 0 ? (
                    <tr>
                      <td colSpan={11}>
                        <div className="gci-empty">
                          <div className="gci-empty-icon">
                            <Icon icon="mdi:clipboard-search-outline" />
                          </div>
                          <h6 className="mb-1">
                            No group class enquiries found
                          </h6>
                          <p className="mb-0 text-secondary-light">
                            Try changing your search or status filter.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((row) => {
                      const initials = String(row.studentName || "I")
                        .trim()
                        .split(" ")
                        .map((x) => x[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();

                      const isBusy =
                        Number(updatingId) === Number(row.id) ||
                        Number(deletingId) === Number(row.id);

                      return (
                        <tr key={row.key}>
                          <td className="text-center">
                            <span className="gci-id-badge">#{row.id}</span>
                          </td>

                          <td>
                            <div className="fw-semibold text-primary-light">
                              {row.programmeFullName || "-"}
                            </div>
                          </td>

                          <td>
                            <div className="d-flex align-items-center gap-3">
                              <div className="gci-avatar">{initials}</div>
                              <div>
                                <div className="fw-semibold text-primary-light">
                                  {row.studentName || "-"}
                                </div>
                                <div className="text-secondary-light text-sm mt-1">
                                  Year Group:{" "}
                                  <span className="fw-semibold">
                                    {row.yearGroup || "-"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="d-flex flex-column gap-1">
                              {row.contact ? (
                                <a
                                  className="gci-contact-link text-sm text-secondary-light"
                                  href={`tel:${row.contact}`}
                                >
                                  <Icon icon="mdi:phone-outline" />
                                  {row.contact}
                                </a>
                              ) : (
                                <span className="text-secondary-light text-sm">
                                  No phone
                                </span>
                              )}

                              {row.parentEmail ? (
                                <a
                                  className="gci-contact-link text-sm text-secondary-light"
                                  href={`mailto:${row.parentEmail}`}
                                >
                                  <Icon icon="mdi:email-outline" />
                                  {row.parentEmail}
                                </a>
                              ) : (
                                <span className="text-secondary-light text-sm">
                                  No parent email
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="fw-semibold text-primary-light">
                              {row.school || "-"}
                            </div>
                            <div className="text-secondary-light text-sm mt-1">
                              {row.yearGroup || "-"}
                            </div>
                          </td>

                          <td>
                            <span className="fw-semibold">
                              {row.numberOfStudents || "-"}
                            </span>
                          </td>

                          <td>
                            <div className="text-secondary-light text-sm gci-message">
                              {row.message || "-"}
                            </div>
                          </td>

                          <td className="text-center">
                            <span
                              className={`gci-status-pill ${getStatusClass(
                                row.inquiryStatus
                              )}`}
                            >
                              <Icon icon={getStatusIcon(row.inquiryStatus)} />
                              {row.inquiryStatus || "-"}
                            </span>
                          </td>

                          <td>
                            <div className="fw-semibold">
                              {formatDateTime(row.createdAt)}
                            </div>
                          </td>

                          <td className="text-center">
                            <select
                              className="form-select form-select-sm gci-action-select mx-auto"
                              value={row.inquiryStatus || ""}
                              disabled={isBusy}
                              onChange={(e) =>
                                handleStatusUpdate(row, e.target.value)
                              }
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger gci-delete-btn d-inline-flex align-items-center justify-content-center gap-1"
                              onClick={() => handleSoftDelete(row)}
                              disabled={isBusy}
                              title="Delete Enquiry"
                            >
                              <Icon icon="mdi:trash-can-outline" />
                              {Number(deletingId) === Number(row.id)
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="gci-footer d-flex flex-wrap justify-content-between align-items-center gap-2">
              <span className="text-secondary-light fw-medium">
                Showing {filteredRows.length === 0 ? 0 : indexOfFirst + 1} to{" "}
                {Math.min(indexOfLast, filteredRows.length)} of{" "}
                {filteredRows.length} entries
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
      </div>
    </div>
  );
};

export default GroupClassInquiriesLayer;