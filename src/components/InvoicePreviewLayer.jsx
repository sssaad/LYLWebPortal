import { Icon } from "@iconify/react/dist/iconify.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getToken } from "../api/getToken";

const API_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const BASE_HEADERS = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
  // token dynamic add hoga
};

// ===== Helpers =====
const toISODate = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    // "2026-01-30" or "2026-01-30T00:00:00Z" etc
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const fmtDatePrettyFromISO = (iso) => {
  if (!iso) return "-";
  // ✅ timezone safe
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const InvoicePreviewLayer = () => {
  // ✅ PDF required size (px)
  const PDF_W = 420;
  const PDF_H = 595;

  // ✅ capture ONLY the page (no outer sheet)
  const pageRef = useRef(null);

  const location = useLocation();
  const params = useParams();

  // ✅ invoice id: param -> state -> fallback 1
  const invoiceId = useMemo(() => {
    const fromParam = Number(params?.id);
    const fromState = Number(location?.state?.invoice?.id);
    if (!Number.isNaN(fromParam) && fromParam > 0) return fromParam;
    if (!Number.isNaN(fromState) && fromState > 0) return fromState;
    return 1;
  }, [params?.id, location?.state?.invoice?.id]);

  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ===== API invoice state =====
  const [invoice, setInvoice] = useState(null);

  const css = `
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap");

  .gs-invoice{
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    color:#eaf2ff;
  }
  .gs-invoice *{ box-sizing:border-box; }

  /* (Screen Only) center the page */
  .gs-invoice .sheet{
    width:100%;
    display:flex;
    justify-content:center;
    padding: 0;
  }

  /* PAGE (Captured) */
  .gs-invoice .page{
    width: 792px;
    height: 1122px;
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

  /* ✅ html2canvas stable layering (NO negative z-index) */
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

  /* ✅ EXPORT ONLY (no extra margin look) */
  .gs-invoice.exporting .page{
    box-shadow:none !important;
    border: 1px solid rgba(255,255,255,.08) !important;
    border-radius: 26px !important;
  }

  /* Header */
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

  /* Meta */
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
    font-size:26px !important;
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
  .gs-invoice.exporting .meta-card{ box-shadow:none; }
  .gs-invoice .meta-card .kv{
    grid-template-columns: 90px 1fr;
    gap:10px 12px;
  }

  /* Table */
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

  /* Bottom */
  .gs-invoice .bottom{
    display:grid;
    grid-template-columns: 1.25fr .75fr;
    gap:26px;
    padding: 8px 34px 18px;
    margin-top:auto !important;
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
  .gs-invoice.exporting .account{ box-shadow:none; }
  .gs-invoice .account .kv{
    grid-template-columns: 120px 1fr;
    font-size:12.5px;
    gap:10px 14px;
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
  .gs-invoice.exporting .sum-row{ box-shadow:none; }
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

  /* Footer */
  .gs-invoice .footer{
    margin-top:0 !important;
    padding: 22px 34px 26px;
    border-top:1px solid rgba(255,255,255,.06);
    background: linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.18));
    position:relative;
    overflow:hidden;
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
  .gs-invoice .contact span{
    text-align:right;
    line-height:1.25;
    color:rgba(255,255,255,.86);
  }
  .gs-invoice .contact.wide span{
    max-width:360px;
  }
  `;

  const fmtMoney = (n) =>
    (Number(n) || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const waitForImages = async (root) => {
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) return resolve();
            img.onload = resolve;
            img.onerror = resolve;
          })
      )
    );
  };

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      setErr("");

      const t = await getToken();
      const token = typeof t === "string" ? t : t?.token;

      const headers = {
        ...BASE_HEADERS,
        ...(token ? { token } : {}),
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          procedureName: "get_invoice",
          parameters: [invoiceId],
          ...(token ? { token } : {}),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.message || "API Error");
      if (json?.statusCode !== 200) throw new Error(json?.message || "Failed to load invoice");

      const row = Array.isArray(json?.data) ? json.data[0] : null;
      if (!row) throw new Error("Invoice not found");

      // items parse (string JSON)
      let parsedItems = [];
      try {
        const src = row.items ?? row.invoice_items ?? row.item_json;
        if (Array.isArray(src)) parsedItems = src;
        else if (typeof src === "string" && src.trim()) parsedItems = JSON.parse(src);
      } catch {
        parsedItems = [];
      }

      const account = {
        accountName: "Gostudy Academy Limited",
        bankName: "WIO Bank PJSC",
        accountNumber: "9610129909",
        iban: "AE62 0860 0000 0961 0129 909",
        swift: "WIOBAEADXXX",
        bankAddress: "5th Floor, Etihad Airways, Abu Dhabi, UAE",
      };

      const dateISO = toISODate(row.issue_date);

      const mapped = {
        id: row.id,
        invoiceNo: row.invoice_no || "-",
        dateISO,
        datePretty: fmtDatePrettyFromISO(dateISO),
        currency: row.currency || "AED",
        status: row.status || "",
        client: {
          name: row.client_name || "-",
          phone: row.client_phone || "-",
          email: row.client_email || "-",
          address: row.client_address || "-",
        },
        items: (Array.isArray(parsedItems) ? parsedItems : []).map((it, idx) => ({
          id: it?.id ?? idx,
          description: it?.description || "-",
          rate: Number(it?.rate) || 0,
          qty: Number(it?.qty) || 0,
        })),
        total: Number(row.total) || 0,
        account,
      };

      if (!mapped.total) {
        mapped.total = mapped.items.reduce(
          (sum, it) => sum + (Number(it.rate) || 0) * (Number(it.qty) || 0),
          0
        );
      }

      setInvoice(mapped);
    } catch (e) {
      setErr(e?.message || "Something went wrong");
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const total = useMemo(() => {
    if (!invoice) return 0;
    const computed = invoice.items.reduce(
      (sum, it) => sum + (Number(it.rate) || 0) * (Number(it.qty) || 0),
      0
    );
    return invoice.total || computed;
  }, [invoice]);

  const handleDownloadPdf = async () => {
    const node = pageRef.current;
    if (!node || !invoice) return;

    try {
      setExporting(true);

      if (document.fonts?.ready) await document.fonts.ready;
      await waitForImages(node);

      const canvas = await html2canvas(node, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#071122",
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        onclone: (doc) => {
          const root = doc.querySelector('[data-invoice-root="1"]');
          if (root) root.classList.add("exporting");
        },
      });

      const imgData = canvas.toDataURL("image/png", 1.0);

      let pdf;
      try {
        pdf = new jsPDF({
          unit: "px",
          format: [PDF_W, PDF_H],
          orientation: "portrait",
        });
        pdf.addImage(imgData, "PNG", 0, 0, PDF_W, PDF_H, undefined, "FAST");
      } catch {
        const pxToPt = (v) => v * 0.75;
        pdf = new jsPDF({
          unit: "pt",
          format: [pxToPt(PDF_W), pxToPt(PDF_H)],
          orientation: "portrait",
        });
        pdf.addImage(imgData, "PNG", 0, 0, pxToPt(PDF_W), pxToPt(PDF_H), undefined, "FAST");
      }

      pdf.save(`invoice-${invoice.invoiceNo}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const currency = invoice?.currency || "AED";

  return (
    <div className="card">
      <style>{css}</style>

      <div className="card-header">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              onClick={fetchInvoice}
              className="btn btn-sm btn-outline-primary"
              disabled={loading}
              title="Refresh"
            >
              <Icon icon="mdi:refresh" className="me-6" />
              Refresh
            </button>
          </div>

          <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="btn btn-sm btn-warning radius-8 d-inline-flex align-items-center gap-1"
              disabled={exporting || loading || !invoice}
            >
              <Icon icon="solar:download-linear" className="text-xl" />
              {exporting ? "Generating..." : "Download"}
            </button>

            {/* ✅ Go to edit route with id + state */}
            <Link
              to={`/invoice-edit`}
              state={{ invoice }}
              className="btn btn-sm btn-success radius-8 d-inline-flex align-items-center gap-1"
            >
              <Icon icon="uil:edit" className="text-xl" />
              Edit
            </Link>
          </div>
        </div>
      </div>

      <div className="card-body py-40">
        <div className="row justify-content-center">
          <div className="col-lg-10">
            {err ? <div className="alert alert-danger mb-16">{err}</div> : null}

            {loading ? (
              <div className="text-center py-24">Loading...</div>
            ) : !invoice ? (
              <div className="text-center py-24">No invoice data.</div>
            ) : (
              <div className="gs-invoice" data-invoice-root="1">
                <div className="sheet">
                  <main ref={pageRef} className="page">
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
                            crossOrigin="anonymous"
                          />
                        </div>

                        <div className="invoice-pill">INVOICE</div>
                      </div>
                    </header>

                    <section className="meta">
                      <div>
                        <div className="block-title">Invoice to</div>
                        <h1 className="to-name">{invoice.client.name}</h1>

                        <div className="kv">
                          <b>Phone:</b>
                          <div>{invoice.client.phone}</div>

                          <b>Email:</b>
                          <div>{invoice.client.email}</div>

                          <b>Address:</b>
                          <div style={{ whiteSpace: "pre-line" }}>{invoice.client.address}</div>
                        </div>
                      </div>

                      <div className="meta-right">
                        <div className="meta-card">
                          <div className="kv">
                            <b>Invoice No:</b>
                            <div>{invoice.invoiceNo}</div>
                            <b>Date:</b>
                            {/* ✅ timezone safe date */}
                            <div>{invoice.datePretty}</div>
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
                              Rate <small>(in {currency})</small>
                            </th>
                            <th className="col-qty">QTY</th>
                            <th className="col-amt">
                              Amount <small>(in {currency})</small>
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {invoice.items.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-24">
                                No items found.
                              </td>
                            </tr>
                          ) : (
                            invoice.items.map((it, idx) => {
                              const amount = (Number(it.rate) || 0) * (Number(it.qty) || 0);
                              return (
                                <tr key={it.id ?? idx}>
                                  <td className="col-no">{idx + 1}</td>
                                  <td className="col-desc">{it.description}</td>
                                  <td className="col-rate">{fmtMoney(it.rate)}</td>
                                  <td className="col-qty">{it.qty}</td>
                                  <td className="col-amt">{fmtMoney(amount)}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </section>

                    <section className="bottom">
                      <div>
                        <div className="section-title">Account Details</div>
                        <div className="account">
                          <div className="kv">
                            <b>Account Name:</b>
                            <div>{invoice.account.accountName}</div>

                            <b>Bank Name:</b>
                            <div>{invoice.account.bankName}</div>

                            <b>Account Number:</b>
                            <div>{invoice.account.accountNumber}</div>

                            <b>IBAN:</b>
                            <div>{invoice.account.iban}</div>

                            <b>SWIFT / BIC:</b>
                            <div>{invoice.account.swift}</div>

                            <b>Bank Address:</b>
                            <div>{invoice.account.bankAddress}</div>
                          </div>
                        </div>
                      </div>

                      <div className="summary">
                        <div className="sum-row">
                          <b>Total</b>
                          <div className="amount">
                            {currency} {fmtMoney(total)}
                          </div>
                        </div>

                        <div className="sum-row due">
                          <b>Due Balance</b>
                          <div className="amount">
                            {currency} {fmtMoney(total)}
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
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M7 4h3l2 5-2 1c1 3 3 5 6 6l1-2 5 2v3c0 1-1 2-2 2-9 0-16-7-16-16 0-1 1-2 2-2Z"
                                  stroke="rgba(255,255,255,.9)"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                            <span>+971 58 559 3327</span>
                          </div>

                          <div className="contact">
                            <div className="ico" aria-hidden="true">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M4 6h16v12H4V6Z"
                                  stroke="rgba(255,255,255,.9)"
                                  strokeWidth="2"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="m4 7 8 6 8-6"
                                  stroke="rgba(255,255,255,.9)"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                            <span>admin@gostudy.ae</span>
                          </div>

                          <div className="contact wide">
                            <div className="ico" aria-hidden="true">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z"
                                  stroke="rgba(255,255,255,.9)"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                                  stroke="rgba(255,255,255,.9)"
                                  strokeWidth="2"
                                />
                              </svg>
                            </div>
                            <span>1st Floor, Incubator Building, Smart Station Abu Dhabi</span>
                          </div>
                        </div>
                      </div>
                    </footer>
                  </main>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewLayer;
