import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import { getToken } from "../api/getToken";

const RUN_STORED_PROCEDURE_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const INSERT_DYNAMIC_DATA_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=insert_dynamic_data";

const TEACHER_PROFILE_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=teacher_profile";

const API_HEADERS = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

const PROGRAMME_PROCEDURE = "get_portal_programmes";
const TEACHER_PROCEDURE = "GetAllTeachers";

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

const getArrayFromResponse = (res) => {
  const candidates = [
    res,
    res?.data,
    res?.data?.data,
    res?.data?.result,
    res?.result,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
};

const formatTimeForDb = (value) => {
  if (!value) return "";
  const parsed = moment(value, ["HH:mm", "HH:mm:ss"], true);
  return parsed.isValid() ? parsed.format("HH:mm:ss") : "";
};

const getProgrammeId = (item) => item?.id ?? item?.programme_id;

const getTeacherId = (item) => item?.userid ?? item?.id;

const getTeacherName = (item) =>
  item?.fullname ||
  [item?.firstname, item?.lastname].filter(Boolean).join(" ") ||
  item?.name ||
  "";

const getSubjectId = (item) => item?.subjectid ?? item?.id ?? item?.value;

const getSubjectName = (item) =>
  item?.subjectname || item?.name || item?.label || "";

const makeEmptyClass = (index) => ({
  class_no: index + 1,
  subjectid: "",
  teacherid: "",
  session_date: "",
  slot_start: "",
  slot_end: "",
  title: "",
  subjectOptions: [],
  subjectLoading: false,
  subjectError: "",
});

const CreateLiveGroupModal = ({ isOpen, onClose, onSuccess }) => {
  const [programmes, setProgrammes] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [form, setForm] = useState({
    programme_id: "",
    capacity: "10",
    status: "active",
  });

  const [classes, setClasses] = useState([
    makeEmptyClass(0),
    makeEmptyClass(1),
    makeEmptyClass(2),
  ]);

  const [loading, setLoading] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const selectedProgramme = useMemo(() => {
    return programmes.find(
      (p) => String(getProgrammeId(p)) === String(form.programme_id)
    );
  }, [programmes, form.programme_id]);

  const selectedProgrammeName = selectedProgramme?.name || "";

  const buildHeadersWithToken = async () => {
    const tokenRes = await getToken();
    const token = resolveToken(tokenRes);

    return {
      ...API_HEADERS,
      ...(token ? { token } : {}),
    };
  };

  const runStoredProcedure = async (procedureName, parameters = []) => {
    const headers = await buildHeadersWithToken();

    const response = await axios.post(
      RUN_STORED_PROCEDURE_URL,
      {
        procedureName,
        ...(parameters?.length ? { parameters } : {}),
      },
      { headers }
    );

    if (Number(response?.data?.statusCode) !== 200) {
      throw new Error(response?.data?.message || `${procedureName} failed`);
    }

    return getArrayFromResponse(response.data);
  };

  const loadLookups = async () => {
    setLookupsLoading(true);
    setError("");

    try {
      const [programmeRows, teacherRows] = await Promise.all([
        runStoredProcedure(PROGRAMME_PROCEDURE),
        runStoredProcedure(TEACHER_PROCEDURE),
      ]);

      setProgrammes(programmeRows || []);
      setTeachers(teacherRows || []);
    } catch (err) {
      console.error("Create live group lookup failed:", err);
      setError(err?.message || "Dropdown data load nahi hua.");
    } finally {
      setLookupsLoading(false);
    }
  };

  const resetModalState = () => {
    setError("");
    setSuccessMsg("");

    setForm({
      programme_id: "",
      capacity: "10",
      status: "active",
    });

    setClasses([makeEmptyClass(0), makeEmptyClass(1), makeEmptyClass(2)]);
  };

  useEffect(() => {
    if (!isOpen) return;

    resetModalState();
    loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!selectedProgramme) return;

    setForm((prev) => ({
      ...prev,
      capacity: String(
        selectedProgramme?.capacity ??
          selectedProgramme?.class_capacity ??
          prev.capacity ??
          "10"
      ),
    }));

    setClasses((prev) =>
      prev.map((item, index) => {
        if (item.title) return item;

        const subject = (item?.subjectOptions || []).find(
          (s) => String(getSubjectId(s)) === String(item.subjectid)
        );

        const subjectName = getSubjectName(subject);

        return {
          ...item,
          title:
            selectedProgramme?.name && subjectName
              ? `${selectedProgramme.name} - ${subjectName}`
              : "",
        };
      })
    );
  }, [selectedProgramme]);

  const setField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateClass = (index, key, value) => {
    setClasses((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        return {
          ...item,
          [key]: value,
        };
      })
    );
  };

  const setClassPatch = (index, patch) => {
    setClasses((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        return {
          ...item,
          ...patch,
        };
      })
    );
  };

  const normalizeTeacherSubjects = (profileData) => {
    const subjArr = Array.isArray(profileData?.teachingprofile_subjects)
      ? profileData.teachingprofile_subjects
      : [];

    const uniq = new Map();

    for (const s of subjArr) {
      const sid = String(s?.subjectid ?? s?.id ?? "").trim();
      if (!sid) continue;

      const label =
        String(s?.subjectname || s?.name || "").trim() || `Subject ${sid}`;

      if (!uniq.has(sid)) {
        uniq.set(sid, {
          subjectid: sid,
          subjectname: label,
        });
      }
    }

    return Array.from(uniq.values());
  };

  const getSubjectByClassItem = (classItem) => {
    return (classItem?.subjectOptions || []).find(
      (s) => String(getSubjectId(s)) === String(classItem.subjectid)
    );
  };

  const buildSessionTitle = (classItem, index) => {
    const subject = getSubjectByClassItem(classItem);
    const subjectName = getSubjectName(subject);

    return [
      selectedProgrammeName || "Group Programme",
      subjectName || `Class ${index + 1}`,
    ]
      .filter(Boolean)
      .join(" - ");
  };

  const fetchTeacherSubjectsForClass = async (index, teacherid) => {
    if (!teacherid) {
      setClassPatch(index, {
        teacherid: "",
        subjectid: "",
        title: "",
        subjectOptions: [],
        subjectLoading: false,
        subjectError: "",
      });
      return;
    }

    setClassPatch(index, {
      teacherid,
      subjectid: "",
      title: "",
      subjectOptions: [],
      subjectLoading: true,
      subjectError: "",
    });

    try {
      const headers = await buildHeadersWithToken();

      const response = await axios.post(
        TEACHER_PROFILE_URL,
        {
          teacherid: String(teacherid),
        },
        { headers }
      );

      if (Number(response?.data?.statusCode) !== 200) {
        throw new Error(
          response?.data?.message || "Teacher profile load nahi hua."
        );
      }

      const profileData = response?.data?.data || {};
      const subjectOptions = normalizeTeacherSubjects(profileData);

      const firstSubject = subjectOptions?.[0] || null;
      const firstSubjectId = firstSubject
        ? String(getSubjectId(firstSubject))
        : "";

      setClassPatch(index, {
        subjectOptions,
        subjectLoading: false,
        subjectError: subjectOptions.length
          ? ""
          : "Is teacher ke subjects nahi milay.",
        subjectid: firstSubjectId,
        title: "",
      });
    } catch (err) {
      console.error("Teacher subjects load failed:", err);

      setClassPatch(index, {
        subjectOptions: [],
        subjectLoading: false,
        subjectError: err?.message || "Teacher subjects load nahi huay.",
        subjectid: "",
        title: "",
      });
    }
  };

  const handleTeacherChange = (index, teacherid) => {
    fetchTeacherSubjectsForClass(index, teacherid);
  };

  const handleSubjectChange = (index, subjectid) => {
    setClasses((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        return {
          ...item,
          subjectid,
          title: "",
        };
      })
    );
  };

  const getTeacherById = (teacherid) =>
    teachers.find((t) => String(getTeacherId(t)) === String(teacherid));

  const validateForm = () => {
    if (!form.programme_id) return "Programme select karo.";

    const cap = Number(form.capacity);
    if (!Number.isFinite(cap) || cap <= 0) {
      return "Capacity valid number honi chahiye.";
    }

    if (!classes || classes.length !== 3) {
      return "Programme mein exactly 3 classes honi chahiye.";
    }

    for (let i = 0; i < classes.length; i += 1) {
      const item = classes[i];
      const label = `Class ${i + 1}`;

      if (!item.teacherid) return `${label}: Teacher select karo.`;
      if (item.subjectLoading) return `${label}: Subject loading ho raha hai.`;

      if (item.subjectError && !item.subjectOptions?.length) {
        return `${label}: ${item.subjectError}`;
      }

      if (!item.subjectid) return `${label}: Subject select karo.`;
      if (!item.session_date) return `${label}: Session date select karo.`;
      if (!item.slot_start) return `${label}: Start time select karo.`;
      if (!item.slot_end) return `${label}: End time select karo.`;

      const start = moment(item.slot_start, "HH:mm", true);
      const end = moment(item.slot_end, "HH:mm", true);

      if (!start.isValid()) return `${label}: Start time invalid hai.`;
      if (!end.isValid()) return `${label}: End time invalid hai.`;

      if (!end.isAfter(start)) {
        return `${label}: End time start time ke baad honi chahiye.`;
      }
    }

    return "";
  };

  const buildInsertRows = () => {
    return classes.map((item, index) => {
      return {
        programme_id: Number(form.programme_id),
        title: item.title || buildSessionTitle(item, index),
        subjectid: Number(item.subjectid),
        teacherid: Number(item.teacherid),
        session_date: item.session_date,
        slot_start: formatTimeForDb(item.slot_start),
        slot_end: formatTimeForDb(item.slot_end),
        capacity: Number(form.capacity || 10),

        classid: "",
        roomid: "",
        classhostlink: "",
        classcommonlink: "",

        status: form.status || "active",
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const tokenRes = await getToken();
      const token = resolveToken(tokenRes);

      if (!token) {
        throw new Error("Token nahi mila.");
      }

      const insertRows = buildInsertRows();

      const payload = {
        token,
        tablename: "group_live_sessions",
        insertdata: insertRows,
      };

      const response = await axios.post(INSERT_DYNAMIC_DATA_URL, payload, {
        headers: API_HEADERS,
      });

      if (Number(response?.data?.statusCode) !== 200) {
        throw new Error(
          response?.data?.message || "Live group sessions create nahi huay."
        );
      }

      setSuccessMsg("Live group sessions created successfully.");

      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 700);
    } catch (err) {
      console.error("Create live group sessions failed:", err);
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose?.();
  };

  const previewClasses = useMemo(() => {
    return classes.map((item, index) => {
      const teacher = getTeacherById(item.teacherid);
      const subject = getSubjectByClassItem(item);

      return {
        index,
        teacherName: getTeacherName(teacher),
        subjectName: getSubjectName(subject),
        title: item.title || buildSessionTitle(item, index),
        date: item.session_date,
        time:
          item.slot_start && item.slot_end
            ? `${item.slot_start} - ${item.slot_end}`
            : "",
      };
    });
  }, [classes, teachers, selectedProgrammeName]);

  if (!isOpen) return null;

  return (
    <div className="gl-create-overlay" onClick={handleClose}>
      <style>{`
        .gl-create-overlay {
          position: fixed;
          inset: 0;
          z-index: 2400;
          background: rgba(2, 6, 23, 0.74);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .gl-create-modal {
          width: min(1180px, 98vw);
          max-height: 94vh;
          overflow: hidden;
          border-radius: 22px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          background: #243247;
          color: #ffffff;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.50);
        }

        .gl-create-header {
          padding: 24px 26px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.20);
          background: linear-gradient(135deg, #1d2b3f 0%, #26384f 100%);
        }

        .gl-create-title {
          color: #ffffff;
          font-size: 30px;
          font-weight: 900;
          line-height: 1.2;
          margin: 0;
        }

        .gl-create-subtitle {
          color: #b8c4d6;
          font-size: 14px;
          margin-top: 6px;
          font-weight: 600;
        }

        .gl-create-close {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(15, 23, 42, 0.30);
          color: #dbe4f0;
          font-size: 22px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .gl-create-close:hover {
          background: rgba(239, 68, 68, 0.16);
          border-color: rgba(239, 68, 68, 0.48);
          color: #ffffff;
        }

        .gl-create-body {
          max-height: calc(94vh - 172px);
          overflow-y: auto;
          padding: 24px 26px;
          background: #243247;
        }

        .gl-create-body::-webkit-scrollbar {
          width: 8px;
        }

        .gl-create-body::-webkit-scrollbar-track {
          background: #172438;
        }

        .gl-create-body::-webkit-scrollbar-thumb {
          background: #64748b;
          border-radius: 999px;
        }

        .gl-create-footer {
          padding: 16px 26px;
          border-top: 1px solid rgba(148, 163, 184, 0.20);
          background: #202e42;
        }

        .gl-create-body .form-label {
          color: #dbe4f0;
          font-weight: 800;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .gl-create-body .form-control,
        .gl-create-body .form-select {
          min-height: 50px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: #1b2738;
          color: #ffffff;
          font-weight: 650;
          box-shadow: none !important;
        }

        .gl-create-body .form-control::placeholder {
          color: #8296b1;
        }

        .gl-create-body .form-control:focus,
        .gl-create-body .form-select:focus {
          border-color: #3b82f6;
          background: #1b2738;
          color: #ffffff;
        }

        .gl-create-body .form-select option {
          background: #243247;
          color: #ffffff;
        }

        .gl-top-card {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.48));
          padding: 18px;
          margin-bottom: 18px;
        }

        .gl-class-card {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 18px;
          background: #1f2d40;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .gl-class-header {
          padding: 15px 18px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.16);
          background: #182538;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .gl-class-title {
          color: #ffffff;
          font-size: 16px;
          font-weight: 900;
          margin: 0;
        }

        .gl-class-subtitle {
          color: #9fb0c8;
          font-size: 12px;
          font-weight: 700;
        }

        .gl-class-body {
          padding: 18px;
        }

        .gl-subject-note {
          color: #93c5fd;
          font-size: 12px;
          font-weight: 700;
          margin-top: 6px;
        }

        .gl-subject-error {
          color: #fca5a5;
          font-size: 12px;
          font-weight: 700;
          margin-top: 6px;
        }

        .gl-preview-card {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.48));
          padding: 18px;
          margin-top: 18px;
        }

        .gl-preview-title {
          color: #ffffff;
          font-weight: 900;
          margin-bottom: 12px;
          font-size: 16px;
        }

        .gl-preview-line {
          color: #b8c4d6;
          font-size: 14px;
          line-height: 1.8;
          font-weight: 600;
        }

        .gl-preview-line strong {
          color: #ffffff;
        }

        .gl-alert {
          border-radius: 14px;
          font-weight: 700;
          border: 0;
        }

        .gl-cancel-btn {
          border-radius: 12px;
          padding: 10px 18px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: transparent;
          color: #dbe4f0;
          font-weight: 800;
        }

        .gl-cancel-btn:hover {
          background: rgba(148, 163, 184, 0.16);
          color: #ffffff;
        }

        .gl-submit-btn {
          border-radius: 12px;
          padding: 10px 22px;
          font-weight: 900;
          box-shadow: 0 12px 30px rgba(34, 197, 94, 0.22);
        }

        @media (max-width: 767px) {
          .gl-create-header,
          .gl-create-body,
          .gl-create-footer {
            padding-left: 16px;
            padding-right: 16px;
          }

          .gl-create-title {
            font-size: 23px;
          }

          .gl-class-body {
            padding: 16px;
          }
        }
      `}</style>

      <div className="gl-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gl-create-header d-flex justify-content-between align-items-start gap-3">
          <div>
            <h4 className="gl-create-title">Create Live Group Sessions</h4>
            <div className="gl-create-subtitle">
              Select programme and create its 3 live classes.
            </div>
          </div>

          <button
            type="button"
            className="gl-create-close"
            onClick={handleClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="gl-create-body">
            {error ? (
              <div className="alert alert-danger gl-alert py-2">{error}</div>
            ) : null}

            {successMsg ? (
              <div className="alert alert-success gl-alert py-2">
                {successMsg}
              </div>
            ) : null}

            {lookupsLoading ? (
              <div className="alert alert-info gl-alert py-2">
                loading...
              </div>
            ) : null}

            <div className="gl-top-card">
              <div className="row g-3">
                <div className="col-lg-6">
                  <label className="form-label">Programme</label>
                  <select
                    className="form-select"
                    value={form.programme_id}
                    onChange={(e) => setField("programme_id", e.target.value)}
                    disabled={loading || lookupsLoading}
                  >
                    <option value="">Select Programme</option>

                    {programmes.map((item) => (
                      <option
                        key={getProgrammeId(item)}
                        value={getProgrammeId(item)}
                      >
                        {item.name} {item.stage ? `- ${item.stage}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-lg-3 col-md-6">
                  <label className="form-label">Capacity</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.capacity}
                    onChange={(e) => setField("capacity", e.target.value)}
                    min="1"
                    disabled={loading}
                  />
                </div>

                <div className="col-lg-3 col-md-6">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(e) => setField("status", e.target.value)}
                    disabled={loading}
                  >
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>

            {classes.map((item, index) => {
              const teacher = getTeacherById(item.teacherid);
              const subject = getSubjectByClassItem(item);
              const autoTitle = buildSessionTitle(item, index);

              return (
                <div className="gl-class-card" key={item.class_no}>
                  <div className="gl-class-header">
                    <div>
                      <h6 className="gl-class-title">Class {index + 1}</h6>
                      <div className="gl-class-subtitle">
                        {getTeacherName(teacher) || "Teacher not selected"}
                        {getSubjectName(subject)
                          ? ` • ${getSubjectName(subject)}`
                          : ""}
                      </div>
                    </div>

                    <span className="badge bg-primary">Required</span>
                  </div>

                  <div className="gl-class-body">
                    <div className="row g-3">
                      <div className="col-lg-4 col-md-6">
                        <label className="form-label">Teacher</label>
                        <select
                          className="form-select"
                          value={item.teacherid}
                          onChange={(e) =>
                            handleTeacherChange(index, e.target.value)
                          }
                          disabled={loading || lookupsLoading}
                        >
                          <option value="">Select Teacher</option>

                          {teachers.map((t) => (
                            <option
                              key={getTeacherId(t)}
                              value={getTeacherId(t)}
                            >
                              {getTeacherName(t)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <label className="form-label">Subject</label>
                        <select
                          className="form-select"
                          value={item.subjectid}
                          onChange={(e) =>
                            handleSubjectChange(index, e.target.value)
                          }
                          disabled={
                            loading ||
                            item.subjectLoading ||
                            !item.teacherid ||
                            !item.subjectOptions?.length
                          }
                        >
                          <option value="">
                            {item.subjectLoading
                              ? "Loading subjects..."
                              : item.teacherid
                              ? "Select Subject"
                              : "Select teacher first"}
                          </option>

                          {(item.subjectOptions || []).map((s) => (
                            <option
                              key={getSubjectId(s)}
                              value={getSubjectId(s)}
                            >
                              {getSubjectName(s)}
                            </option>
                          ))}
                        </select>

                        {item.subjectLoading ? (
                          <div className="gl-subject-note">
                            Teacher subjects loading...
                          </div>
                        ) : null}

                        {item.subjectError ? (
                          <div className="gl-subject-error">
                            {item.subjectError}
                          </div>
                        ) : null}
                      </div>

                      <div className="col-lg-4 col-md-12">
                        <label className="form-label">Session Title</label>
                        <input
                          type="text"
                          className="form-control"
                          value={item.title || autoTitle}
                          onChange={(e) =>
                            updateClass(index, "title", e.target.value)
                          }
                          placeholder={`${
                            selectedProgrammeName || "Programme"
                          } - Subject`}
                          disabled={loading}
                        />
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <label className="form-label">Session Date</label>
                        <input
                          type="date"
                          className="form-control"
                          value={item.session_date}
                          onChange={(e) =>
                            updateClass(index, "session_date", e.target.value)
                          }
                          disabled={loading}
                        />
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <label className="form-label">Start Time</label>
                        <input
                          type="time"
                          className="form-control"
                          value={item.slot_start}
                          onChange={(e) =>
                            updateClass(index, "slot_start", e.target.value)
                          }
                          disabled={loading}
                        />
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <label className="form-label">End Time</label>
                        <input
                          type="time"
                          className="form-control"
                          value={item.slot_end}
                          onChange={(e) =>
                            updateClass(index, "slot_end", e.target.value)
                          }
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="gl-preview-card">
              <div className="gl-preview-title">Preview</div>

              <div className="gl-preview-line">
                <strong>Programme:</strong> {selectedProgramme?.name || "-"}
              </div>

              <div className="gl-preview-line">
                <strong>Stage:</strong> {selectedProgramme?.stage || "-"}
              </div>

              <div className="gl-preview-line">
                <strong>Weekly Price:</strong>{" "}
                {selectedProgramme?.weekly_price
                  ? `AED ${selectedProgramme.weekly_price}`
                  : "-"}
              </div>

              <div className="gl-preview-line">
                <strong>Capacity:</strong> {form.capacity || "-"} students
              </div>

              {previewClasses.map((item) => (
                <div className="gl-preview-line" key={item.index}>
                  <strong>Class {item.index + 1}:</strong> {item.title || "-"} |{" "}
                  {item.teacherName || "-"} | {item.date || "-"} |{" "}
                  {item.time || "-"}
                </div>
              ))}
            </div>
          </div>

          <div className="gl-create-footer d-flex justify-content-end gap-2">
            <button
              type="button"
              className="gl-cancel-btn"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-success gl-submit-btn"
              disabled={loading || lookupsLoading}
            >
              {loading ? "Creating..." : "Create Sessions"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLiveGroupModal;