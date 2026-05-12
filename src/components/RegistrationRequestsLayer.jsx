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

const STORED_PROCEDURE_NAME = "sp_get_group_programme_enquiries";
const TABLE_NAME = "group_programme_enquiries";

const STATUS_OPTIONS = ["Not Registered", "Registered", "Contacted", "Pending"];

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

  if (s === "registered") return "bg-success-focus text-success-main";
  if (s === "contacted") return "bg-info-focus text-info-main";
  if (s === "pending") return "bg-warning-focus text-warning-main";
  if (s === "not registered") return "bg-danger-focus text-danger-main";

  return "bg-neutral-200 text-neutral-700";
};

const getStatusIcon = (status) => {
  const s = String(status || "").toLowerCase();

  if (s === "registered") return "mdi:account-check-outline";
  if (s === "contacted") return "mdi:phone-check-outline";
  if (s === "pending") return "mdi:clock-outline";
  if (s === "not registered") return "mdi:account-alert-outline";

  return "mdi:information-outline";
};

const RegistrationRequestsLayer = () => {
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
          studentName: item.student_name ?? "",
          studentEmail: item.student_email ?? "",
          studentYearGroup: item.student_year_group ?? "",
          studentSchool: item.student_school ?? "",
          parentName: item.parent_name ?? "",
          parentPhoneNumber: item.parent_phone_number ?? "",
          parentEmailAddress: item.parent_email_address ?? "",
          registrationStatus: item.registration_status ?? "Not Registered",
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
      Swal.fire("Error", "Failed to load registration requests.", "error");
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;

    const notRegistered = rows.filter(
      (r) => String(r.registrationStatus).toLowerCase() === "not registered"
    ).length;

    const registered = rows.filter(
      (r) => String(r.registrationStatus).toLowerCase() === "registered"
    ).length;

    const contacted = rows.filter(
      (r) => String(r.registrationStatus).toLowerCase() === "contacted"
    ).length;

    const pending = rows.filter(
      (r) => String(r.registrationStatus).toLowerCase() === "pending"
    ).length;

    return {
      total,
      notRegistered,
      registered,
      contacted,
      pending,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();

    return rows.filter((row) => {
      if (statusFilter && row.registrationStatus !== statusFilter) {
        return false;
      }

      if (q) {
        const blob = `
          ${row.id ?? ""}
          ${row.studentName ?? ""}
          ${row.studentEmail ?? ""}
          ${row.studentYearGroup ?? ""}
          ${row.studentSchool ?? ""}
          ${row.parentName ?? ""}
          ${row.parentPhoneNumber ?? ""}
          ${row.parentEmailAddress ?? ""}
          ${row.registrationStatus ?? ""}
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
      return Swal.fire("Error", "Request ID is missing.", "error");
    }

    if (!newStatus || newStatus === row.registrationStatus) return;

    const confirm = await Swal.fire({
      title: "Update Status?",
      text: `Do you want to update this request status to "${newStatus}"?`,
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
            registration_status: newStatus,
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
          res?.data?.message || "Failed to update registration status.",
          "error"
        );
      }

      setRows((prev) =>
        prev.map((item) =>
          Number(item.id) === Number(row.id)
            ? { ...item, registrationStatus: newStatus }
            : item
        )
      );

      Swal.fire({
        icon: "success",
        title: "Updated!",
        text: "Registration request status updated successfully.",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        "Something went wrong while updating registration status.",
        "error"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSoftDelete = async (row) => {
    if (!row?.id) {
      return Swal.fire("Error", "Request ID is missing.", "error");
    }

    const confirm = await Swal.fire({
      title: "Delete Request?",
      text: "Are you sure you want to delete this request?",
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
          res?.data?.message || "Failed to delete registration request.",
          "error"
        );
      }

      setRows((prev) =>
        prev.filter((item) => Number(item.id) !== Number(row.id))
      );

      Swal.fire({
        icon: "success",
        title: "Deleted!",
        text: "Registration request deleted successfully.",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        "Something went wrong while deleting registration request.",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const statCards = [
    {
      title: "Total Requests",
      value: stats.total,
      icon: "mdi:clipboard-list-outline",
      className: "bg-primary-50 text-primary-600",
    },
    {
      title: "Not Registered",
      value: stats.notRegistered,
      icon: "mdi:account-alert-outline",
      className: "bg-danger-focus text-danger-main",
    },
    {
      title: "Registered",
      value: stats.registered,
      icon: "mdi:account-check-outline",
      className: "bg-success-focus text-success-main",
    },
    {
      title: "Follow-ups",
      value: stats.contacted + stats.pending,
      icon: "mdi:phone-in-talk-outline",
      className: "bg-warning-focus text-warning-main",
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
        .rr-card {
          border: 1px solid rgba(0,0,0,.06);
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,.035);
          overflow: hidden;
        }

        .rr-stat-card {
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,.06);
          background: var(--white);
          padding: 18px;
          height: 100%;
          transition: all .2s ease;
        }

        .rr-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0,0,0,.06);
        }

        .rr-stat-icon {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .rr-toolbar {
          background: linear-gradient(180deg, rgba(72,127,255,.06), rgba(72,127,255,0));
          border-bottom: 1px solid rgba(0,0,0,.06);
          padding: 18px;
        }

        .rr-title-icon {
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

        .rr-search-wrap {
          position: relative;
        }

        .rr-search-wrap .rr-search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          opacity: .6;
          font-size: 18px;
        }

        .rr-search-wrap input {
          padding-left: 42px;
        }

        .rr-table thead th {
          background: rgba(0,0,0,.025);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .03em;
          color: var(--text-secondary-light);
          white-space: nowrap;
          padding-top: 14px;
          padding-bottom: 14px;
        }

        .rr-table tbody td {
          vertical-align: middle;
          padding-top: 14px;
          padding-bottom: 14px;
        }

        .rr-avatar {
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

        .rr-contact-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: inherit;
          text-decoration: none;
        }

        .rr-contact-link:hover {
          color: #487fff;
        }

        .rr-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .rr-id-badge {
          border-radius: 10px;
          padding: 6px 10px;
          background: rgba(0,0,0,.04);
          font-weight: 700;
          font-size: 12px;
        }

        .rr-empty {
          padding: 56px 16px;
          text-align: center;
        }

        .rr-empty-icon {
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

        .rr-action-select {
          min-width: 165px;
          border-radius: 10px;
        }

        .rr-delete-btn {
          border-radius: 10px;
          min-width: 92px;
        }

        .rr-footer {
          padding: 18px 24px 26px;
          min-height: 76px;
        }

        .rr-card .pagination .page-link {
          min-width: 34px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-color: rgba(0,0,0,.08);
          font-weight: 600;
          box-shadow: none;
        }

        .rr-card .pagination .page-item.active .page-link {
          background: #0d6efd;
          border-color: #0d6efd;
          color: #fff;
        }

        .rr-card .pagination .page-item:first-child .page-link {
          border-top-left-radius: 6px;
          border-bottom-left-radius: 6px;
        }

        .rr-card .pagination .page-item:last-child .page-link {
          border-top-right-radius: 6px;
          border-bottom-right-radius: 6px;
        }

        @media (max-width: 767px) {
          .rr-toolbar {
            padding: 14px;
          }

          .rr-stat-card {
            padding: 14px;
          }

          .rr-footer {
            padding: 16px;
          }
        }
      `}</style>

      <div className="col-12">
        <div className="row gy-3">
          {statCards.map((card) => (
            <div className="col-xxl-3 col-sm-6" key={card.title}>
              <div className="rr-stat-card">
                <div className="d-flex align-items-center justify-content-between gap-3">
                  <div>
                    <span className="text-secondary-light text-sm fw-medium">
                      {card.title}
                    </span>
                    <h4 className="mb-0 mt-1">{card.value}</h4>
                  </div>

                  <div className={`rr-stat-icon ${card.className}`}>
                    <Icon icon={card.icon} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-xxl-12">
        <div className="card rr-card h-100 p-0">
          <div className="rr-toolbar">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div className="d-flex align-items-center gap-3">
                <div className="rr-title-icon">
                  <Icon icon="mdi:account-plus-outline" />
                </div>

                <div>
                  <h6 className="mb-1">Registration Requests</h6>
                  <p className="mb-0 text-secondary-light text-sm">
                    Manage requests and registration status.
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
                <div className="rr-search-wrap">
                  <Icon icon="mdi:magnify" className="rr-search-icon" />
                  <input
                    className="form-control"
                    placeholder="Search by student, parent, email, phone, school..."
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
              <table className="table rr-table bordered-table mb-0">
                <thead>
                  <tr>
                    <th className="text-center">Request ID</th>
                    <th>Student Details</th>
                    <th>Parent Details</th>
                    <th>School / Year Group</th>
                    <th className="text-center">Current Status</th>
                    <th>Submitted On</th>
                    <th className="text-center">Change Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {currentRows.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="rr-empty">
                          <div className="rr-empty-icon">
                            <Icon icon="mdi:clipboard-search-outline" />
                          </div>
                          <h6 className="mb-1">
                            No registration requests found
                          </h6>
                          <p className="mb-0 text-secondary-light">
                            Try changing your search or status filter.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((row) => {
                      const initials = String(row.studentName || "R")
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
                            <span className="rr-id-badge">#{row.id}</span>
                          </td>

                          <td>
                            <div className="d-flex align-items-center gap-3">
                              <div className="rr-avatar">{initials}</div>

                              <div>
                                <div className="fw-semibold text-primary-light">
                                  {row.studentName || "-"}
                                </div>

                                {row.studentEmail ? (
                                  <a
                                    className="rr-contact-link text-sm text-secondary-light mt-1"
                                    href={`mailto:${row.studentEmail}`}
                                  >
                                    <Icon icon="mdi:email-outline" />
                                    {row.studentEmail}
                                  </a>
                                ) : (
                                  <div className="text-secondary-light text-sm mt-1">
                                    No student email
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="fw-semibold text-primary-light">
                              {row.parentName || "-"}
                            </div>

                            <div className="d-flex flex-column gap-1 mt-1">
                              {row.parentPhoneNumber ? (
                                <a
                                  className="rr-contact-link text-sm text-secondary-light"
                                  href={`tel:${row.parentPhoneNumber}`}
                                >
                                  <Icon icon="mdi:phone-outline" />
                                  {row.parentPhoneNumber}
                                </a>
                              ) : (
                                <span className="text-secondary-light text-sm">
                                  No phone number
                                </span>
                              )}

                              {row.parentEmailAddress ? (
                                <a
                                  className="rr-contact-link text-sm text-secondary-light"
                                  href={`mailto:${row.parentEmailAddress}`}
                                >
                                  <Icon icon="mdi:email-outline" />
                                  {row.parentEmailAddress}
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
                              {row.studentSchool || "-"}
                            </div>
                            <div className="text-secondary-light text-sm mt-1">
                              Year Group:{" "}
                              <span className="fw-semibold">
                                {row.studentYearGroup || "-"}
                              </span>
                            </div>
                          </td>

                          <td className="text-center">
                            <span
                              className={`rr-status-pill ${getStatusClass(
                                row.registrationStatus
                              )}`}
                            >
                              <Icon
                                icon={getStatusIcon(row.registrationStatus)}
                              />
                              {row.registrationStatus || "-"}
                            </span>
                          </td>

                          <td>
                            <div className="fw-semibold">
                              {formatDateTime(row.createdAt)}
                            </div>
                          </td>

                          <td className="text-center">
                            <select
                              className="form-select form-select-sm rr-action-select mx-auto"
                              value={row.registrationStatus || ""}
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
                              className="btn btn-sm btn-outline-danger rr-delete-btn d-inline-flex align-items-center justify-content-center gap-1"
                              onClick={() => handleSoftDelete(row)}
                              disabled={isBusy}
                              title="Delete Request"
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

            <div className="rr-footer d-flex flex-wrap justify-content-between align-items-center gap-2">
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

export default RegistrationRequestsLayer;