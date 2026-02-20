import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { getToken } from "../api/getToken";

const API_GET_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_lookup_data";

const API_DELETE_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=delete_dynamic";

const BASE_HEADERS = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

const InvoiceListLayer = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // UI
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // ✅ only 1 sort button (Issue Date)
  const [sortDir, setSortDir] = useState("desc"); // desc newest first

  // ✅ delete loading per row
  const [deletingId, setDeletingId] = useState(null);

  // pagination config (hidden)
  const perPage = 10;

  const fmtAmount = (currency, total) => {
    const n = Number(total) || 0;
    return `${currency || ""} ${n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`.trim();
  };

  const fmtDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const toTime = (iso) => {
    const d = new Date(iso);
    const t = d.getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  const getAuthToken = async () => {
    const t = await getToken();
    const token = typeof t === "string" ? t : t?.token;
    if (!token) throw new Error("Token not found");
    return token;
  };

  const postJson = async (url, headers, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json?.message || "API Error");
    }
    if (json?.statusCode !== 200) {
      throw new Error(json?.message || "Request failed");
    }
    return json;
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setErr("");

      const token = await getAuthToken();

      const headers = {
        ...BASE_HEADERS,
        ...(token ? { token } : {}),
      };

      const json = await postJson(API_GET_URL, headers, {
        token,
        tablename: "invoices",
      });

      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      setErr(e?.message || "Something went wrong");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteInvoice = async (row) => {
    const id = row?.id;
    if (!id) throw new Error("Invoice ID missing");

    const token = await getAuthToken();

    const headers = {
      ...BASE_HEADERS,
      ...(token ? { token } : {}),
    };

    // ✅ API spec exactly
    const json = await postJson(API_DELETE_URL, headers, {
      token,
      tablename: "invoices",
      conditions: [{ id }],
    });

    return json; // { statusCode, message, data: { id } }
  };

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Search ONLY (Invoice / Name)
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const invoiceNo = String(r?.invoice_no || "").toLowerCase();
      const name = String(r?.client_name || "").toLowerCase();
      return invoiceNo.includes(s) || name.includes(s);
    });
  }, [rows, q]);

  // ✅ Sort ONLY by issue_date with toggle
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const ta = toTime(a?.issue_date);
      const tb = toTime(b?.issue_date);
      if (ta === tb) return 0;
      return ta > tb ? dir : -dir;
    });
  }, [filtered, sortDir]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(sorted.length / perPage));
  }, [sorted.length]);

  useEffect(() => {
    // reset page on filters
    setPage(1);
  }, [q, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return sorted.slice(start, start + perPage);
  }, [sorted, page]);

  const showingFrom = sorted.length === 0 ? 0 : (page - 1) * perPage + 1;
  const showingTo = Math.min(page * perPage, sorted.length);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  const handleDelete = async (row) => {
    try {
      const invoiceNo = row?.invoice_no || "";
      const id = row?.id;

      const result = await Swal.fire({
        icon: "warning",
        title: "Delete Invoice?",
        html: `Are you sure you want to delete <b>${invoiceNo || "this invoice"}</b>?<br/>This action cannot be undone.`,
        showCancelButton: true,
        confirmButtonText: "Yes, Delete",
        cancelButtonText: "Cancel",
        reverseButtons: true,
        focusCancel: true,
      });

      if (!result.isConfirmed) return;

      setDeletingId(id || "deleting");

      await deleteInvoice(row);

      await Swal.fire({
        icon: "success",
        title: "Deleted",
        text: invoiceNo ? `Invoice ${invoiceNo} deleted successfully.` : "Invoice deleted successfully.",
      });

      // ✅ refresh list (safe)
      await fetchInvoices();
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: e?.message || "Something went wrong",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
        {/* ✅ ONLY 2 filters */}
        <div className="d-flex flex-wrap align-items-center gap-3">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2"
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            title="Sort by Issue Date"
          >
            <Icon icon={sortDir === "desc" ? "mdi:sort-descending" : "mdi:sort-ascending"} />
            {sortDir === "desc" ? "Desc" : "Asc"}
          </button>

          <div className="icon-field">
            <input
              type="text"
              className="form-control form-control-sm w-auto"
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="icon">
              <Icon icon="ion:search-outline" />
            </span>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-3">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={fetchInvoices}
            disabled={loading}
            title="Refresh"
          >
            <Icon icon="mdi:refresh" className="me-6" />
            Refresh
          </button>

          <Link to="/invoice-add" className="btn btn-sm btn-primary-600">
            <i className="ri-add-line" /> Create Invoice
          </Link>
        </div>
      </div>

      <div className="card-body">
        {err ? <div className="alert alert-danger mb-16">{err}</div> : null}

        <table className="table bordered-table mb-0">
          <thead>
            <tr>
              <th scope="col">S.L</th>
              <th scope="col">Invoice</th>
              <th scope="col">Name</th>
              <th scope="col">Issued Date</th>
              <th scope="col">Amount</th>
              <th scope="col">Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-24">
                  Loading...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-24">
                  No invoices found.
                </td>
              </tr>
            ) : (
              paginated.map((r, idx) => {
                const sl = (page - 1) * perPage + idx + 1;
                const isDeleting = deletingId != null && (deletingId === r?.id || deletingId === "deleting");

                return (
                  <tr key={r.id || `${r.invoice_no}-${idx}`}>
                    <td>{String(sl).padStart(2, "0")}</td>

                    <td>
                      <Link
                        to="/invoice-preview"
                        state={{ invoice: r }}
                        className="text-primary-600"
                        title="Open invoice"
                      >
                        {r.invoice_no || "-"}
                      </Link>
                    </td>

                    <td>{r.client_name || "-"}</td>

                    <td>{fmtDate(r.issue_date)}</td>

                    <td>{fmtAmount(r.currency, r.total)}</td>

                    <td>
                      <Link
                        to="/invoice-preview"
                        state={{ invoice: r }}
                        className="w-32-px h-32-px me-8 bg-primary-light text-primary-600 rounded-circle d-inline-flex align-items-center justify-content-center"
                        title="Preview"
                      >
                        <Icon icon="iconamoon:eye-light" />
                      </Link>

                      <Link
                        to="/invoice-edit"
                        state={{ invoice: r }}
                        className="w-32-px h-32-px me-8 bg-success-focus text-success-main rounded-circle d-inline-flex align-items-center justify-content-center"
                        title="Edit"
                      >
                        <Icon icon="lucide:edit" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        disabled={isDeleting}
                        className="w-32-px h-32-px me-8 bg-danger-focus text-danger-main rounded-circle d-inline-flex align-items-center justify-content-center border-0"
                        title={isDeleting ? "Deleting..." : "Delete"}
                      >
                        <Icon icon={isDeleting ? "mdi:loading" : "mingcute:delete-2-line"} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-24">
          <span>
            Showing {showingFrom} to {showingTo} of {sorted.length} entries
          </span>

          <ul className="pagination d-flex flex-wrap align-items-center gap-2 justify-content-center mb-0">
            <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
              <button
                className="page-link text-secondary-light fw-medium radius-4 border-0 px-10 py-10 d-flex align-items-center justify-content-center h-32-px me-8 w-32-px bg-base"
                onClick={goPrev}
                type="button"
              >
                <Icon icon="ep:d-arrow-left" className="text-xl" />
              </button>
            </li>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, page - 2), Math.max(0, page - 2) + 3)
              .map((p) => (
                <li key={p} className="page-item">
                  <button
                    type="button"
                    onClick={() => setPage(p)}
                    className={`page-link fw-medium radius-4 border-0 px-10 py-10 d-flex align-items-center justify-content-center h-32-px me-8 w-32-px ${
                      p === page ? "bg-primary-600 text-white" : "bg-primary-50 text-secondary-light"
                    }`}
                  >
                    {p}
                  </button>
                </li>
              ))}

            <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
              <button
                className="page-link text-secondary-light fw-medium radius-4 border-0 px-10 py-10 d-flex align-items-center justify-content-center h-32-px me-8 w-32-px bg-base"
                onClick={goNext}
                type="button"
              >
                <Icon icon="ep:d-arrow-right" className="text-xl" />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InvoiceListLayer;
