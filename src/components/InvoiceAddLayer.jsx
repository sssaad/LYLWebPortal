import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import Swal from "sweetalert2";
import { getToken } from "../api/getToken";

const API_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const BASE_HEADERS = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
  // token dynamic add hoga (headers only)
};

// ===== Status Mapping =====
const UI_STATUS = {
  UNPAID: "Unpaid",
  PAID: "Paid",
};

const API_STATUS = {
  [UI_STATUS.UNPAID]: "pending",
  [UI_STATUS.PAID]: "paid",
};

const getApiStatus = (uiStatus) => API_STATUS[uiStatus] || "pending";

// ===== Helpers =====
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const toYYYYMMDD = (input) => {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const mapInvoiceItems = (items) =>
  (items || []).map((it, idx) => {
    const rate = round2(it?.rate);
    const qty = round2(it?.qty);
    const line_total = round2(rate * qty);

    return {
      description: (it?.description || "").trim(),
      rate,
      qty,
      line_total,
      sort_order: idx + 1,
    };
  });

const pad4 = (n) => String(n).padStart(4, "0");

const nextSuffix = (suffix) => {
  const num = parseInt(String(suffix || "").replace(/\D/g, ""), 10);
  const next = Number.isFinite(num) ? num + 1 : 1;
  return pad4(next);
};

const DUMMY_CLIENT = {
  name: "",
  phone: "",
  email: "",
  address: "",
};

const DUMMY_ITEMS = [{ description: "", rate: 250, qty: 1 }];

const InvoiceAddLayer = () => {
  // ========= Preview/Edit like CSS =========
  const css = `
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap");

  .gs-invoice{
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    color:#eaf2ff;
  }
  .gs-invoice *{ box-sizing:border-box; }

  .gs-invoice .sheet{
    width:100%;
    display:flex;
    justify-content:center;
    padding:0;
  }

  .gs-invoice .page{
    width: 792px;
    min-height: 1122px;
    border-radius: 26px;
    overflow:hidden;
    position:relative;
    isolation:isolate;
    display:flex;
    flex-direction:column;

    border:1px solid rgba(255,255,255,.08);
    box-shadow: 0 30px 80px rgba(0,0,0,.55);

    background:
      radial-gradient(1200px 650px at 15% -10%, rgba(31,139,255,.35), transparent 60%),
      radial-gradient(900px 600px at 80% 20%, rgba(15,177,255,.22), transparent 55%),
      radial-gradient(1000px 700px at 50% 120%, rgba(31,139,255,.18), transparent 60%),
      linear-gradient(140deg, #071122, #0b1c36 55%, #0a2243);
  }

  .gs-invoice .page::before{
    content:"";
    position:absolute; inset:-2px;
    background:
      radial-gradient(900px 300px at 20% 0%, rgba(31,139,255,.28), transparent 60%),
      radial-gradient(700px 350px at 80% 0%, rgba(15,177,255,.22), transparent 55%),
      radial-gradient(650px 350px at 45% 55%, rgba(255,255,255,.06), transparent 60%);
    pointer-events:none;
    z-index:0;
  }
  .gs-invoice .page::after{
    content:"";
    position:absolute; inset:0;
    background:
      linear-gradient(180deg, rgba(255,255,255,.05), transparent 30%),
      linear-gradient(0deg, rgba(0,0,0,.20), transparent 35%);
    pointer-events:none;
    z-index:0;
  }
  .gs-invoice .page > *{
    position:relative;
    z-index:1;
  }

  .gs-invoice .top{
    position:relative;
    padding:28px 34px 20px;
    background: linear-gradient(135deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
    border-bottom:1px solid rgba(255,255,255,.06);
    overflow:hidden;
  }

  .gs-invoice .top .wave-left{
    position:absolute; left:-120px; top:-140px;
    width:520px; height:360px;
    background: radial-gradient(circle at 35% 40%, rgba(31,139,255,.55), rgba(31,139,255,.12) 55%, transparent 70%);
    border-radius:50%;
    transform: rotate(-8deg);
    opacity:.9;
    z-index:0;
  }
  .gs-invoice .top .wave-mid{
    position:absolute; left:220px; top:-220px;
    width:680px; height:480px;
    background: radial-gradient(circle at 45% 65%, rgba(255,255,255,.08), rgba(255,255,255,.03) 55%, transparent 70%);
    border-radius:50%;
    transform: rotate(12deg);
    z-index:0;
    opacity:.85;
  }
  .gs-invoice .top .wave-right{
    position:absolute; right:-160px; top:-150px;
    width:520px; height:380px;
    background: radial-gradient(circle at 55% 45%, rgba(15,177,255,.42), rgba(15,177,255,.10) 56%, transparent 72%);
    border-radius:50%;
    transform: rotate(12deg);
    z-index:0;
    opacity:.85;
  }

  .gs-invoice .topbar{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:18px;
    position:relative;
    z-index:1;
  }

  .gs-invoice .brand{
    display:flex;
    align-items:center;
    gap:12px;
    min-width:220px;
  }

  .gs-invoice .brand-wordmark{
    height:50px;
    width:auto;
    object-fit:contain;
    display:block;
    filter: drop-shadow(0 6px 14px rgba(0,0,0,.25));
  }

  .gs-invoice .invoice-pill{
    background: linear-gradient(90deg, rgba(31,139,255,1), rgba(15,177,255,.9));
    color:#eaf6ff;
    font-weight:900;
    letter-spacing:1.2px;
    padding:14px 26px;
    border-radius:999px;
    box-shadow: 0 22px 44px rgba(31,139,255,.25);
    border:1px solid rgba(255,255,255,.18);
    font-size:22px;
    text-transform:uppercase;
    white-space:nowrap;
  }

  .gs-invoice .meta{
    display:grid;
    grid-template-columns: 1.4fr .9fr;
    gap:26px;
    padding:18px 34px 24px;
  }
  .gs-invoice .block-title{
    font-size:14px;
    color:rgba(31,139,255,.95);
    font-weight:800;
    letter-spacing:.2px;
    margin-bottom:10px;
  }
  .gs-invoice .to-name{
    font-size:26px;
    font-weight:900;
    margin:0 0 12px;
    letter-spacing:.2px;
    line-height:1.05;
  }
  .gs-invoice .kv{
    display:grid;
    grid-template-columns: 86px 1fr;
    gap:10px 16px;
    font-size:13px;
    color:#a9bbd7;
  }
  .gs-invoice .kv b{ color:rgba(255,255,255,.92); font-weight:800; }

  .gs-invoice .meta-right{
    display:flex;
    justify-content:flex-end;
    align-items:flex-start;
  }
  .gs-invoice .meta-card{
    width:100%;
    max-width:320px;
    border:1px solid rgba(255,255,255,.10);
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.02));
    padding:14px 16px;
    box-shadow: 0 16px 40px rgba(0,0,0,.35);
  }
  .gs-invoice .meta-card .kv{
    grid-template-columns: 90px 1fr;
    gap:10px 12px;
  }

  .gs-invoice .table-wrap{
    padding: 0 34px 22px;
  }
  .gs-invoice table{
    width:100%;
    border-collapse:separate;
    border-spacing:0;
    overflow:hidden;
    border-radius: 14px;
    border:1px solid rgba(255,255,255,.10);
    background: rgba(0,0,0,.12);
  }
  .gs-invoice thead th{
    background: linear-gradient(90deg, rgba(31,139,255,.95), rgba(15,177,255,.85));
    color: rgba(255,255,255,.96);
    text-align:left;
    padding:14px 14px;
    font-size:13px;
    font-weight:900;
    letter-spacing:.2px;
    border-right:1px solid rgba(255,255,255,.16);
    white-space:nowrap;
  }
  .gs-invoice thead th:last-child{border-right:none;}
  .gs-invoice thead th small{opacity:.9; font-weight:800;}

  .gs-invoice tbody td{
    padding:14px 14px;
    border-top:1px solid rgba(255,255,255,.08);
    border-right:1px solid rgba(255,255,255,.06);
    font-size:13px;
    color:rgba(255,255,255,.88);
    background: rgba(255,255,255,.02);
    vertical-align:middle;
  }
  .gs-invoice tbody td:last-child{border-right:none;}

  .gs-invoice .col-no{width:60px; text-align:center; color:rgba(255,255,255,.75); font-weight:900;}
  .gs-invoice .col-desc{width:44%;}
  .gs-invoice .col-rate,.gs-invoice .col-qty,.gs-invoice .col-amt{
    width:18%;
    text-align:right;
    font-variant-numeric: tabular-nums;
  }
  .gs-invoice .col-act{width:90px; text-align:center;}

  .gs-invoice .bottom{
    display:grid;
    grid-template-columns: 1.25fr .75fr;
    gap:26px;
    padding: 8px 34px 18px;
    margin-top:auto;
  }
  .gs-invoice .section-title{
    font-size:18px;
    font-weight:900;
    font-style:italic;
    letter-spacing:.2px;
    color:rgba(31,139,255,.95);
    margin:10px 0 12px;
  }
  .gs-invoice .account{
    border-radius: 18px;
    border:1px solid rgba(255,255,255,.10);
    background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015));
    padding:14px 16px 16px;
    box-shadow: 0 16px 40px rgba(0,0,0,.35);
  }
  .gs-invoice .account .kv{
    grid-template-columns: 120px 1fr;
    font-size:12.5px;
    gap:10px 14px;
  }

  .gs-invoice .gs-static{
    width:100%;
    padding:2px 0;
    color: rgba(255,255,255,.92);
    font: inherit;
    background: transparent;
    user-select: text;
    overflow-wrap: anywhere;
    line-height:1.35;
  }

  .gs-invoice .summary{
    display:flex;
    flex-direction:column;
    gap:12px;
    align-items:stretch;
  }
  .gs-invoice .sum-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:12px 14px;
    border-radius: 14px;
    border:1px solid rgba(255,255,255,.10);
    background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015));
    box-shadow: 0 16px 40px rgba(0,0,0,.35);
    font-variant-numeric: tabular-nums;
  }
  .gs-invoice .sum-row b{font-size:14px; font-weight:900;}
  .gs-invoice .sum-row .amount{font-weight:900; letter-spacing:.2px}

  .gs-invoice .due{
    background: linear-gradient(90deg, rgba(31,139,255,.95), rgba(15,177,255,.85));
    border:1px solid rgba(255,255,255,.16);
    color:#fff;
    box-shadow: 0 24px 52px rgba(31,139,255,.25);
  }

  .gs-invoice .signature{
    margin-top:auto;
    text-align:right;
    padding-top:22px;
    color:rgba(255,255,255,.22);
    font-weight:900;
    font-style:italic;
    letter-spacing:.2px;
    position:relative;
  }
  .gs-invoice .signature::before{
    content:"";
    position:absolute;
    right:0;
    top:10px;
    width:220px;
    height:1px;
    background: rgba(255,255,255,.18);
  }

  .gs-invoice .footer{
    padding: 22px 34px 26px;
    border-top:1px solid rgba(255,255,255,.06);
    background: linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.18));
    position:relative;
    overflow:hidden;
    margin-top:0;
  }

  .gs-invoice .footer::before{
    content:"";
    position:absolute;
    left:-160px; bottom:-220px;
    width:720px; height:520px;
    background: radial-gradient(circle at 40% 40%, rgba(31,139,255,.25), transparent 60%);
    border-radius:50%;
    z-index:0;
  }

  .gs-invoice .footer-grid{
    display:grid;
    grid-template-columns: 1fr auto;
    gap:24px;
    align-items:center;
    position:relative;
    z-index:1;
  }

  .gs-invoice .footer-brand .big{
    font-size:34px;
    font-weight:900;
    letter-spacing:.2px;
  }
  .gs-invoice .footer-brand .sub{
    margin-top:-6px;
    font-size:14px;
    color:rgba(255,255,255,.85);
    font-weight:800;
    opacity:.95;
  }

  .gs-invoice .contacts{
    display:flex;
    flex-wrap:wrap;
    justify-content:flex-end;
    align-items:center;
    gap:12px 22px;
    color:rgba(255,255,255,.88);
    font-size:12.5px;
  }

  .gs-invoice .contact{
    display:flex;
    gap:10px;
    align-items:center;
    justify-content:flex-end;
    width:auto;
    white-space:nowrap;
  }

  .gs-invoice .contact.wide{
    flex-basis:100%;
    white-space:normal;
  }

  .gs-invoice .ico{
    width:30px;
    height:30px;
    border-radius:999px;
    display:grid;
    place-items:center;
    background: rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.14);
    color: rgba(255,255,255,.92);
    flex:0 0 auto;
  }
  .gs-invoice .ico .ic{
    width:16px;
    height:16px;
  }

  .gs-invoice .contact span{
    text-align:right;
    line-height:1.25;
    color:rgba(255,255,255,.86);
  }

  .gs-invoice .contact.wide span{
    max-width:360px;
  }

  .gs-invoice .gs-edit{
    width:100%;
    background:transparent;
    border:none;
    border-bottom:1px dashed rgba(255,255,255,.22);
    color:#eaf2ff;
    padding:2px 0;
    font:inherit;
  }
  .gs-invoice .gs-edit:focus{
    outline:none;
    border-bottom-color: rgba(31,139,255,.95);
    color:#eaf2ff;
  }
  .gs-invoice .gs-right{ text-align:right; }
  .gs-invoice .gs-textarea{ resize:vertical; white-space:pre-line; }
  .gs-invoice .addr-2{ resize:none; overflow:auto; line-height:1.35; }

  .gs-invoice .gs-icon-btn{
    background:transparent;
    border:none;
    padding:0;
    cursor:pointer;
  }
  .gs-invoice .gs-danger{ font-size:22px; color:#ff6b6b; }
  .gs-invoice .gs-actions{
    margin-top:12px;
    display:flex;
    justify-content:flex-end;
  }

  .gs-invoice .gs-dummy{
    color: rgba(255,255,255,.55) !important;
    border-bottom-color: rgba(255,255,255,.14) !important;
  }
  .gs-invoice .gs-readonly{
    opacity:.65;
    cursor:not-allowed;
  }

  .gs-status-toggle{
    display:flex;
    gap:8px;
    margin-top:2px;
    flex-wrap:wrap;
  }

  .gs-status-btn{
    border:1px solid rgba(255,255,255,.16);
    background:rgba(255,255,255,.05);
    color:#eaf2ff;
    padding:8px 14px;
    border-radius:999px;
    cursor:pointer;
    font-weight:800;
    font-size:12px;
    transition:.2s ease;
  }

  .gs-status-btn.active{
    background: linear-gradient(90deg, rgba(31,139,255,.95), rgba(15,177,255,.85));
    color:#fff;
    box-shadow: 0 12px 24px rgba(31,139,255,.20);
  }

  .gs-status-label{
    margin-top:8px;
    font-size:12px;
    color:#a9bbd7;
    font-weight:700;
  }

  @media (max-width: 820px){
    .gs-invoice .page{ width:100%; }
  }
  @media (max-width: 760px){
    .gs-invoice .meta{ grid-template-columns:1fr; gap:16px; }
    .gs-invoice .meta-right{ justify-content:flex-start; }
    .gs-invoice .bottom{ grid-template-columns:1fr; gap:16px; }
    .gs-invoice .contacts{ justify-content:flex-start; }
    .gs-invoice .contact{ justify-content:flex-start; }
    .gs-invoice .contact span{ text-align:left; }
    .gs-invoice .invoice-pill{ font-size:18px; padding:12px 18px; }
  }
  `;

  // ========= State =========
  const [isSaving, setIsSaving] = useState(false);

  const [invoiceMeta, setInvoiceMeta] = useState({
    id: null,
    invoicePrefix: "GoStudy-inv-",
    invoiceSuffix: "0001",
    date: toYYYYMMDD(new Date()),
    status: UI_STATUS.UNPAID,
    currency: "AED",
  });

  const [client, setClient] = useState(DUMMY_CLIENT);
  const [items, setItems] = useState(DUMMY_ITEMS);

  const [touchedClient, setTouchedClient] = useState({
    name: false,
    phone: false,
    email: false,
    address: false,
  });
  const [touchedItems, setTouchedItems] = useState({}); // key: `${idx}:${field}` => true

  const account = {
    accountName: "Gostudy Academy Limited",
    bankName: "WIO Bank PJSC",
    accountNumber: "9610129909",
    iban: "AE62 0860 0000 0961 0129 909",
    swift: "WIOBAEADXXX",
    bankAddress: "5th Floor, Etihad Airways, Abu Dhabi, UAE",
  };

  const mappedItems = useMemo(() => mapInvoiceItems(items), [items]);

  const total = useMemo(() => {
    return round2(mappedItems.reduce((sum, it) => sum + (Number(it.line_total) || 0), 0));
  }, [mappedItems]);

  const fmt = (n) =>
    (Number(n) || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const updateItem = (idx, key, value) => {
    setTouchedItems((p) => ({ ...p, [`${idx}:${key}`]: true }));
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  };

  const addRow = () =>
    setItems((prev) => [...prev, { description: "New Item", rate: 0, qty: 1 }]);

  const removeRow = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setTouchedItems({});
  };

  // ✅ Actual save logic (no confirm here)
  const handleSave = async () => {
    try {
      if (isSaving) return;
      setIsSaving(true);

      Swal.fire({
        title: "Saving...",
        text: "Please wait",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const t = await getToken();
      const token = typeof t === "string" ? t : t?.token;

      const headers = {
        ...BASE_HEADERS,
        ...(token ? { token } : {}),
      };

      const itemsPayload = mapInvoiceItems(items);
      const totalAmount = round2(
        itemsPayload.reduce((sum, it) => sum + (Number(it.line_total) || 0), 0)
      );

      const invoiceNo = `${invoiceMeta.invoicePrefix}${invoiceMeta.invoiceSuffix}`;
      const statusForApi = getApiStatus(invoiceMeta.status);

      const payload = {
        procedureName: "add_update_invoice",
        parameters: [
          invoiceMeta.id ?? null, // null=create, id=update
          invoiceNo,
          toYYYYMMDD(invoiceMeta.date),
          statusForApi, // UI: Paid/Unpaid | API: paid/pending
          invoiceMeta.currency || "AED",
          client.name,
          client.phone,
          client.email,
          client.address,
          totalAmount,
          JSON.stringify(itemsPayload),
        ],
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      Swal.close();

      if (!res.ok) {
        console.error("Invoice API HTTP error:", res.status, data);
        throw new Error(data?.message || `Invoice save failed (HTTP ${res.status})`);
      }

      const isBad =
        data?.success === false ||
        data?.status === "error" ||
        data?.error === true ||
        (typeof data?.statusCode === "number" && data.statusCode !== 200);

      if (isBad) {
        console.error("Invoice API logical error:", data);
        throw new Error(data?.message || "Invoice save failed (API)");
      }

      await Swal.fire({
        icon: "success",
        title: "Saved",
        text: "Invoice saved ✅",
        timer: 1400,
        showConfirmButton: false,
      });

      const nextInvSuffix = nextSuffix(invoiceMeta.invoiceSuffix);

      setInvoiceMeta((p) => ({
        ...p,
        id: null,
        invoiceSuffix: nextInvSuffix,
        date: toYYYYMMDD(new Date()),
        status: UI_STATUS.UNPAID,
        currency: "AED",
      }));

      setClient(DUMMY_CLIENT);
      setItems(DUMMY_ITEMS);
      setTouchedClient({ name: false, phone: false, email: false, address: false });
      setTouchedItems({});
    } catch (err) {
      Swal.close();
      console.error("Invoice save error:", err);

      await Swal.fire({
        icon: "error",
        title: "Save failed",
        text: err?.message || "Invoice save failed. Check console.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ Confirm wrapper
  const handleSaveConfirm = async () => {
    if (isSaving) return;

    const res = await Swal.fire({
      icon: "question",
      title: "Confirm Create",
      text: "Are you sure you want to create/save this invoice?",
      showCancelButton: true,
      confirmButtonText: "Yes, Save",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      allowOutsideClick: () => !Swal.isLoading(),
    });

    if (res.isConfirmed) {
      await handleSave();
    }
  };

  // ===== dummy class helpers =====
  const clsClient = (field) => (!touchedClient[field] ? "gs-dummy" : "");
  const clsItem = (idx, field) => (!touchedItems[`${idx}:${field}`] ? "gs-dummy" : "");

  return (
    <div className="card">
      <style>{css}</style>

      <div className="card-header">
        <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-sm btn-primary-600 radius-8 d-inline-flex align-items-center gap-1"
            onClick={handleSaveConfirm}
            disabled={isSaving}
          >
            <Icon
              icon={isSaving ? "mdi:loading" : "mdi:content-save-check-outline"}
              className="text-xl"
            />
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="card-body py-40">
        <div className="row justify-content-center" id="invoice">
          <div className="col-lg-10">
            <div className="gs-invoice" data-invoice-root="1">
              <div className="sheet">
                <main className="page">
                  <header className="top">
                    <div className="wave-left" />
                    <div className="wave-mid" />
                    <div className="wave-right" />

                    <div className="topbar">
                      <div className="brand">
                        <img
                          src="assets/images/logo-light.png"
                          alt="GoStudy"
                          className="brand-wordmark"
                        />
                      </div>

                      <div className="invoice-pill">INVOICE</div>
                    </div>
                  </header>

                  <section className="meta">
                    <div>
                      <div className="block-title">Invoice to</div>

                      <input
                        className={`gs-edit to-name ${clsClient("name")}`}
                        value={client.name}
                        onChange={(e) => {
                          setTouchedClient((p) => ({ ...p, name: true }));
                          setClient((p) => ({ ...p, name: e.target.value }));
                        }}
                        placeholder="Client name"
                      />

                      <div className="kv">
                        <b>Phone:</b>
                        <div>
                          <input
                            className={`gs-edit ${clsClient("phone")}`}
                            value={client.phone}
                            onChange={(e) => {
                              setTouchedClient((p) => ({ ...p, phone: true }));
                              setClient((p) => ({ ...p, phone: e.target.value }));
                            }}
                            placeholder="+971 ..."
                          />
                        </div>

                        <b>Email:</b>
                        <div>
                          <input
                            className={`gs-edit ${clsClient("email")}`}
                            value={client.email}
                            onChange={(e) => {
                              setTouchedClient((p) => ({ ...p, email: true }));
                              setClient((p) => ({ ...p, email: e.target.value }));
                            }}
                            placeholder="client@email.com"
                          />
                        </div>

                        <b>Address:</b>
                        <div>
                          <textarea
                            className={`gs-edit gs-textarea addr-2 ${clsClient("address")}`}
                            value={client.address}
                            onChange={(e) => {
                              setTouchedClient((p) => ({ ...p, address: true }));
                              setClient((p) => ({ ...p, address: e.target.value }));
                            }}
                            rows={2}
                            placeholder="Write Address"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="meta-right">
                      <div className="meta-card">
                        <div className="kv">
                          <b>Invoice No:</b>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <div className="gs-static" style={{ whiteSpace: "nowrap" }}>
                              {invoiceMeta.invoicePrefix}
                            </div>
                            <input
                              className="gs-edit gs-right"
                              value={invoiceMeta.invoiceSuffix}
                              onChange={(e) =>
                                setInvoiceMeta((p) => ({ ...p, invoiceSuffix: e.target.value }))
                              }
                              placeholder="0001"
                            />
                          </div>

                          <b>Date:</b>
                          <div>
                            <input
                              type="date"
                              className="gs-edit gs-right"
                              value={toYYYYMMDD(invoiceMeta.date)}
                              onChange={(e) =>
                                setInvoiceMeta((p) => ({ ...p, date: e.target.value }))
                              }
                            />
                          </div>

                          <b>Status:</b>
                          <div>
                            <div className="gs-status-toggle">
                              <button
                                type="button"
                                className={`gs-status-btn ${
                                  invoiceMeta.status === UI_STATUS.UNPAID ? "active" : ""
                                }`}
                                onClick={() =>
                                  setInvoiceMeta((p) => ({
                                    ...p,
                                    status: UI_STATUS.UNPAID,
                                  }))
                                }
                              >
                                Unpaid
                              </button>

                              <button
                                type="button"
                                className={`gs-status-btn ${
                                  invoiceMeta.status === UI_STATUS.PAID ? "active" : ""
                                }`}
                                onClick={() =>
                                  setInvoiceMeta((p) => ({
                                    ...p,
                                    status: UI_STATUS.PAID,
                                  }))
                                }
                              >
                                Paid
                              </button>
                            </div>

                            <div className="gs-status-label">
                              Current: {invoiceMeta.status}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="table-wrap">
                    <table role="table" aria-label="Invoice items">
                      <thead>
                        <tr>
                          <th className="col-no">No</th>
                          <th className="col-desc">Description</th>
                          <th className="col-rate">
                            Rate <small>(in AED)</small>
                          </th>
                          <th className="col-qty">QTY</th>
                          <th className="col-amt">
                            Amount <small>(in AED)</small>
                          </th>
                          <th className="col-act">Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {items.map((it, idx) => {
                          const amount = round2((Number(it.rate) || 0) * (Number(it.qty) || 0));

                          return (
                            <tr key={idx}>
                              <td className="col-no">{idx + 1}</td>

                              <td className="col-desc">
                                <input
                                  className={`gs-edit ${clsItem(idx, "description")}`}
                                  value={it.description}
                                  onChange={(e) => updateItem(idx, "description", e.target.value)}
                                  placeholder="Item description"
                                />
                              </td>

                              <td className="col-rate">
                                <input
                                  className={`gs-edit gs-right ${clsItem(idx, "rate")}`}
                                  value={it.rate}
                                  onChange={(e) => updateItem(idx, "rate", e.target.value)}
                                  inputMode="decimal"
                                />
                              </td>

                              <td className="col-qty">
                                <input
                                  className={`gs-edit gs-right ${clsItem(idx, "qty")}`}
                                  value={it.qty}
                                  onChange={(e) => updateItem(idx, "qty", e.target.value)}
                                  inputMode="numeric"
                                />
                              </td>

                              <td className="col-amt">{fmt(amount)}</td>

                              <td className="col-act">
                                <button
                                  type="button"
                                  className="gs-icon-btn"
                                  onClick={() => removeRow(idx)}
                                  aria-label="Remove row"
                                >
                                  <Icon icon="mdi:close" className="gs-danger" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="gs-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary-600 radius-8 d-inline-flex align-items-center gap-1"
                        onClick={addRow}
                      >
                        <Icon icon="mdi:plus" className="text-xl" />
                        Add New
                      </button>
                    </div>
                  </section>

                  <section className="bottom">
                    <div>
                      <div className="section-title">Account Details</div>

                      <div className="account">
                        <div className="kv">
                          <b>Account Name:</b>
                          <div className="gs-static">{account.accountName}</div>

                          <b>Bank Name:</b>
                          <div className="gs-static">{account.bankName}</div>

                          <b>Account Number:</b>
                          <div className="gs-static">{account.accountNumber}</div>

                          <b>IBAN:</b>
                          <div className="gs-static">{account.iban}</div>

                          <b>SWIFT / BIC:</b>
                          <div className="gs-static">{account.swift}</div>

                          <b>Bank Address:</b>
                          <div className="gs-static">{account.bankAddress}</div>
                        </div>
                      </div>
                    </div>

                    <div className="summary">
                      <div className="sum-row">
                        <b>Total</b>
                        <div className="amount">
                          {invoiceMeta.currency || "AED"} {fmt(total)}
                        </div>
                      </div>

                      <div className="sum-row due">
                        <b>Due Balance</b>
                        <div className="amount">
                          {invoiceMeta.currency || "AED"} {fmt(total)}
                        </div>
                      </div>

                      <div className="signature">Signature</div>
                    </div>
                  </section>

                  <footer className="footer">
                    <div className="footer-grid">
                      <div className="footer-brand">
                        <div className="big">GoStudy</div>
                        <div className="sub">Academy Limited</div>
                      </div>

                      <div className="contacts">
                        <div className="contact">
                          <div className="ico" aria-hidden="true">
                            <Icon icon="mdi:phone" className="ic" />
                          </div>
                          <span>+971 58 559 3327</span>
                        </div>

                        <div className="contact">
                          <div className="ico" aria-hidden="true">
                            <Icon icon="mdi:email-outline" className="ic" />
                          </div>
                          <span>admin@gostudy.ae</span>
                        </div>

                        <div className="contact wide">
                          <div className="ico" aria-hidden="true">
                            <Icon icon="mdi:map-marker-outline" className="ic" />
                          </div>
                          <span>1st Floor, Incubator Building, Smart Station Abu Dhabi</span>
                        </div>
                      </div>
                    </div>
                  </footer>
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceAddLayer;