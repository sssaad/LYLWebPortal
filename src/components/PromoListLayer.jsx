import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { getToken } from "../api/getToken";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
// ✅ Alternative (agar default import issue de):
// import { jsPDF } from "jspdf";
// import autoTable from "jspdf-autotable";

const API_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_lookup_data";

const ADD_API_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=add_dynamic_data";

const UPDATE_API_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

const PromoListLayer = () => {
  // ======================
  // API state
  // ======================
  const [promos, setPromos] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ======================
  // Form state
  // ======================
  const [promoId, setPromoId] = useState("");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [type, setType] = useState("direct"); // direct | block
  const [isActive, setIsActive] = useState(true);
  const [oneTime, setOneTime] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [usageLimitTotal, setUsageLimitTotal] = useState("");
  const [usageLimitPerUser, setUsageLimitPerUser] = useState("");

  const isUpdateMode = Boolean(String(promoId || "").trim());

  // ======================
  // Table filters
  // ======================
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | direct | block
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive

  // Paging
  const [page, setPage] = useState(1);
  const perPage = 10;

  // ======================
  // Helpers
  // ======================
  const toast = (msg) => {
    // eslint-disable-next-line no-alert
    alert(msg);
  };

  const resetForm = () => {
    setPromoId("");
    setTitle("");
    setCode("");
    setDiscountPercent("");
    setType("direct");
    setIsActive(true);
    setOneTime(false);
    setStartDate("");
    setExpiryDate("");
    setUsageLimitTotal("");
    setUsageLimitPerUser("");
  };

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  // "YYYY-MM-DD HH:mm:ss" -> Date
  const parseApiDate = (s) => {
    if (!s) return null;
    const str = String(s).trim();
    if (!str) return null;
    const isoish = str.includes(" ") ? str.replace(" ", "T") : str;
    const d = new Date(isoish);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  };

  // API datetime -> input datetime-local ("YYYY-MM-DDTHH:mm")
  const apiToDateTimeLocal = (s) => {
    if (!s) return "";
    const str = String(s).trim();
    if (!str) return "";
    const isoish = str.includes(" ") ? str.replace(" ", "T") : str;
    return isoish.slice(0, 16);
  };

  // "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DD HH:mm:ss"
  const dateTimeLocalToApi = (v) => {
    if (!v) return "";
    const s = String(v).trim();
    if (!s) return "";
    const withSpace = s.replace("T", " ");
    return withSpace.length === 16 ? `${withSpace}:00` : withSpace;
  };

  // NOW -> "YYYY-MM-DD HH:mm:ss" (local time)
  const nowApiDateTime = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  };

  const fmtDateShort = (apiOrIso) => {
    const d = parseApiDate(apiOrIso);
    if (!d) return "—";
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  };

  const fmtWindow = (s, e) => {
    if (!s || !e) return "—";
    return `${fmtDateShort(s)} → ${fmtDateShort(e)}`;
  };

  const pillTypeClass = (t) => (t === "direct" ? "bg-primary" : "bg-warning");
  const pillStatusClass = (a) => (a ? "bg-success" : "bg-danger");

  // build create/update row payload (shared mapping)
  const buildPromoRowPayload = () => {
    const cleanCode = code.trim().toUpperCase();

    return {
      title: title.trim(),
      code: cleanCode,

      is_active: isActive ? 1 : 0,
      start_date: dateTimeLocalToApi(startDate),
      expiry_date: dateTimeLocalToApi(expiryDate),

      discount_percent: Number(discountPercent),

      applies_direct: type === "direct" ? 1 : 0,
      applies_block: type === "block" ? 1 : 0,
      applies_subscription: 0,

      one_time: oneTime ? 1 : 0,

      usage_limit_total:
        String(usageLimitTotal).trim() === "" ? 0 : Number(usageLimitTotal),
      usage_limit_per_user:
        String(usageLimitPerUser).trim() === "" ? 0 : Number(usageLimitPerUser),

      created_by: 1,

      updated_at: nowApiDateTime(),
    };
  };

  const showUpdatedAlert = async (idNum, promoCode) => {
    await Swal.fire({
      icon: "success",
      title: "Promo Updated",
      html: `<div style="font-size:14px">Promo <b>#${idNum}</b> (${promoCode}) updated successfully.</div>`,
      confirmButtonText: "OK",
    });
  };

  const showCreatedAlert = async (newId, promoCode) => {
    await Swal.fire({
      icon: "success",
      title: "Promo Created",
      html: `<div style="font-size:14px">Promo ${
        newId ? `<b>#${newId}</b> ` : ""
      }(${promoCode}) created successfully.</div>`,
      confirmButtonText: "OK",
    });
  };

  const showErrorAlert = async (msg) => {
    await Swal.fire({
      icon: "error",
      title: "Error",
      text: msg || "Something went wrong.",
      confirmButtonText: "OK",
    });
  };

  // ======================
  // FETCH LIST (AXIOS)
  // ======================
  const fetchPromoCodes = async () => {
    try {
      setLoadingList(true);
      setError("");

      const token = await getToken();
      if (!token) {
        setPromos([]);
        setError("Token missing");
        return;
      }

      const payload = {
        token,
        tablename: "promo_codes",
      };

      const res = await axios.post(API_URL, payload, {
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      });

      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];

      const mapped = rows.map((x) => {
        const appliesDirect = String(x?.applies_direct || "0") === "1";
        const appliesBlock = String(x?.applies_block || "0") === "1";

        return {
          raw: x,

          id: Number(x?.id),
          title: x?.title || "",
          code: x?.code || "",
          discount_percent: Number(x?.discount_percent || 0),

          type: appliesDirect ? "direct" : appliesBlock ? "block" : "direct",

          is_active: String(x?.is_active || "0") === "1",
          one_time: String(x?.one_time || "0") === "1",

          start_date: x?.start_date || "",
          expiry_date: x?.expiry_date || "",

          usage_limit_total:
            x?.usage_limit_total === null || x?.usage_limit_total === undefined
              ? ""
              : String(x.usage_limit_total),

          usage_limit_per_user:
            x?.usage_limit_per_user === null ||
            x?.usage_limit_per_user === undefined
              ? ""
              : String(x.usage_limit_per_user),
        };
      });

      setPromos(mapped);
      setPage(1);
    } catch (err) {
      setPromos([]);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Internal API error (promo_codes list)"
      );
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchPromoCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======================
  // Preview
  // ======================
  const preview = useMemo(() => {
    const t = title.trim() || "—";
    const c = code.trim() ? `CODE: ${code.trim().toUpperCase()}` : "CODE: —";
    const disc = discountPercent ? `${discountPercent}% OFF` : "0% OFF";

    const win =
      startDate && expiryDate
        ? `${new Date(startDate).toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })} → ${new Date(expiryDate).toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}`
        : "—";

    return {
      title: t,
      code: c,
      disc,
      win,
      total: usageLimitTotal !== "" ? usageLimitTotal : "—",
      perUser: usageLimitPerUser !== "" ? usageLimitPerUser : "—",
    };
  }, [
    title,
    code,
    discountPercent,
    startDate,
    expiryDate,
    usageLimitTotal,
    usageLimitPerUser,
  ]);

  // ======================
  // Save / Edit
  // ======================
  const onSave = async (e) => {
    e.preventDefault();

    if (!title.trim() || !code.trim() || !String(discountPercent).trim()) {
      toast("Title, Code, and Discount are required.");
      return;
    }
    if (!startDate || !expiryDate) {
      toast("Start Date and Expiry Date are required.");
      return;
    }

    const sd = new Date(startDate);
    const ed = new Date(expiryDate);
    if (!Number.isNaN(sd.getTime()) && !Number.isNaN(ed.getTime()) && ed <= sd) {
      toast("Expiry Date must be after Start Date.");
      return;
    }

    // UPDATE
    if (isUpdateMode) {
      const idNum = Number(String(promoId).trim());
      if (!idNum || Number.isNaN(idNum)) {
        toast("Invalid Promo ID for update.");
        return;
      }

      try {
        setSaving(true);

        const token = await getToken();
        if (!token) {
          toast("Token missing");
          return;
        }

        const row = buildPromoRowPayload();

        const apiPayload = {
          token,
          tablename: "promo_codes",
          conditions: [{ id: idNum }],
          updatedata: [row],
        };

        const res = await axios.post(UPDATE_API_URL, apiPayload, {
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        });

        if (res?.data?.statusCode === 200) {
          await showUpdatedAlert(idNum, row.code);
          resetForm();
          await fetchPromoCodes();
          return;
        }

        await showErrorAlert(res?.data?.message || "Update failed.");
      } catch (err) {
        await showErrorAlert(
          err?.response?.data?.message ||
            err?.message ||
            "Internal API error (update_dynamic_data)"
        );
      } finally {
        setSaving(false);
      }

      return;
    }

    // CREATE
    try {
      setSaving(true);

      const token = await getToken();
      if (!token) {
        toast("Token missing");
        return;
      }

      const row = buildPromoRowPayload();

      const apiPayload = {
        token,
        tablename: "promo_codes",
        ...row,
      };

      const res = await axios.post(ADD_API_URL, apiPayload, {
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      });

      if (res?.data?.statusCode === 200) {
        const newId = res?.data?.data?.id;
        await showCreatedAlert(newId, row.code);
        resetForm();
        await fetchPromoCodes();
        return;
      }

      await showErrorAlert(res?.data?.message || "Create failed.");
    } catch (err) {
      await showErrorAlert(
        err?.response?.data?.message ||
          err?.message ||
          "Internal API error (add_dynamic_data)"
      );
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (p) => {
    setPromoId(String(p.id || ""));
    setTitle(p.title || "");
    setCode(p.code || "");
    setDiscountPercent(String(p.discount_percent ?? ""));
    setType(p.type || "direct");
    setIsActive(Boolean(p.is_active));
    setOneTime(Boolean(p.one_time));

    setStartDate(apiToDateTimeLocal(p.start_date));
    setExpiryDate(apiToDateTimeLocal(p.expiry_date));

    setUsageLimitTotal(p.usage_limit_total ?? "");
    setUsageLimitPerUser(p.usage_limit_per_user ?? "");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ======================
  // Filtering
  // ======================
  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();

    return promos.filter((p) => {
      const matchQ =
        !q ||
        String(p.title || "").toLowerCase().includes(q) ||
        String(p.code || "").toLowerCase().includes(q);

      const matchType = typeFilter === "all" || p.type === typeFilter;

      const active = Boolean(p.is_active);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && active) ||
        (statusFilter === "inactive" && !active);

      return matchQ && matchType && matchStatus;
    });
  }, [promos, search, typeFilter, statusFilter]);

  // Paging
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * perPage;
  const pageItems = filtered.slice(startIdx, startIdx + perPage);

  // ======================
  // EXPORTS (Excel / PDF)
  // ======================
  const buildExportRows = (rows) =>
    (rows || []).map((p) => ({
      ID: p.id,
      Title: p.title || "",
      Code: (p.code || "").toUpperCase(),
      Type: p.type === "direct" ? "DIRECT" : "BLOCK",
      "Discount (%)": Number(p.discount_percent || 0),
      "Start Date": p.start_date || "",
      "Expiry Date": p.expiry_date || "",
      Window: fmtWindow(p.start_date, p.expiry_date),
      Status: p.is_active ? "ACTIVE" : "INACTIVE",
      "One Time": p.one_time ? "YES" : "NO",
      "Usage Limit (Total)":
        p.usage_limit_total === "" ? "—" : p.usage_limit_total,
      "Usage Limit (Per User)":
        p.usage_limit_per_user === "" ? "—" : p.usage_limit_per_user,
    }));

  const exportToExcel = () => {
    try {
      const rows = buildExportRows(filtered); // ✅ exports FILTERED list
      if (!rows.length) return toast("No records to export.");

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Promo Codes");

      const fileName = `promo_codes_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      XLSX.writeFile(wb, fileName);
    } catch (e) {
      toast(e?.message || "Excel export failed");
    }
  };

  const exportToPDF = () => {
    try {
      const rows = buildExportRows(filtered); // ✅ exports FILTERED list
      if (!rows.length) return toast("No records to export.");

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      doc.setFontSize(14);
      doc.text("Promo Codes", 40, 40);

      doc.setFontSize(10);
      doc.text(`Exported: ${new Date().toLocaleString()}`, 40, 60);

      const head = [Object.keys(rows[0])];
      const body = rows.map((r) => Object.values(r));

      autoTable(doc, {
        startY: 80,
        head,
        body,
        styles: {
          fontSize: 8,
          cellPadding: 4,
          overflow: "linebreak",
        },
        headStyles: {
          fontSize: 8,
        },
        margin: { left: 40, right: 40 },
      });

      const fileName = `promo_codes_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;

      doc.save(fileName);
    } catch (e) {
      toast(e?.message || "PDF export failed");
    }
  };

  return (
    <div className="card h-100 p-0 radius-12">
      <style>{`
        .wowToggle {
          position: relative;
          width: 54px;
          height: 30px;
          flex: 0 0 auto;
        }
        .wowToggle input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
          pointer-events: none;
        }
        .wowSlider {
          position: absolute;
          inset: 0;
          cursor: pointer;
          border-radius: 999px;
          background: rgba(255,255,255,0.16);
          border: 1px solid rgba(255,255,255,0.28);
          transition: 0.18s ease;
        }
        .wowSlider::before {
          content: "";
          position: absolute;
          width: 22px;
          height: 22px;
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
          border-radius: 999px;
          background: rgba(255,255,255,0.85);
          box-shadow: 0 10px 18px rgba(0,0,0,0.35);
          transition: 0.18s ease;
        }
        .wowToggle input:checked + .wowSlider {
          background: rgba(34,197,94,0.28);
          border-color: rgba(34,197,94,0.35);
        }
        .wowToggle input:checked + .wowSlider::before {
          left: 28px;
          background: rgba(255,255,255,0.92);
        }
        .wowToggle input:focus-visible + .wowSlider {
          box-shadow: 0 0 0 3px rgba(59,130,246,0.25);
        }
      `}</style>

      {/* Header */}
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-start flex-wrap gap-3 justify-content-between">
        <div>
          <h5 className="mb-1">Promo Codes</h5>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={resetForm}
            disabled={saving}
          >
            Reset Form
          </button>

          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={fetchPromoCodes}
            disabled={loadingList || saving}
          >
            {loadingList ? "Refreshing..." : "Refresh List"}
          </button>
        </div>
      </div>

      <div className="card-body p-24">
        {error ? <div className="alert alert-danger mb-3">{error}</div> : null}

        {/* Form + Preview */}
        <div className="row g-3 mb-3">
          {/* Form */}
          <div className="col-12 col-xl-7">
            <div className="card radius-12 h-100">
              <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center justify-content-between gap-2">
                <div>
                  <div className="fw-bold">
                    {isUpdateMode ? "UPDATE PROMO" : "CREATE PROMO"}
                  </div>
                  <div className="text-sm text-secondary">
                    {isUpdateMode
                      ? "Update an existing promo."
                      : "Create separate promos for Direct vs Block bookings."}
                  </div>
                </div>

                <span
                  className={`badge rounded-pill ${
                    isUpdateMode ? "bg-warning" : "bg-primary"
                  }`}
                >
                  {isUpdateMode ? "UPDATE MODE" : "CREATE MODE"}
                </span>
              </div>

              <div className="card-body p-24">
                <form onSubmit={onSave}>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Title</label>
                      <input
                        className="form-control"
                        placeholder="e.g., Save Upto 10%"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        disabled={saving}
                      />
                      <div className="text-sm text-secondary mt-1">
                        Internal title for admin (optional to show to users).
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Promo Code</label>
                      <input
                        className="form-control"
                        placeholder="e.g., SAV10"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                        disabled={saving}
                      />
                      <div className="text-sm text-secondary mt-1">
                        Uppercase recommended. Must be unique.
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Discount (%)</label>
                      <input
                        className="form-control"
                        type="number"
                        min="1"
                        max="100"
                        step="0.01"
                        placeholder="10"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(e.target.value)}
                        required
                        disabled={saving}
                      />
                      <div className="text-sm text-secondary mt-1">
                        Percentage discount (1–100).
                      </div>
                    </div>

                    {/* Status */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">Status</label>
                      <div className="d-flex align-items-center justify-content-between border rounded px-3 py-2">
                        <div>
                          <div className="fw-bold">
                            {isActive ? "Active" : "Inactive"}
                          </div>
                          <div className="text-sm text-secondary">
                            Promo live / usable
                          </div>
                        </div>

                        <div className="wowToggle">
                          <input
                            id="promo-active-switch"
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            aria-label="Toggle promo active"
                            disabled={saving}
                          />
                          <label
                            className="wowSlider"
                            htmlFor="promo-active-switch"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ✅ DIRECT = BLUE, BLOCK = YELLOW */}
                    <div className="col-12">
                      <label className="form-label">
                        Applies To (Direct vs Block)
                      </label>

                      <div className="btn-group w-100" role="group">
                        <button
                          type="button"
                          className={`btn btn-sm ${
                            type === "direct"
                              ? "btn-primary"
                              : "btn-outline-primary"
                          }`}
                          onClick={() => setType("direct")}
                          disabled={saving}
                        >
                          Direct Booking
                        </button>

                        <button
                          type="button"
                          className={`btn btn-sm ${
                            type === "block"
                              ? "btn-warning"
                              : "btn-outline-warning"
                          }`}
                          onClick={() => setType("block")}
                          disabled={saving}
                        >
                          Block Booking
                        </button>
                      </div>

                      <div className="text-sm text-secondary mt-1">
                        Backend rule (set exactly one):{" "}
                        <code>applies_direct=1, applies_block=0</code> OR{" "}
                        <code>applies_direct=0, applies_block=1</code>.
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Start Date</label>
                      <input
                        className="form-control"
                        type="datetime-local"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        disabled={saving}
                      />
                      <div className="text-sm text-secondary mt-1">
                        Promo active window start.
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Expiry Date</label>
                      <input
                        className="form-control"
                        type="datetime-local"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        required
                        disabled={saving}
                      />
                      <div className="text-sm text-secondary mt-1">
                        Promo active window end.
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Usage Limit (Total)</label>
                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="10"
                        value={usageLimitTotal}
                        onChange={(e) => setUsageLimitTotal(e.target.value)}
                        disabled={saving}
                      />
                      <div className="text-sm text-secondary mt-1">
                        Blank/0 = unlimited
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">
                        Usage Limit (Per User)
                      </label>
                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="1"
                        value={usageLimitPerUser}
                        onChange={(e) => setUsageLimitPerUser(e.target.value)}
                        disabled={saving}
                      />
                      <div className="text-sm text-secondary mt-1">
                        Max redemptions per user.
                      </div>
                    </div>

                    {/* One Time */}
                    <div className="col-12">
                      <div className="d-flex align-items-center justify-content-between border rounded px-3 py-2">
                        <div>
                          <div className="fw-bold">One Time</div>
                          <div className="text-sm text-secondary">
                            If enabled, behaves like single-use.
                          </div>
                        </div>

                        <div className="wowToggle">
                          <input
                            id="promo-onetime-switch"
                            type="checkbox"
                            checked={oneTime}
                            onChange={(e) => setOneTime(e.target.checked)}
                            aria-label="Toggle one time"
                            disabled={saving}
                          />
                          <label
                            className="wowSlider"
                            htmlFor="promo-onetime-switch"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-12 d-flex gap-2 justify-content-end">
                      {isUpdateMode ? (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={resetForm}
                          disabled={saving}
                        >
                          Cancel Update
                        </button>
                      ) : null}

                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={saving}
                      >
                        {saving
                          ? "Saving..."
                          : isUpdateMode
                          ? "Update Promo"
                          : "Create Promo"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="col-12 col-xl-5">
            <div className="card radius-12 h-100">
              <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center justify-content-between">
                <div className="fw-bold">PREVIEW</div>
                <span
                  className={`badge rounded-pill ${pillStatusClass(isActive)}`}
                >
                  {isActive ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>

              <div className="card-body p-24">
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <span className={`badge rounded-pill ${pillTypeClass(type)}`}>
                    {type === "direct" ? "DIRECT" : "BLOCK"}
                  </span>
                  <span className="badge rounded-pill bg-warning">
                    {preview.disc}
                  </span>
                  <span
                    className={`badge rounded-pill ${
                      oneTime ? "bg-danger" : "bg-secondary"
                    }`}
                  >
                    ONE TIME: {oneTime ? "YES" : "NO"}
                  </span>
                </div>

                <div className="border rounded p-3">
                  <div className="d-flex align-items-start justify-content-between gap-3">
                    <div>
                      <div className="fw-bold">{preview.title}</div>
                      <div className="text-sm text-secondary mt-1">
                        <code>{preview.code}</code>
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-sm text-secondary fw-bold">
                        Valid Window
                      </div>
                      <div className="text-sm mt-1">{preview.win}</div>
                    </div>
                  </div>

                  <hr />

                  <div className="row g-2">
                    <div className="col-6">
                      <div className="text-sm text-secondary fw-bold">
                        Total Limit
                      </div>
                      <div className="fw-bold mt-1">{preview.total}</div>
                    </div>
                    <div className="col-6">
                      <div className="text-sm text-secondary fw-bold">
                        Per User
                      </div>
                      <div className="fw-bold mt-1">{preview.perUser}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card radius-12">
          <div className="card-header border-bottom bg-base py-16 px-24">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div
                className="d-flex align-items-center flex-wrap gap-2"
                style={{ flex: 1 }}
              >
                <input
                  className="form-control"
                  style={{ maxWidth: 260 }}
                  placeholder="Search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />

                <select
                  className="form-select"
                  style={{ maxWidth: 260 }}
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All Types</option>
                  <option value="direct">Direct</option>
                  <option value="block">Block</option>
                </select>

                <select
                  className="form-select"
                  style={{ maxWidth: 180 }}
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Status: All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>
              </div>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={exportToExcel}
                  disabled={loadingList || saving}
                >
                  Excel Export
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={exportToPDF}
                  disabled={loadingList || saving}
                >
                  PDF Export
                </button>
              </div>
            </div>
          </div>

          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table bordered-table sm-table mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>ID</th>
                    <th>Title</th>
                    <th>Code</th>
                    <th>Type</th>
                    <th className="text-end">Discount</th>
                    <th>Window</th>
                    <th>Status</th>
                    <th className="text-end">Total</th>
                    <th className="text-end">Per User</th>
                    <th style={{ width: 110 }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loadingList ? (
                    <tr>
                      <td colSpan={10} className="text-center">
                        <div className="py-4">Loading...</div>
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center">
                        <div className="py-4">
                          <div className="fw-bold">No records found.</div>
                          <div className="text-sm text-secondary">
                            Try clearing filters or search.
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((p) => {
                      const active = Boolean(p.is_active);
                      return (
                        <tr key={p.id}>
                          <td className="fw-bold">{p.id}</td>
                          <td>{p.title}</td>
                          <td>
                            <code>{p.code}</code>
                          </td>
                          <td>
                            <span
                              className={`badge rounded-pill ${pillTypeClass(
                                p.type
                              )}`}
                            >
                              {p.type === "direct" ? "DIRECT" : "BLOCK"}
                            </span>
                          </td>
                          <td className="text-end fw-bold">
                            {Number(p.discount_percent || 0)}%
                          </td>
                          <td className="text-secondary">
                            {fmtWindow(p.start_date, p.expiry_date)}
                          </td>
                          <td>
                            <span
                              className={`badge rounded-pill ${pillStatusClass(
                                active
                              )}`}
                            >
                              {active ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td className="text-end">
                            {p.usage_limit_total === ""
                              ? "—"
                              : p.usage_limit_total}
                          </td>
                          <td className="text-end">
                            {p.usage_limit_per_user === ""
                              ? "—"
                              : p.usage_limit_per_user}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => onEdit(p)}
                              disabled={saving}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 px-24 py-16 border-top">
              <div className="text-secondary">
                Showing {filtered.length === 0 ? 0 : startIdx + 1} to{" "}
                {Math.min(startIdx + perPage, filtered.length)} of{" "}
                {filtered.length} entries
              </div>

              <ul className="pagination mb-0">
                {Array.from({ length: totalPages })
                  .slice(0, 8)
                  .map((_, i) => {
                    const pnum = i + 1;
                    return (
                      <li
                        key={pnum}
                        className={`page-item ${
                          safePage === pnum ? "active" : ""
                        }`}
                      >
                        <button
                          className="page-link"
                          onClick={() => setPage(pnum)}
                          type="button"
                        >
                          {pnum}
                        </button>
                      </li>
                    );
                  })}
                {totalPages > 8 ? (
                  <li className="page-item disabled">
                    <span className="page-link">…</span>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoListLayer;
