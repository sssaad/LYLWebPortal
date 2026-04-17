import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Swal from "sweetalert2";
import { getToken } from "../api/getToken";

const GET_LEADS_API_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_lookup_data";

const ADD_LEAD_API_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=add_dynamic_data";

const UPDATE_LEAD_API_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

const LEAD_SOURCE_OPTIONS = [
  { label: "Meta", value: "meta" },
  { label: "Referral", value: "referral" },
  { label: "Website Enquiry", value: "website_enquiry" },
];

const YEAR_GROUP_OPTIONS = [
  { label: "Early Years", value: "early_years" },
  ...Array.from({ length: 13 }, (_, i) => ({
    label: `Year ${i + 1}`,
    value: `year_${i + 1}`,
  })),
];

const MEMBER_OPTIONS = [
  { label: "Gareth", value: "gareth" },
  { label: "Imran", value: "imran" },
  { label: "Sanval", value: "sanval" },
  { label: "Kamille", value: "kamille" },
];

const STATUS_OPTIONS = [
  { label: "Contact Made", value: "contact_made" },
  { label: "Client Registered", value: "client_registered" },
  {
    label: "Client Booked First Session",
    value: "client_booked_first_session",
  },
];

const USER_RESPONSE_OPTIONS = [
  { label: "Interested", value: "Interested" },
  { label: "Not Interested", value: "Not Interested" },
  { label: "No Response", value: "No Response" },
  { label: "Follow Up Required", value: "Follow Up Required" },
  { label: "Call Back Later", value: "Call Back Later" },
  { label: "Wrong Number", value: "Wrong Number" },
];

const EMPTY_FORM = {
  lead_source: "",
  client_name: "",
  client_email: "",
  client_phone: "",
  child_name: "",
  year_group: "",
  whatsapp_message_sent: false,
  whatsapp_user_response: "",
  email_sent: false,
  email_user_response: "",
  phone_call: false,
  phone_user_response: "",
  go_study_member_leading: "",
  notes: "",
  status: "contact_made",
};

const norm = (v) => String(v ?? "").toLowerCase().trim();

const toBoolean = (value) => {
  const normalized = String(value ?? "").toLowerCase().trim();
  return (
    value === true ||
    value === 1 ||
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
};

const toApiFlag = (value) => (toBoolean(value) ? 1 : 0);

const createFallbackId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `lead-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const parseDateValue = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getSafeTime = (value) => {
  const date = parseDateValue(value);
  return date ? date.getTime() : 0;
};

const formatDisplayDate = (value) => {
  const date = parseDateValue(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatDateTimeForApi = (date = new Date()) => {
  const pad = (num) => String(num).padStart(2, "0");

  return (
    [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join("-") +
    " " +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(
      ":"
    )
  );
};

const normalizeLead = (item) => {
  const numericId = Number(item?.id);
  return {
    id:
      Number.isFinite(numericId) && numericId > 0
        ? numericId
        : createFallbackId(),
    lead_source: item?.lead_source || "",
    client_name: item?.client_name || "",
    client_email: item?.client_email || "",
    client_phone: item?.client_phone || "",
    child_name: item?.child_name || "",
    year_group: item?.year_group || "",
    whatsapp_message_sent: toBoolean(item?.whatsapp_message_sent),
    whatsapp_user_response: item?.whatsapp_user_response || "",
    email_sent: toBoolean(item?.email_sent),
    email_user_response: item?.email_user_response || "",
    phone_call: toBoolean(item?.phone_call),
    phone_user_response: item?.phone_user_response || "",
    go_study_member_leading: item?.go_study_member_leading || "",
    notes: item?.notes || "",
    status: item?.status || "contact_made",
    created_at: item?.created_at || "",
    updated_at: item?.updated_at || "",
    deleted_at: item?.deleted_at || null,
    is_deleted: toBoolean(item?.is_deleted),
  };
};

const getOptionLabel = (options, value) =>
  options.find((item) => item.value === value)?.label || "-";

const getStatusClass = (status) => {
  const s = norm(status);
  if (s === "contact_made") return "lc-badge lc-badge-warning";
  if (s === "client_registered") return "lc-badge lc-badge-primary";
  if (s === "client_booked_first_session") return "lc-badge lc-badge-success";
  return "lc-badge lc-badge-secondary";
};

const getSourceClass = (source) => {
  const s = norm(source);
  if (s === "meta") return "lc-badge lc-badge-info";
  if (s === "referral") return "lc-badge lc-badge-purple";
  if (s === "website_enquiry") return "lc-badge lc-badge-secondary";
  return "lc-badge lc-badge-secondary";
};

const getYesNoClass = (value) =>
  value ? "lc-badge lc-badge-success" : "lc-badge lc-badge-danger";

const renderUserResponse = (value) => value?.trim() || "-";

const buildAddLeadPayload = (token, formData) => ({
  token,
  tablename: "leads",
  lead_source: formData.lead_source || "",
  client_name: formData.client_name?.trim() || "",
  client_email: formData.client_email?.trim() || "",
  client_phone: formData.client_phone?.trim() || "",
  child_name: formData.child_name?.trim() || "",
  year_group: formData.year_group || "",
  whatsapp_message_sent: toApiFlag(formData.whatsapp_message_sent),
  whatsapp_user_response: formData.whatsapp_message_sent
    ? formData.whatsapp_user_response || ""
    : "",
  email_sent: toApiFlag(formData.email_sent),
  email_user_response: formData.email_sent
    ? formData.email_user_response || ""
    : "",
  phone_call: toApiFlag(formData.phone_call),
  phone_user_response: formData.phone_call
    ? formData.phone_user_response || ""
    : "",
  go_study_member_leading: formData.go_study_member_leading || "",
  notes: formData.notes?.trim() || "",
  status: formData.status || "contact_made",
});

const buildUpdateLeadPayload = (token, leadId, formData) => ({
  token,
  tablename: "leads",
  conditions: [
    {
      id: Number(leadId),
    },
  ],
  updatedata: [
    {
      lead_source: formData.lead_source || "",
      client_name: formData.client_name?.trim() || "",
      client_email: formData.client_email?.trim() || "",
      client_phone: formData.client_phone?.trim() || "",
      child_name: formData.child_name?.trim() || "",
      year_group: formData.year_group || "",
      whatsapp_message_sent: toApiFlag(formData.whatsapp_message_sent),
      whatsapp_user_response: formData.whatsapp_message_sent
        ? formData.whatsapp_user_response || ""
        : "",
      email_sent: toApiFlag(formData.email_sent),
      email_user_response: formData.email_sent
        ? formData.email_user_response || ""
        : "",
      phone_call: toApiFlag(formData.phone_call),
      phone_user_response: formData.phone_call
        ? formData.phone_user_response || ""
        : "",
      go_study_member_leading: formData.go_study_member_leading || "",
      notes: formData.notes?.trim() || "",
      status: formData.status || "contact_made",
    },
  ],
});

const buildDeleteLeadPayload = (token, leadId) => ({
  token,
  tablename: "leads",
  conditions: [
    {
      id: Number(leadId),
    },
  ],
  updatedata: [
    {
      is_deleted: 1,
      deleted_at: formatDateTimeForApi(),
    },
  ],
});

const themeStyles = `
  :root {
    --lc-bg: #f5f7fb;
    --lc-surface: #ffffff;
    --lc-surface-soft: #f8fafc;
    --lc-border: rgba(15, 23, 42, 0.08);
    --lc-text: #0f172a;
    --lc-text-soft: #64748b;
    --lc-input-bg: #ffffff;
    --lc-input-border: #dbe2ea;
    --lc-table-head: #f8fafc;
    --lc-row-hover: #f8fafc;
    --lc-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
    --lc-hero-bg: linear-gradient(135deg, #ffffff 0%, #f4f8ff 55%, #eef4ff 100%);
    --lc-hero-title: #0f172a;
    --lc-hero-text: #5b6779;
    --lc-chip-bg: rgba(37, 99, 235, 0.08);
    --lc-chip-text: #1d4ed8;
    --lc-modal-overlay: rgba(15, 23, 42, 0.45);
    --lc-btn-ghost-bg: #ffffff;
    --lc-btn-ghost-text: #334155;
    --lc-btn-ghost-border: #dbe2ea;
    --lc-scroll-track: #e8edf5;
    --lc-scroll-thumb: #aab6c5;
    --lc-sticky-head-bg: #f8fafc;
  }

  [data-bs-theme="dark"],
  [data-theme="dark"],
  .dark {
    --lc-bg: #0b1120;
    --lc-surface: #111827;
    --lc-surface-soft: #0f172a;
    --lc-border: rgba(255, 255, 255, 0.08);
    --lc-text: #e5edf7;
    --lc-text-soft: #94a3b8;
    --lc-input-bg: #0f172a;
    --lc-input-border: rgba(255, 255, 255, 0.12);
    --lc-table-head: #162132;
    --lc-row-hover: #162033;
    --lc-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
    --lc-hero-bg: linear-gradient(135deg, #111827 0%, #172554 52%, #312e81 100%);
    --lc-hero-title: #ffffff;
    --lc-hero-text: rgba(226, 232, 240, 0.82);
    --lc-chip-bg: rgba(255, 255, 255, 0.08);
    --lc-chip-text: #e2e8f0;
    --lc-modal-overlay: rgba(2, 6, 23, 0.7);
    --lc-btn-ghost-bg: rgba(148, 163, 184, 0.08);
    --lc-btn-ghost-text: #cbd5e1;
    --lc-btn-ghost-border: rgba(148, 163, 184, 0.14);
    --lc-scroll-track: #0f172a;
    --lc-scroll-thumb: #475569;
    --lc-sticky-head-bg: #162132;
  }

  .lead-centre-theme {
    color: var(--lc-text);
  }

  .lead-centre-theme .lc-card {
    background: var(--lc-surface);
    border: 1px solid var(--lc-border);
    border-radius: 18px;
    box-shadow: var(--lc-shadow);
  }

  .lead-centre-theme .lc-hero {
    background: var(--lc-hero-bg);
    overflow: hidden;
    position: relative;
  }

  .lead-centre-theme .lc-title {
    color: var(--lc-hero-title);
  }

  .lead-centre-theme .lc-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--lc-chip-bg);
    color: var(--lc-chip-text);
    font-size: 12px;
    font-weight: 700;
    border: 1px solid var(--lc-border);
  }

  .lead-centre-theme .lc-stat-card {
    background: var(--lc-surface);
    border: 1px solid var(--lc-border);
    border-radius: 18px;
    box-shadow: var(--lc-shadow);
    height: 100%;
  }

  .lead-centre-theme .lc-stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    background: var(--lc-surface-soft);
    border: 1px solid var(--lc-border);
  }

  .lead-centre-theme .lc-muted {
    color: var(--lc-text-soft);
  }

  .lead-centre-theme .lc-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--lc-text);
    margin-bottom: 8px;
    display: block;
  }

  .lead-centre-theme .lc-input,
  .lead-centre-theme .lc-select,
  .lead-centre-theme .lc-textarea {
    width: 100%;
    background: var(--lc-input-bg);
    color: var(--lc-text);
    border: 1px solid var(--lc-input-border);
    border-radius: 12px;
    padding: 11px 14px;
    outline: none;
    transition: 0.2s ease;
  }

  .lead-centre-theme .lc-input:focus,
  .lead-centre-theme .lc-select:focus,
  .lead-centre-theme .lc-textarea:focus {
    border-color: rgba(59, 130, 246, 0.45);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
  }

  .lead-centre-theme .lc-invalid {
    border-color: rgba(239, 68, 68, 0.65) !important;
  }

  .lead-centre-theme .lc-error {
    color: #ef4444;
    font-size: 12px;
    margin-top: 6px;
  }

  .lead-centre-theme .lc-table-wrap {
    border: 1px solid var(--lc-border);
    border-radius: 16px;
    overflow: hidden;
    background: var(--lc-surface);
  }

  .lead-centre-theme .lc-table-scroll {
    width: 100%;
    max-height: 520px;
    overflow: auto;
    background: var(--lc-surface);
  }

  .lead-centre-theme .lc-table {
    width: 100%;
    min-width: 2350px;
    margin-bottom: 0;
    color: var(--lc-text);
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
    --bs-table-bg: var(--lc-surface);
    --bs-table-color: var(--lc-text);
    --bs-table-border-color: var(--lc-border);
  }

  .lead-centre-theme .lc-table thead th {
    position: sticky;
    top: 0;
    z-index: 5;
    background: var(--lc-sticky-head-bg) !important;
    color: var(--lc-text-soft) !important;
    border-color: var(--lc-border) !important;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 14px 14px;
  }

  .lead-centre-theme .lc-table > :not(caption) > * > * {
    background: var(--lc-surface) !important;
    color: var(--lc-text) !important;
    border-color: var(--lc-border) !important;
    vertical-align: middle;
    padding: 16px 14px;
  }

  .lead-centre-theme .lc-table tbody tr:hover > * {
    background: var(--lc-row-hover) !important;
  }

  .lead-centre-theme .lc-nowrap {
    white-space: nowrap;
  }

  .lead-centre-theme .lc-wrap {
    white-space: normal;
    word-break: break-word;
  }

  .lead-centre-theme .lc-col-sl { width: 70px; min-width: 70px; }
  .lead-centre-theme .lc-col-date { width: 130px; min-width: 130px; }
  .lead-centre-theme .lc-col-source { width: 150px; min-width: 150px; }
  .lead-centre-theme .lc-col-name { width: 180px; min-width: 180px; }
  .lead-centre-theme .lc-col-email { width: 235px; min-width: 235px; }
  .lead-centre-theme .lc-col-phone { width: 170px; min-width: 170px; }
  .lead-centre-theme .lc-col-child { width: 170px; min-width: 170px; }
  .lead-centre-theme .lc-col-year { width: 140px; min-width: 140px; }
  .lead-centre-theme .lc-col-flag { width: 95px; min-width: 95px; text-align: center; }
  .lead-centre-theme .lc-col-response { width: 185px; min-width: 185px; }
  .lead-centre-theme .lc-col-member { width: 170px; min-width: 170px; }
  .lead-centre-theme .lc-col-notes { width: 240px; min-width: 240px; }
  .lead-centre-theme .lc-col-status { width: 190px; min-width: 190px; }
  .lead-centre-theme .lc-col-actions { width: 160px; min-width: 160px; }

  .lead-centre-theme .lc-note-text {
    display: block;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lead-centre-theme .lc-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid transparent;
    white-space: nowrap;
  }

  .lead-centre-theme .lc-badge-warning {
    background: rgba(245, 158, 11, 0.16);
    color: #d97706;
    border-color: rgba(245, 158, 11, 0.24);
  }

  .lead-centre-theme .lc-badge-primary {
    background: rgba(59, 130, 246, 0.16);
    color: #2563eb;
    border-color: rgba(59, 130, 246, 0.24);
  }

  .lead-centre-theme .lc-badge-success {
    background: rgba(34, 197, 94, 0.16);
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.24);
  }

  .lead-centre-theme .lc-badge-danger {
    background: rgba(239, 68, 68, 0.16);
    color: #dc2626;
    border-color: rgba(239, 68, 68, 0.24);
  }

  .lead-centre-theme .lc-badge-info {
    background: rgba(6, 182, 212, 0.16);
    color: #0891b2;
    border-color: rgba(6, 182, 212, 0.24);
  }

  .lead-centre-theme .lc-badge-purple {
    background: rgba(168, 85, 247, 0.16);
    color: #9333ea;
    border-color: rgba(168, 85, 247, 0.24);
  }

  .lead-centre-theme .lc-badge-secondary {
    background: rgba(148, 163, 184, 0.16);
    color: #475569;
    border-color: rgba(148, 163, 184, 0.24);
  }

  .lead-centre-theme .lc-btn-ghost {
    background: var(--lc-btn-ghost-bg);
    color: var(--lc-btn-ghost-text);
    border: 1px solid var(--lc-btn-ghost-border);
  }

  .lead-centre-theme .lc-pagination .page-link {
    background: var(--lc-surface);
    color: var(--lc-text);
    border-color: var(--lc-border);
  }

  .lead-centre-theme .lc-pagination .page-item.active .page-link {
    background: #2563eb;
    border-color: #2563eb;
    color: #fff;
  }

  .lead-centre-theme .lc-modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--lc-modal-overlay);
    z-index: 9998;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    overflow: hidden;
  }

  .lead-centre-theme .lc-modal-card {
    background: var(--lc-surface);
    border: 1px solid var(--lc-border);
    border-radius: 20px;
    box-shadow: var(--lc-shadow);
    width: min(1100px, calc(100vw - 48px));
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    margin: 0;
    position: relative;
    left: 0;
    right: 0;
  }

  .lead-centre-theme .lc-modal-header {
    background: var(--lc-surface-soft);
    border-bottom: 1px solid var(--lc-border);
  }

  @media (max-width: 768px) {
    .lead-centre-theme .lc-modal-backdrop {
      padding: 12px;
      align-items: flex-start;
      overflow-y: auto;
    }

    .lead-centre-theme .lc-modal-card {
      width: 100%;
      max-height: none;
      margin-top: 12px;
      margin-bottom: 12px;
    }
  }
`;

const StatCard = ({ title, value, icon, borderColor, subText }) => {
  return (
    <div className="col-xxl-3 col-md-6">
      <div
        className="lc-stat-card p-3 p-md-4"
        style={{ borderTop: `3px solid ${borderColor}` }}
      >
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div>
            <div className="lc-muted mb-1" style={{ fontSize: 13 }}>
              {title}
            </div>
            <h3 className="mb-1 fw-bold">{value}</h3>
            <div className="lc-muted" style={{ fontSize: 12 }}>
              {subText}
            </div>
          </div>
          <div className="lc-stat-icon">{icon}</div>
        </div>
      </div>
    </div>
  );
};

const LeadFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  submitting = false,
}) => {
  const [formData, setFormData] = useState(initialData || EMPTY_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData(initialData || EMPTY_FORM);
    setErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const setField = (key, value) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "whatsapp_message_sent" && !value) {
        next.whatsapp_user_response = "";
      }

      if (key === "email_sent" && !value) {
        next.email_user_response = "";
      }

      if (key === "phone_call" && !value) {
        next.phone_user_response = "";
      }

      return next;
    });

    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validate = () => {
    const nextErrors = {};

    if (!formData.lead_source) {
      nextErrors.lead_source = "Lead source is required.";
    }

    if (!formData.client_name?.trim()) {
      nextErrors.client_name = "Client name is required.";
    }

    if (!formData.status) {
      nextErrors.status = "Status is required.";
    }

    if (
      formData.client_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.client_email)
    ) {
      nextErrors.client_email = "Please enter a valid email address.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitForm = (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    onSubmit(formData);
  };

  return (
    <div className="lc-modal-backdrop">
      <div className="lc-modal-card">
        <div className="lc-modal-header p-4 d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-1 fw-bold">
              {initialData?.id ? "Edit Lead" : "Add New Lead"}
            </h5>
            <div className="lc-muted" style={{ fontSize: 13 }}>
              Lead form
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm lc-btn-ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Close
          </button>
        </div>

        <form onSubmit={submitForm}>
          <div className="p-4">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="lc-label">Lead Source *</label>
                <select
                  className={`lc-select ${
                    errors.lead_source ? "lc-invalid" : ""
                  }`}
                  value={formData.lead_source}
                  onChange={(e) => setField("lead_source", e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Select lead source</option>
                  {LEAD_SOURCE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {errors.lead_source ? (
                  <div className="lc-error">{errors.lead_source}</div>
                ) : null}
              </div>

              <div className="col-md-4">
                <label className="lc-label">Client Name *</label>
                <input
                  type="text"
                  className={`lc-input ${
                    errors.client_name ? "lc-invalid" : ""
                  }`}
                  value={formData.client_name}
                  onChange={(e) => setField("client_name", e.target.value)}
                  placeholder="Enter client name"
                  disabled={submitting}
                />
                {errors.client_name ? (
                  <div className="lc-error">{errors.client_name}</div>
                ) : null}
              </div>

              <div className="col-md-4">
                <label className="lc-label">Client Email</label>
                <input
                  type="email"
                  className={`lc-input ${
                    errors.client_email ? "lc-invalid" : ""
                  }`}
                  value={formData.client_email}
                  onChange={(e) => setField("client_email", e.target.value)}
                  placeholder="Enter client email"
                  disabled={submitting}
                />
                {errors.client_email ? (
                  <div className="lc-error">{errors.client_email}</div>
                ) : null}
              </div>

              <div className="col-md-4">
                <label className="lc-label">Client Phone</label>
                <input
                  type="text"
                  className="lc-input"
                  value={formData.client_phone}
                  onChange={(e) => setField("client_phone", e.target.value)}
                  placeholder="Enter client phone"
                  disabled={submitting}
                />
              </div>

              <div className="col-md-4">
                <label className="lc-label">Name of Child</label>
                <input
                  type="text"
                  className="lc-input"
                  value={formData.child_name}
                  onChange={(e) => setField("child_name", e.target.value)}
                  placeholder="Enter child name"
                  disabled={submitting}
                />
              </div>

              <div className="col-md-4">
                <label className="lc-label">Year Group of Child</label>
                <select
                  className="lc-select"
                  value={formData.year_group}
                  onChange={(e) => setField("year_group", e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Select year group</option>
                  {YEAR_GROUP_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="lc-label">WhatsApp Message Sent</label>
                <select
                  className="lc-select"
                  value={String(formData.whatsapp_message_sent)}
                  onChange={(e) =>
                    setField("whatsapp_message_sent", e.target.value === "true")
                  }
                  disabled={submitting}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="lc-label">WhatsApp User Response</label>
                <select
                  className="lc-select"
                  value={formData.whatsapp_user_response}
                  onChange={(e) =>
                    setField("whatsapp_user_response", e.target.value)
                  }
                  disabled={submitting || !formData.whatsapp_message_sent}
                >
                  <option value="">
                    {formData.whatsapp_message_sent
                      ? "Select response"
                      : "Enable WhatsApp first"}
                  </option>
                  {USER_RESPONSE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="lc-label">Email Sent</label>
                <select
                  className="lc-select"
                  value={String(formData.email_sent)}
                  onChange={(e) =>
                    setField("email_sent", e.target.value === "true")
                  }
                  disabled={submitting}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="lc-label">Email User Response</label>
                <select
                  className="lc-select"
                  value={formData.email_user_response}
                  onChange={(e) => setField("email_user_response", e.target.value)}
                  disabled={submitting || !formData.email_sent}
                >
                  <option value="">
                    {formData.email_sent ? "Select response" : "Enable Email first"}
                  </option>
                  {USER_RESPONSE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="lc-label">Phone Call</label>
                <select
                  className="lc-select"
                  value={String(formData.phone_call)}
                  onChange={(e) =>
                    setField("phone_call", e.target.value === "true")
                  }
                  disabled={submitting}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="lc-label">Phone User Response</label>
                <select
                  className="lc-select"
                  value={formData.phone_user_response}
                  onChange={(e) => setField("phone_user_response", e.target.value)}
                  disabled={submitting || !formData.phone_call}
                >
                  <option value="">
                    {formData.phone_call ? "Select response" : "Enable Phone Call first"}
                  </option>
                  {USER_RESPONSE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="lc-label">GoStudy Member Leading</label>
                <select
                  className="lc-select"
                  value={formData.go_study_member_leading}
                  onChange={(e) =>
                    setField("go_study_member_leading", e.target.value)
                  }
                  disabled={submitting}
                >
                  <option value="">Select member</option>
                  {MEMBER_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="lc-label">Status *</label>
                <select
                  className={`lc-select ${errors.status ? "lc-invalid" : ""}`}
                  value={formData.status}
                  onChange={(e) => setField("status", e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Select status</option>
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                {errors.status ? (
                  <div className="lc-error">{errors.status}</div>
                ) : null}
              </div>

              <div className="col-12">
                <label className="lc-label">Notes</label>
                <textarea
                  rows="4"
                  className="lc-textarea"
                  value={formData.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Write notes here..."
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          <div className="p-4 pt-0 d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn lc-btn-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting
                ? initialData?.id
                  ? "Updating..."
                  : "Saving..."
                : initialData?.id
                ? "Update Lead"
                : "Save Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const LeadCentreLayer = () => {
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [memberFilter, setMemberFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState(null);
  const [error, setError] = useState("");

  const itemsPerPage = 10;

  const fetchLeads = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const token = await getToken();

      const response = await axios.post(
        GET_LEADS_API_URL,
        {
          token,
          tablename: "leads",
        },
        {
          headers,
          timeout: 30000,
        }
      );

      const responseData = response?.data;

      if (responseData?.statusCode !== 200) {
        throw new Error(responseData?.message || "Failed to fetch leads");
      }

      const apiLeads = Array.isArray(responseData?.data)
        ? responseData.data
            .map(normalizeLead)
            .filter((item) => !toBoolean(item?.is_deleted))
        : [];

      setRows(apiLeads);
    } catch (err) {
      console.error("Fetch leads error:", err);

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Something went wrong while fetching leads.";

      setError(message);

      if (!silent) {
        await Swal.fire({
          icon: "error",
          title: "Failed to Load Leads",
          text: message,
          confirmButtonText: "OK",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const createLead = async (formData) => {
    const token = await getToken();
    const payload = buildAddLeadPayload(token, formData);

    const response = await axios.post(ADD_LEAD_API_URL, payload, {
      headers,
      timeout: 30000,
    });

    const responseData = response?.data;

    if (responseData?.statusCode !== 200) {
      throw new Error(responseData?.message || "Failed to add lead");
    }

    return responseData;
  };

  const updateLead = async (leadId, formData) => {
    const token = await getToken();
    const payload = buildUpdateLeadPayload(token, leadId, formData);

    const response = await axios.post(UPDATE_LEAD_API_URL, payload, {
      headers,
      timeout: 30000,
    });

    const responseData = response?.data;

    if (responseData?.statusCode !== 200) {
      throw new Error(responseData?.message || "Failed to update lead");
    }

    return responseData;
  };

  const deleteLead = async (leadId) => {
    const token = await getToken();
    const payload = buildDeleteLeadPayload(token, leadId);

    const response = await axios.post(UPDATE_LEAD_API_URL, payload, {
      headers,
      timeout: 30000,
    });

    const responseData = response?.data;

    if (responseData?.statusCode !== 200) {
      throw new Error(responseData?.message || "Failed to delete lead");
    }

    return responseData;
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const sortedRows = useMemo(() => {
    return [...rows].sort(
      (a, b) => getSafeTime(b.created_at) - getSafeTime(a.created_at)
    );
  }, [rows]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      contactMade: rows.filter((item) => item.status === "contact_made").length,
      registered: rows.filter((item) => item.status === "client_registered")
        .length,
      booked: rows.filter(
        (item) => item.status === "client_booked_first_session"
      ).length,
    };
  }, [rows]);

  const filteredData = useMemo(() => {
    const sTerm = norm(searchTerm);
    const sf = norm(sourceFilter);
    const stf = norm(statusFilter);
    const mf = norm(memberFilter);

    return sortedRows.filter((item) => {
      if (toBoolean(item?.is_deleted)) return false;

      const fullText = [
        item.client_name,
        item.client_email,
        item.client_phone,
        item.child_name,
        item.notes,
        item.whatsapp_user_response,
        item.email_user_response,
        item.phone_user_response,
        item.lead_source,
        item.status,
        item.go_study_member_leading,
        item.year_group,
        item.created_at,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !sTerm || fullText.includes(sTerm);
      const matchesSource = !sf || norm(item.lead_source) === sf;
      const matchesStatus = !stf || norm(item.status) === stf;
      const matchesMember = !mf || norm(item.go_study_member_leading) === mf;

      return matchesSearch && matchesSource && matchesStatus && matchesMember;
    });
  }, [sortedRows, searchTerm, sourceFilter, statusFilter, memberFilter]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const indexOfLastItem = safePage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  const resetFilters = () => {
    setSearchTerm("");
    setSourceFilter("");
    setStatusFilter("");
    setMemberFilter("");
    setCurrentPage(1);
  };

  const openAddModal = () => {
    setSelectedLead(null);
    setIsModalOpen(true);
  };

  const openEditModal = (lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submittingLead) return;
    setSelectedLead(null);
    setIsModalOpen(false);
  };

  const handleRefresh = async () => {
    await fetchLeads();
  };

  const handleSaveLead = async (formData) => {
    if (submittingLead) return;

    const isEditMode = Boolean(selectedLead?.id);

    try {
      setSubmittingLead(true);
      setError("");

      Swal.fire({
        title: isEditMode ? "Updating Lead..." : "Saving Lead...",
        text: isEditMode
          ? "Please wait while the lead details are being updated."
          : "Please wait while the lead is being created.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const responseData = isEditMode
        ? await updateLead(selectedLead.id, formData)
        : await createLead(formData);

      const affectedId = responseData?.data?.id;

      await fetchLeads({ silent: true });
      setCurrentPage(1);
      closeModal();

      Swal.close();

      await Swal.fire({
        icon: "success",
        title: isEditMode
          ? "Lead Updated Successfully"
          : "Lead Created Successfully",
        text: affectedId
          ? `Record ID: ${affectedId}`
          : isEditMode
          ? "The lead has been updated successfully."
          : "The lead has been created successfully.",
        confirmButtonText: "OK",
      });
    } catch (err) {
      console.error("Save lead error:", err);

      Swal.close();

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Something went wrong while saving the lead.";

      setError(message);

      await Swal.fire({
        icon: "error",
        title: isEditMode ? "Failed to Update Lead" : "Failed to Create Lead",
        text: message,
        confirmButtonText: "OK",
      });
    } finally {
      setSubmittingLead(false);
    }
  };

  const handleDeleteLead = async (lead) => {
    const leadId = Number(lead?.id);

    if (!leadId) {
      await Swal.fire({
        icon: "error",
        title: "Invalid Lead",
        text: "Unable to delete this lead because the ID is invalid.",
        confirmButtonText: "OK",
      });
      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: "Delete Lead?",
      text: `Are you sure you want to delete ${lead?.client_name || "this lead"}?`,
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      setDeletingLeadId(leadId);
      setError("");

      Swal.fire({
        title: "Deleting Lead...",
        text: "Please wait while the lead is being deleted.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      await deleteLead(leadId);
      await fetchLeads({ silent: true });

      Swal.close();

      await Swal.fire({
        icon: "success",
        title: "Lead Deleted Successfully",
        text: "The lead has been deleted successfully.",
        confirmButtonText: "OK",
      });
    } catch (err) {
      console.error("Delete lead error:", err);

      Swal.close();

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Something went wrong while deleting the lead.";

      setError(message);

      await Swal.fire({
        icon: "error",
        title: "Failed to Delete Lead",
        text: message,
        confirmButtonText: "OK",
      });
    } finally {
      setDeletingLeadId(null);
    }
  };

  const exportToExcel = () => {
    const data = filteredData.map((item, i) => ({
      "S.L": i + 1,
      Date: formatDisplayDate(item.created_at),
      "Lead Source": getOptionLabel(LEAD_SOURCE_OPTIONS, item.lead_source),
      "Client Name": item.client_name || "-",
      "Client Email": item.client_email || "-",
      "Client Phone": item.client_phone || "-",
      "Name of Child": item.child_name || "-",
      "Year Group": getOptionLabel(YEAR_GROUP_OPTIONS, item.year_group),
      "WhatsApp Message Sent": item.whatsapp_message_sent ? "Yes" : "No",
      "WhatsApp User Response": renderUserResponse(item.whatsapp_user_response),
      "Email Sent": item.email_sent ? "Yes" : "No",
      "Email User Response": renderUserResponse(item.email_user_response),
      "Phone Call": item.phone_call ? "Yes" : "No",
      "Phone User Response": renderUserResponse(item.phone_user_response),
      "GoStudy Member Leading": getOptionLabel(
        MEMBER_OPTIONS,
        item.go_study_member_leading
      ),
      Notes: item.notes || "-",
      Status: getOptionLabel(STATUS_OPTIONS, item.status),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data, { origin: "A2" });
    XLSX.utils.sheet_add_aoa(worksheet, [["Leads Centre Report"]], {
      origin: "A1",
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
    XLSX.writeFile(workbook, "leads_centre.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF("landscape");
    doc.setFontSize(16);
    doc.text("Leads Centre Report", 14, 15);

    const columns = [
      "S.L",
      "Date",
      "Lead Source",
      "Client Name",
      "Client Email",
      "Client Phone",
      "Child Name",
      "Year Group",
      "WA Sent",
      "WA Response",
      "Email Sent",
      "Email Response",
      "Phone Call",
      "Phone Response",
      "Leading",
      "Status",
    ];

    const body = filteredData.map((item, i) => [
      i + 1,
      formatDisplayDate(item.created_at),
      getOptionLabel(LEAD_SOURCE_OPTIONS, item.lead_source),
      item.client_name || "-",
      item.client_email || "-",
      item.client_phone || "-",
      item.child_name || "-",
      getOptionLabel(YEAR_GROUP_OPTIONS, item.year_group),
      item.whatsapp_message_sent ? "Yes" : "No",
      renderUserResponse(item.whatsapp_user_response),
      item.email_sent ? "Yes" : "No",
      renderUserResponse(item.email_user_response),
      item.phone_call ? "Yes" : "No",
      renderUserResponse(item.phone_user_response),
      getOptionLabel(MEMBER_OPTIONS, item.go_study_member_leading),
      getOptionLabel(STATUS_OPTIONS, item.status),
    ]);

    autoTable(doc, {
      startY: 22,
      head: [columns],
      body,
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: "linebreak",
      },
      headStyles: {
        fontSize: 8,
        fillColor: [37, 99, 235],
      },
      margin: { left: 8, right: 8 },
      tableWidth: "auto",
    });

    doc.save("leads_centre.pdf");
  };

  return (
    <div className="lead-centre-theme">
      <style>{themeStyles}</style>

      <div className="d-flex flex-column gap-4">
        <div className="lc-card lc-hero p-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 position-relative">
            <div style={{ zIndex: 1 }}>
              <span className="lc-chip mb-3">Leads Dashboard</span>
              <h5 className="mb-1 fw-bold lc-title">Leads Centre</h5>
            </div>

            <div
              className="d-flex gap-2 flex-wrap lc-hero-actions"
              style={{ zIndex: 1 }}
            >
              <button
                className="btn btn-outline-primary"
                onClick={handleRefresh}
                disabled={loading || submittingLead || Boolean(deletingLeadId)}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>

              <button
                className="btn btn-primary"
                onClick={openAddModal}
                disabled={loading || submittingLead || Boolean(deletingLeadId)}
              >
                + Add Lead
              </button>

              <button
                className="btn btn-success"
                onClick={exportToExcel}
                disabled={loading}
              >
                Excel Export
              </button>

              <button
                className="btn btn-danger"
                onClick={exportToPDF}
                disabled={loading}
              >
                PDF Export
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="alert alert-danger mb-0">
            <div className="fw-bold mb-1">Error</div>
            <div>{error}</div>
          </div>
        ) : null}

        <div className="row g-3">
          <StatCard
            title="Total Leads"
            value={stats.total}
            icon="◎"
            subText="All active leads in the system"
            borderColor="#2563eb"
          />
          <StatCard
            title="Contact Made"
            value={stats.contactMade}
            icon="◔"
            subText="Initial contact completed"
            borderColor="#f59e0b"
          />
          <StatCard
            title="Client Registered"
            value={stats.registered}
            icon="◈"
            subText="Clients moved to registration"
            borderColor="#6366f1"
          />
          <StatCard
            title="Booked First Session"
            value={stats.booked}
            icon="✓"
            subText="Converted leads"
            borderColor="#22c55e"
          />
        </div>

        <div className="lc-card p-4">
          <div className="row g-3">
            <div className="col-lg-3 col-md-6">
              <label className="lc-label">Search</label>
              <input
                type="text"
                className="lc-input"
                placeholder="Search name, email, phone, child, notes, responses..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="col-lg-3 col-md-6">
              <label className="lc-label">Lead Source</label>
              <select
                className="lc-select"
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Sources</option>
                {LEAD_SOURCE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-lg-3 col-md-6">
              <label className="lc-label">Status</label>
              <select
                className="lc-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-lg-3 col-md-6">
              <label className="lc-label">Leading Member</label>
              <select
                className="lc-select"
                value={memberFilter}
                onChange={(e) => {
                  setMemberFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Members</option>
                {MEMBER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 d-flex justify-content-end">
              <button className="btn lc-btn-ghost" onClick={resetFilters}>
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        <div className="lc-card p-4">
          {loading ? (
            <div className="text-center py-5">Loading leads...</div>
          ) : (
            <>
              <div className="lc-table-wrap">
                <div className="lc-table-scroll">
                  <table className="table lc-table">
                    <thead>
                      <tr>
                        <th className="lc-col-sl">S.L</th>
                        <th className="lc-col-date">Date</th>
                        <th className="lc-col-source">Lead Source</th>
                        <th className="lc-col-name">Client Name</th>
                        <th className="lc-col-email">Client Email</th>
                        <th className="lc-col-phone">Client Phone</th>
                        <th className="lc-col-child">Name of Child</th>
                        <th className="lc-col-year">Year Group</th>
                        <th className="lc-col-flag">WhatsApp</th>
                        <th className="lc-col-response">WA Response</th>
                        <th className="lc-col-flag">Email</th>
                        <th className="lc-col-response">Email Response</th>
                        <th className="lc-col-flag">Phone Call</th>
                        <th className="lc-col-response">Phone Response</th>
                        <th className="lc-col-member">Leading Member</th>
                        <th className="lc-col-notes">Notes</th>
                        <th className="lc-col-status">Status</th>
                        <th className="lc-col-actions">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {currentItems.length === 0 ? (
                        <tr>
                          <td colSpan={18} className="text-center py-4">
                            No lead records found.
                          </td>
                        </tr>
                      ) : (
                        currentItems.map((item, index) => (
                          <tr key={String(item.id)}>
                            <td className="lc-col-sl lc-nowrap">
                              {indexOfFirstItem + index + 1}
                            </td>

                            <td className="lc-col-date lc-nowrap">
                              {formatDisplayDate(item.created_at)}
                            </td>

                            <td className="lc-col-source lc-nowrap">
                              <span className={getSourceClass(item.lead_source)}>
                                {getOptionLabel(
                                  LEAD_SOURCE_OPTIONS,
                                  item.lead_source
                                )}
                              </span>
                            </td>

                            <td className="lc-col-name lc-wrap fw-semibold">
                              {item.client_name || "-"}
                            </td>

                            <td className="lc-col-email lc-nowrap">
                              {item.client_email || "-"}
                            </td>

                            <td className="lc-col-phone lc-nowrap">
                              {item.client_phone || "-"}
                            </td>

                            <td className="lc-col-child lc-wrap">
                              {item.child_name || "-"}
                            </td>

                            <td className="lc-col-year lc-wrap">
                              {getOptionLabel(
                                YEAR_GROUP_OPTIONS,
                                item.year_group
                              )}
                            </td>

                            <td className="lc-col-flag">
                              <span
                                className={getYesNoClass(
                                  item.whatsapp_message_sent
                                )}
                              >
                                {item.whatsapp_message_sent ? "Yes" : "No"}
                              </span>
                            </td>

                            <td className="lc-col-response lc-wrap">
                              {renderUserResponse(item.whatsapp_user_response)}
                            </td>

                            <td className="lc-col-flag">
                              <span className={getYesNoClass(item.email_sent)}>
                                {item.email_sent ? "Yes" : "No"}
                              </span>
                            </td>

                            <td className="lc-col-response lc-wrap">
                              {renderUserResponse(item.email_user_response)}
                            </td>

                            <td className="lc-col-flag">
                              <span className={getYesNoClass(item.phone_call)}>
                                {item.phone_call ? "Yes" : "No"}
                              </span>
                            </td>

                            <td className="lc-col-response lc-wrap">
                              {renderUserResponse(item.phone_user_response)}
                            </td>

                            <td className="lc-col-member lc-nowrap">
                              {item.go_study_member_leading
                                ? getOptionLabel(
                                    MEMBER_OPTIONS,
                                    item.go_study_member_leading
                                  )
                                : "-"}
                            </td>

                            <td className="lc-col-notes">
                              <span
                                className="lc-note-text"
                                title={item.notes || ""}
                              >
                                {item.notes || "-"}
                              </span>
                            </td>

                            <td className="lc-col-status lc-nowrap">
                              <span className={getStatusClass(item.status)}>
                                {getOptionLabel(STATUS_OPTIONS, item.status)}
                              </span>
                            </td>

                            <td className="lc-col-actions">
                              <div className="d-flex gap-2">
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => openEditModal(item)}
                                  disabled={Boolean(deletingLeadId)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleDeleteLead(item)}
                                  disabled={
                                    deletingLeadId === item.id ||
                                    submittingLead ||
                                    loading
                                  }
                                >
                                  {deletingLeadId === item.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mt-4">
                <span className="lc-muted">
                  Showing {filteredData.length === 0 ? 0 : indexOfFirstItem + 1}{" "}
                  to {Math.min(indexOfLastItem, filteredData.length)} of{" "}
                  {filteredData.length} entries
                </span>

                <ul className="pagination mb-0 lc-pagination">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <li
                      key={i}
                      className={`page-item ${
                        safePage === i + 1 ? "active" : ""
                      }`}
                    >
                      <button
                        onClick={() => setCurrentPage(i + 1)}
                        className="page-link"
                        type="button"
                      >
                        {i + 1}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      <LeadFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleSaveLead}
        initialData={selectedLead}
        submitting={submittingLead}
      />
    </div>
  );
};

export default LeadCentreLayer;