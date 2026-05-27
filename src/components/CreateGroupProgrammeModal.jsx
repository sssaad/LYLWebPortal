import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { Icon } from "@iconify/react";
import { getToken } from "../api/getToken";

const RUN_STORED_PROCEDURE_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const ADD_DYNAMIC_DATA_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=add_dynamic_data";

const UPDATE_DYNAMIC_DATA_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const API_HEADERS = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

const PROGRAMME_STATUS_OPTIONS = ["active", "inactive"];

const emptyForm = {
  id: "",
  name: "",
  description: "",
  stage: "",
  capacity: 10,
  weekly_price: "300.00",
  status: "active",
};

const resolveToken = (tokenRes) => {
  if (typeof tokenRes === "string") return tokenRes;

  return (
    tokenRes?.token ||
    tokenRes?.data?.token ||
    tokenRes?.data?.data?.token ||
    tokenRes?.access_token ||
    tokenRes?.data?.access_token ||
    ""
  );
};

const extractRows = (response) => {
  const candidates = [
    response,
    response?.data,
    response?.data?.data,
    response?.result,
    response?.data?.result,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
};

const shortText = (text, limit = 150) => {
  const value = String(text || "").trim();
  if (!value) return "No description added.";
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}...`;
};

const CreateGroupProgrammeModal = ({ open, onClose, onSuccess }) => {
  const [programmes, setProgrammes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingProgramme, setEditingProgramme] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildHeaders = async () => {
    const tokenRes = await getToken();
    const token = resolveToken(tokenRes);

    return {
      ...API_HEADERS,
      ...(token ? { token } : {}),
    };
  };

  const getTokenValue = async () => {
    const tokenRes = await getToken();
    return resolveToken(tokenRes);
  };

  const fetchProgrammes = useCallback(async () => {
    setLoading(true);

    try {
      const headers = await buildHeaders();

      const response = await axios.post(
        RUN_STORED_PROCEDURE_URL,
        {
          procedureName: "sp_get_group_programmes",
          parameters: [],
        },
        { headers }
      );

      if (Number(response?.data?.statusCode) !== 200) {
        throw new Error(
          response?.data?.message || "Group programmes load failed."
        );
      }

      const list = extractRows(response.data);
      setProgrammes(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Group programmes load failed:", error);
      setProgrammes([]);

      Swal.fire({
        icon: "error",
        title: "Load Failed",
        text: error?.message || "Group programmes load failed.",
        customClass: {
          container: "gp-swal-container",
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setEditingProgramme(null);
      setForm(emptyForm);
      setSearchTerm("");
      setStatusFilter("");
      fetchProgrammes();
    }
  }, [open, fetchProgrammes]);

  const filteredProgrammes = useMemo(() => {
    const search = String(searchTerm || "").toLowerCase().trim();
    const status = String(statusFilter || "").toLowerCase().trim();

    return (programmes || []).filter((item) => {
      const fullText = [
        item?.name,
        item?.description,
        item?.stage,
        item?.weekly_price,
        item?.capacity,
        item?.status,
      ]
        .join(" ")
        .toLowerCase();

      const itemStatus = String(item?.status || "").toLowerCase();

      return (
        (!search || fullText.includes(search)) &&
        (!status || itemStatus === status)
      );
    });
  }, [programmes, searchTerm, statusFilter]);

  if (!open) return null;

  const handleClose = () => {
    if (saving) return;

    setEditingProgramme(null);
    setForm(emptyForm);
    onClose?.();
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const startAdd = () => {
    setEditingProgramme(null);
    setForm(emptyForm);
  };

  const startEdit = (item) => {
    setEditingProgramme(item);

    setForm({
      id: item?.id || "",
      name: item?.name || "",
      description: item?.description || "",
      stage: item?.stage || "",
      capacity: item?.capacity || 10,
      weekly_price:
        item?.weekly_price !== undefined && item?.weekly_price !== null
          ? String(item.weekly_price)
          : "300.00",
      status: item?.status || "active",
    });
  };

  const validateForm = () => {
    const name = String(form.name || "").trim();
    const description = String(form.description || "").trim();
    const stage = String(form.stage || "").trim();
    const capacity = Number(form.capacity || 0);
    const weeklyPrice = Number(form.weekly_price || 0);
    const status = String(form.status || "active").trim();

    if (!name) return "Programme name is required.";
    if (!description) return "Description is required.";
    if (!stage) return "Stage is required.";
    if (!capacity || capacity < 1) return "Capacity must be greater than 0.";
    if (Number.isNaN(weeklyPrice) || weeklyPrice < 0) {
      return "Weekly price is invalid.";
    }
    if (!PROGRAMME_STATUS_OPTIONS.includes(status)) return "Status is invalid.";

    return "";
  };

  const buildPayload = () => ({
    name: String(form.name || "").trim(),
    description: String(form.description || "").trim(),
    stage: String(form.stage || "").trim(),
    capacity: Number(form.capacity || 0),
    weekly_price: Number(form.weekly_price || 0).toFixed(2),
    status: String(form.status || "active").trim(),
  });

  // IMPORTANT:
  // add_dynamic_data direct fields leta hai.
  // insertdata: [data] nahi bhejna, warna API name/description/stage missing error deti hai.
  const addProgramme = async (token, data) => {
    const payload = {
      tablename: "group_programmes",
      name: data.name,
      description: data.description,
      stage: data.stage,
      capacity: data.capacity,
      weekly_price: data.weekly_price,
      status: data.status,
    };

    console.log("GROUP PROGRAMME ADD PAYLOAD =>", payload);

    const response = await axios.post(ADD_DYNAMIC_DATA_URL, payload, {
      headers: {
        ...API_HEADERS,
        token,
      },
    });

    if (
      Number(response?.data?.statusCode) === 400 ||
      Number(response?.data?.statusCode) === 401 ||
      Number(response?.data?.statusCode) === 403 ||
      Number(response?.data?.statusCode) === 500 ||
      response?.data?.error
    ) {
      throw new Error(response?.data?.message || "Programme add failed.");
    }

    return response.data;
  };

  // Update API ka existing project pattern same rakha hai.
  const updateProgramme = async (token, programmeId, data) => {
    const payload = {
      token,
      tablename: "group_programmes",
      conditions: [
        {
          id: Number(programmeId),
        },
      ],
      updatedata: [data],
    };

    console.log("GROUP PROGRAMME UPDATE PAYLOAD =>", payload);

    const response = await axios.post(UPDATE_DYNAMIC_DATA_URL, payload, {
      headers: API_HEADERS,
    });

    if (
      Number(response?.data?.statusCode) === 400 ||
      Number(response?.data?.statusCode) === 401 ||
      Number(response?.data?.statusCode) === 403 ||
      Number(response?.data?.statusCode) === 500 ||
      response?.data?.error
    ) {
      throw new Error(response?.data?.message || "Programme update failed.");
    }

    return response.data;
  };

  const handleSave = async () => {
    const error = validateForm();

    if (error) {
      Swal.fire({
        icon: "warning",
        title: "Validation Required",
        text: error,
        customClass: {
          container: "gp-swal-container",
        },
      });
      return;
    }

    const isEdit = !!editingProgramme?.id;
    const payload = buildPayload();

    const confirmResult = await Swal.fire({
      icon: isEdit ? "question" : "info",
      title: isEdit ? "Update Programme?" : "Create Group Programme?",
      text: isEdit
        ? "Are you sure you want to update this programme?"
        : "Are you sure you want to create this group programme?",
      showCancelButton: true,
      confirmButtonText: isEdit ? "Yes, Update" : "Yes, Create",
      cancelButtonText: "Cancel",
      confirmButtonColor: isEdit ? "#0d6efd" : "#198754",
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
      customClass: {
        container: "gp-swal-container",
      },
    });

    if (!confirmResult.isConfirmed) return;

    setSaving(true);

    try {
      const token = await getTokenValue();

      if (!token) {
        throw new Error("Token not found.");
      }

      if (isEdit) {
        await updateProgramme(token, editingProgramme.id, payload);
      } else {
        await addProgramme(token, payload);
      }

      await Swal.fire({
        icon: "success",
        title: isEdit ? "Updated Successfully" : "Created Successfully",
        text: isEdit
          ? "Programme has been updated successfully."
          : "Group programme has been created successfully.",
        timer: 1600,
        timerProgressBar: true,
        customClass: {
          container: "gp-swal-container",
        },
      });

      setEditingProgramme(null);
      setForm(emptyForm);

      await fetchProgrammes();
      onSuccess?.();
    } catch (error) {
      console.error("Programme save failed:", error);

      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: error?.message || "Something went wrong while saving programme.",
        customClass: {
          container: "gp-swal-container",
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async (item) => {
    if (!item?.id) {
      Swal.fire({
        icon: "error",
        title: "Missing ID",
        text: "Programme ID not found.",
        customClass: {
          container: "gp-swal-container",
        },
      });
      return;
    }

    const confirmResult = await Swal.fire({
      icon: "warning",
      title: "Delete Programme?",
      html: `
        <div style="line-height:1.7;">
          <div>This will delete the programme from the portal list.</div>
          <div style="margin-top:10px;">
            <strong>Programme:</strong> ${item?.name || "-"}
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
      customClass: {
        container: "gp-swal-container",
      },
    });

    if (!confirmResult.isConfirmed) return;

    setSaving(true);

    try {
      const token = await getTokenValue();

      if (!token) {
        throw new Error("Token not found.");
      }

      await updateProgramme(token, item.id, {
        deleted: 1,
        status: "inactive",
      });

      await Swal.fire({
        icon: "success",
        title: "Deleted Successfully",
        text: "Programme has been soft deleted successfully.",
        timer: 1600,
        timerProgressBar: true,
        customClass: {
          container: "gp-swal-container",
        },
      });

      if (String(editingProgramme?.id) === String(item.id)) {
        setEditingProgramme(null);
        setForm(emptyForm);
      }

      await fetchProgrammes();
      onSuccess?.();
    } catch (error) {
      console.error("Programme delete failed:", error);

      Swal.fire({
        icon: "error",
        title: "Delete Failed",
        text: error?.message || "Something went wrong while deleting programme.",
        customClass: {
          container: "gp-swal-container",
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!editingProgramme?.id;

  return (
    <div
      className="gp-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      onClick={handleClose}
    >
      <style>{`
        .gp-overlay {
          background:
            radial-gradient(circle at top left, rgba(13, 110, 253, 0.18), transparent 34%),
            radial-gradient(circle at bottom right, rgba(25, 135, 84, 0.14), transparent 32%),
            rgba(2, 6, 23, 0.82);
          z-index: 2400;
          padding: 18px;
          backdrop-filter: blur(8px);
        }

        .gp-modal {
          width: min(1240px, 98vw);
          max-height: 94vh;
          overflow: hidden;
          border-radius: 26px;
          background: #1f2d40;
          color: #ffffff;
          border: 1px solid rgba(148, 163, 184, 0.24);
          box-shadow: 0 35px 100px rgba(0, 0, 0, 0.58);
        }

        .gp-modal-header {
          padding: 22px 24px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          background:
            linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 45, 64, 0.98)),
            linear-gradient(135deg, rgba(13, 110, 253, 0.18), rgba(25, 135, 84, 0.14));
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .gp-title-wrap {
          display: flex;
          gap: 14px;
          align-items: center;
        }

        .gp-title-icon {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #198754, #0dcaf0);
          color: #ffffff;
          font-size: 25px;
          box-shadow: 0 12px 28px rgba(13, 202, 240, 0.20);
          flex: 0 0 auto;
        }

        .gp-modal-title {
          margin: 0;
          font-size: 28px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.5px;
          line-height: 1.2;
        }

        .gp-modal-subtitle {
          margin-top: 6px;
          color: #b8c4d6;
          font-size: 14px;
          font-weight: 600;
        }

        .gp-close-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(15, 23, 42, 0.45);
          color: #dbe4f0;
          font-size: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          line-height: 1;
          transition: all 0.18s ease;
        }

        .gp-close-icon:hover {
          background: rgba(239, 68, 68, 0.18);
          border-color: rgba(239, 68, 68, 0.55);
          color: #ffffff;
          transform: translateY(-1px);
        }

        .gp-modal-body {
          max-height: calc(94vh - 94px);
          overflow-y: auto;
          padding: 24px;
          background: #223147;
        }

        .gp-modal-body::-webkit-scrollbar {
          width: 8px;
        }

        .gp-modal-body::-webkit-scrollbar-track {
          background: #162235;
        }

        .gp-modal-body::-webkit-scrollbar-thumb {
          background: #64748b;
          border-radius: 999px;
        }

        .gp-form-card,
        .gp-list-card {
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 22px;
          background: linear-gradient(180deg, rgba(30, 43, 62, 0.98), rgba(24, 35, 52, 0.98));
          overflow: hidden;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
        }

        .gp-card-head {
          padding: 16px 18px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(15, 23, 42, 0.42);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .gp-card-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 900;
        }

        .gp-card-title svg {
          font-size: 21px;
        }

        .gp-card-body {
          padding: 18px;
        }

        .gp-label {
          color: #cbd5e1;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 7px;
        }

        .gp-input,
        .gp-select,
        .gp-textarea {
          background: #111827 !important;
          border: 1px solid rgba(148, 163, 184, 0.34) !important;
          color: #ffffff !important;
          border-radius: 14px !important;
          min-height: 44px;
          font-weight: 650;
        }

        .gp-textarea {
          min-height: 118px;
          resize: vertical;
          line-height: 1.65;
        }

        .gp-input::placeholder,
        .gp-textarea::placeholder {
          color: #8190a6 !important;
        }

        .gp-input:focus,
        .gp-select:focus,
        .gp-textarea:focus {
          box-shadow: 0 0 0 0.22rem rgba(13, 110, 253, 0.18) !important;
          border-color: rgba(59, 130, 246, 0.9) !important;
        }

        .gp-submit-btn {
          border-radius: 14px;
          min-height: 46px;
          font-weight: 900;
          box-shadow: 0 12px 28px rgba(25, 135, 84, 0.22);
        }

        .gp-note {
          margin-top: 13px;
          color: #aebdd0;
          font-size: 12px;
          line-height: 1.6;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .gp-filter-row {
          display: grid;
          grid-template-columns: 1fr 170px auto;
          gap: 10px;
          margin-bottom: 16px;
        }

        .gp-list-scroll {
          max-height: 590px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .gp-list-scroll::-webkit-scrollbar {
          width: 7px;
        }

        .gp-list-scroll::-webkit-scrollbar-track {
          background: #162235;
          border-radius: 999px;
        }

        .gp-list-scroll::-webkit-scrollbar-thumb {
          background: #64748b;
          border-radius: 999px;
        }

        .gp-programme-card {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 18px;
          padding: 16px;
          background:
            linear-gradient(135deg, rgba(15, 23, 42, 0.58), rgba(30, 41, 59, 0.42));
          transition: all 0.18s ease;
          margin-bottom: 12px;
        }

        .gp-programme-card:hover {
          border-color: rgba(13, 202, 240, 0.42);
          transform: translateY(-1px);
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.22);
        }

        .gp-programme-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .gp-programme-name {
          color: #ffffff;
          font-size: 17px;
          font-weight: 950;
          line-height: 1.3;
          margin-bottom: 7px;
        }

        .gp-programme-desc {
          color: #b9c7da;
          font-size: 13px;
          line-height: 1.65;
          margin: 0;
        }

        .gp-status-badge {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .gp-status-active {
          background: rgba(25, 135, 84, 0.18);
          color: #63e6a0;
          border: 1px solid rgba(25, 135, 84, 0.32);
        }

        .gp-status-inactive {
          background: rgba(148, 163, 184, 0.16);
          color: #cbd5e1;
          border: 1px solid rgba(148, 163, 184, 0.24);
        }

        .gp-meta-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .gp-meta-box {
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.46);
          border: 1px solid rgba(148, 163, 184, 0.14);
          padding: 10px 12px;
          min-width: 0;
        }

        .gp-meta-label {
          color: #8fa3bd;
          font-size: 11px;
          font-weight: 850;
          margin-bottom: 4px;
        }

        .gp-meta-value {
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .gp-action-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .gp-action-btn {
          border-radius: 12px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .gp-empty {
          border: 1px dashed rgba(148, 163, 184, 0.28);
          border-radius: 18px;
          padding: 42px 18px;
          text-align: center;
          color: #aebdd0;
          background: rgba(15, 23, 42, 0.26);
        }

        .gp-empty-icon {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          margin: 0 auto 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(13, 110, 253, 0.15);
          color: #7db4ff;
          font-size: 30px;
        }

        .gp-swal-container,
        .swal2-container {
          z-index: 3000 !important;
        }

        @media (max-width: 1199px) {
          .gp-meta-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 991px) {
          .gp-modal-title {
            font-size: 23px;
          }

          .gp-title-icon {
            width: 42px;
            height: 42px;
            font-size: 22px;
          }

          .gp-filter-row {
            grid-template-columns: 1fr;
          }

          .gp-list-scroll {
            max-height: none;
          }
        }

        @media (max-width: 575px) {
          .gp-overlay {
            padding: 10px;
          }

          .gp-modal {
            border-radius: 18px;
          }

          .gp-modal-header,
          .gp-modal-body {
            padding: 16px;
          }

          .gp-title-wrap {
            align-items: flex-start;
          }

          .gp-meta-grid {
            grid-template-columns: 1fr;
          }

          .gp-programme-top {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="gp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gp-modal-header">
          <div className="gp-title-wrap">
            <div className="gp-title-icon">
              <Icon icon="mdi:playlist-plus" />
            </div>

            <div>
              <h3 className="gp-modal-title">Create Group Programme</h3>
              <div className="gp-modal-subtitle">
                Manage programme records with add, update and delete.
              </div>
            </div>
          </div>

          <button
            type="button"
            className="gp-close-icon"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="gp-modal-body">
          <div className="row g-4">
            <div className="col-xl-5">
              <div className="gp-form-card">
                <div className="gp-card-head">
                  <div className="gp-card-title">
                    <Icon
                      icon={isEdit ? "mdi:pencil-outline" : "mdi:plus-circle"}
                    />
                    <span>
                      {isEdit ? "Update Programme" : "Create Programme"}
                    </span>
                  </div>

                  {isEdit ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-light"
                      onClick={startAdd}
                      disabled={saving}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="gp-card-body">
                  <div className="mb-3">
                    <div className="gp-label">Programme Name</div>
                    <input
                      type="text"
                      className="form-control gp-input"
                      placeholder="e.g. KS4 Mastery"
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <div className="gp-label">Stage</div>
                    <input
                      type="text"
                      className="form-control gp-input"
                      placeholder="e.g. GCSE Exam Preparation"
                      value={form.stage}
                      onChange={(e) => handleChange("stage", e.target.value)}
                    />
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <div className="gp-label">Capacity</div>
                        <input
                          type="number"
                          min="1"
                          className="form-control gp-input"
                          value={form.capacity}
                          onChange={(e) =>
                            handleChange("capacity", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="mb-3">
                        <div className="gp-label">Weekly Price</div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control gp-input"
                          value={form.weekly_price}
                          onChange={(e) =>
                            handleChange("weekly_price", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="gp-label">Status</div>
                    <select
                      className="form-select gp-select"
                      value={form.status}
                      onChange={(e) => handleChange("status", e.target.value)}
                    >
                      {PROGRAMME_STATUS_OPTIONS.map((status) => (
                        <option value={status} key={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <div className="gp-label">Description</div>
                    <textarea
                      className="form-control gp-textarea"
                      placeholder="Write programme description..."
                      value={form.description}
                      onChange={(e) =>
                        handleChange("description", e.target.value)
                      }
                    />
                  </div>

                  <button
                    type="button"
                    className={`btn ${isEdit ? "btn-primary" : "btn-success"
                      } w-100 gp-submit-btn`}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />
                        Saving...
                      </>
                    ) : isEdit ? (
                      "Update Programme"
                    ) : (
                      "Create Group Programme"
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="col-xl-7">
              <div className="gp-list-card">
                <div className="gp-card-head">
                  <div className="gp-card-title">
                    <Icon icon="mdi:format-list-bulleted" />
                    <span>Programme List</span>
                  </div>
                </div>

                <div className="gp-card-body">
                  <div className="gp-filter-row">
                    <input
                      type="text"
                      className="form-control gp-input"
                      placeholder="Search programme..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    <select
                      className="form-select gp-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>

                    <button
                      type="button"
                      className="btn btn-outline-light"
                      onClick={() => {
                        setSearchTerm("");
                        setStatusFilter("");
                      }}
                      disabled={saving}
                    >
                      Reset
                    </button>
                  </div>

                  {loading ? (
                    <div className="py-5 text-center">
                      <div
                        className="spinner-border text-primary"
                        role="status"
                      />
                      <div className="mt-2 text-secondary-light">
                        Loading programmes...
                      </div>
                    </div>
                  ) : filteredProgrammes.length === 0 ? (
                    <div className="gp-empty">
                      <div className="gp-empty-icon">
                        <Icon icon="mdi:playlist-remove" />
                      </div>
                      <div className="fw-bold">No programmes found</div>
                      <div className="mt-1">
                        Create a new programme or clear filters.
                      </div>
                    </div>
                  ) : (
                    <div className="gp-list-scroll">
                      {filteredProgrammes.map((item) => {
                        const status = String(
                          item?.status || "active"
                        ).toLowerCase();

                        return (
                          <div className="gp-programme-card" key={item.id}>
                            <div className="gp-programme-top">
                              <div>
                                <div className="gp-programme-name">
                                  {item.name || "-"}
                                </div>

                                <p className="gp-programme-desc">
                                  {shortText(item.description, 180)}
                                </p>
                              </div>

                              <span
                                className={`gp-status-badge ${status === "active"
                                    ? "gp-status-active"
                                    : "gp-status-inactive"
                                  }`}
                              >
                                {status}
                              </span>
                            </div>

                            <div className="gp-meta-grid">
                              <div className="gp-meta-box">
                                <div className="gp-meta-label">Stage</div>
                                <div className="gp-meta-value">
                                  {item.stage || "-"}
                                </div>
                              </div>

                              <div className="gp-meta-box">
                                <div className="gp-meta-label">Weekly Fee</div>
                                <div className="gp-meta-value">
                                  AED{" "}
                                  {Number(item.weekly_price || 0).toFixed(2)}
                                </div>
                              </div>

                              <div className="gp-meta-box">
                                <div className="gp-meta-label">Capacity</div>
                                <div className="gp-meta-value">
                                  {item.capacity || "-"}
                                </div>
                              </div>
                            </div>

                            <div className="gp-action-row">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm gp-action-btn"
                                onClick={() => startEdit(item)}
                                disabled={saving}
                              >
                                <Icon icon="mdi:pencil-outline" />
                                Edit
                              </button>

                              <button
                                type="button"
                                className="btn btn-danger btn-sm gp-action-btn"
                                onClick={() => handleSoftDelete(item)}
                                disabled={saving}
                              >
                                <Icon icon="mdi:trash-can-outline" />
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupProgrammeModal;