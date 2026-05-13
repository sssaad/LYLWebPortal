import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import moment from "moment-timezone";
import Swal from "sweetalert2";
import { getToken } from "../api/getToken";
import { getTimezonesLookup } from "../api/getTimezonesLookup";

const RUN_STORED_PROCEDURE_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const CREATE_GROUP_PORTAL_BOOKING_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=create_group_portal_booking";

const API_HEADERS = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

const DEFAULT_PORTAL_DISPLAY_TIMEZONE = "Asia/Dubai";

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

const formatDate = (value) => {
  if (!value) return "-";

  const m = moment(value, ["YYYY-MM-DD", "YYYY-MM-DD HH:mm:ss"], true);
  return m.isValid() ? m.format("DD MMM YYYY") : value;
};

const formatTime = (value) => {
  if (!value) return "-";

  const clean = String(value).split(".")[0];
  const m = moment(clean, ["HH:mm:ss", "HH:mm"], true);

  return m.isValid() ? m.format("hh:mm A") : clean;
};

const normaliseTime = (value = "") => {
  const clean = String(value || "").split(".")[0].trim();
  if (!clean) return "";

  const parsed = moment(clean, ["HH:mm:ss", "HH:mm", "hh:mm A"], true);
  return parsed.isValid() ? parsed.format("HH:mm:ss") : clean;
};

const getSafeTimezone = (
  timezone,
  fallback = DEFAULT_PORTAL_DISPLAY_TIMEZONE
) => {
  const value = String(timezone || "").trim();

  if (!value) return fallback;

  if (moment.tz.zone(value)) return value;

  return fallback;
};

const convertSessionToDisplayTimezone = (session, targetTimezone) => {
  const sourceTimezone = getSafeTimezone(
    session?.timezone_location || session?.timezone,
    DEFAULT_PORTAL_DISPLAY_TIMEZONE
  );

  const displayTimezone = getSafeTimezone(
    targetTimezone,
    DEFAULT_PORTAL_DISPLAY_TIMEZONE
  );

  const sourceDate = session?.session_date || "";
  const sourceStart = normaliseTime(session?.slot_start || "");
  const sourceEnd = normaliseTime(session?.slot_end || "");

  if (!sourceDate || !sourceStart || !sourceEnd) {
    return {
      date: formatDate(sourceDate),
      slot: `${formatTime(sourceStart)} - ${formatTime(sourceEnd)}`,
      dbDate: sourceDate,
      dbStart: sourceStart,
      dbEnd: sourceEnd,
    };
  }

  const start = moment.tz(
    `${sourceDate} ${sourceStart}`,
    "YYYY-MM-DD HH:mm:ss",
    sourceTimezone
  );

  const end = moment.tz(
    `${sourceDate} ${sourceEnd}`,
    "YYYY-MM-DD HH:mm:ss",
    sourceTimezone
  );

  if (!start.isValid() || !end.isValid()) {
    return {
      date: formatDate(sourceDate),
      slot: `${formatTime(sourceStart)} - ${formatTime(sourceEnd)}`,
      dbDate: sourceDate,
      dbStart: sourceStart,
      dbEnd: sourceEnd,
    };
  }

  const convertedStart = start.clone().tz(displayTimezone);
  const convertedEnd = end.clone().tz(displayTimezone);

  return {
    date: convertedStart.format("DD MMM YYYY"),
    slot: `${convertedStart.format("hh:mm A")} - ${convertedEnd.format(
      "hh:mm A"
    )}`,
    dbDate: convertedStart.format("YYYY-MM-DD"),
    dbStart: convertedStart.format("HH:mm:ss"),
    dbEnd: convertedEnd.format("HH:mm:ss"),
  };
};

const getStatusBadgeClass = (status) => {
  const s = String(status || "").toLowerCase();

  if (s === "active") return "bg-success";
  if (s === "completed") return "bg-primary";
  if (s === "cancelled") return "bg-danger";

  return "bg-secondary";
};

const getStudentId = (student) =>
  student?.userid ||
  student?.id ||
  student?.userId ||
  student?.studentid ||
  student?.studentId ||
  "";

const getStudentName = (student) => {
  const firstName = String(student?.firstname || "").trim();
  const lastName = String(student?.lastname || "").trim();

  return (
    student?.fullname ||
    student?.name ||
    student?.studentFullname ||
    student?.full_name ||
    `${firstName} ${lastName}`.trim() ||
    student?.username ||
    student?.email ||
    "Student"
  );
};

const getStudentMeta = (student) => {
  const year = student?.year ? `Year ${student.year}` : "";
  const email = student?.email || student?.username || "";

  return [year, email].filter(Boolean).join(" • ");
};
const buildStudentImageUrl = (imagePath) => {
  const value = String(imagePath || "").trim();

  if (!value) return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://api.learnyourlanguage.org/${value.replace(/^\/+/, "")}`;
};

const getStudentImage = (student) => {
  const userDetails = student?.userdetails || student?.userDetails || {};

  return (
    student?.imagepath ||
    student?.profileImage ||
    student?.profile_image ||
    student?.image ||
    student?.userimage ||
    student?.avatar ||
    student?.profile_pic ||
    userDetails?.imagepath ||
    userDetails?.profileImage ||
    userDetails?.profile_image ||
    userDetails?.image ||
    userDetails?.userimage ||
    userDetails?.avatar ||
    ""
  );
};

const SearchableStudentSelect = ({
  students = [],
  value,
  onChange,
  disabled = false,
  placeholder = "Select Student",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef(null);

  const selectedStudent = useMemo(() => {
    return students.find(
      (student) => String(getStudentId(student)) === String(value)
    );
  }, [students, value]);

  const filteredStudents = useMemo(() => {
    const keyword = String(search || "").toLowerCase().trim();

    if (!keyword) return students;

    return students.filter((student) => {
      const name = String(getStudentName(student) || "").toLowerCase();
      const email = String(student?.email || student?.username || "").toLowerCase();
      const meta = String(getStudentMeta(student) || "").toLowerCase();

      return (
        name.includes(keyword) ||
        email.includes(keyword) ||
        meta.includes(keyword)
      );
    });
  }, [students, search]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (studentIdValue) => {
    onChange?.(studentIdValue);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="gb-student-select-wrap" ref={wrapRef}>
      <button
        type="button"
        className="gb-student-select-btn"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
      >
        <span className="gb-student-selected-left">
          {selectedStudent ? (
            <>
              <span className="gb-student-avatar">
                {buildStudentImageUrl(getStudentImage(selectedStudent)) ? (
                  <img
                    src={buildStudentImageUrl(getStudentImage(selectedStudent))}
                    alt={getStudentName(selectedStudent) || "Student"}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="gb-student-avatar-fallback">
                    {String(getStudentName(selectedStudent) || "S")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
              </span>

              <span className="gb-student-selected-info">
                <span className="gb-student-selected-name">
                  {getStudentName(selectedStudent)}
                </span>

                {getStudentMeta(selectedStudent) ? (
                  <span className="gb-student-selected-meta">
                    {getStudentMeta(selectedStudent)}
                  </span>
                ) : null}
              </span>
            </>
          ) : (
            <span className="gb-student-placeholder">{placeholder}</span>
          )}
        </span>

        <span className="gb-student-arrow">{open ? "▴" : "▾"}</span>
      </button>

      {open && !disabled ? (
        <div className="gb-student-dropdown">
          <div className="gb-student-search-box">
            <input
              type="text"
              className="gb-student-search-input"
              placeholder="Search student..."
              value={search}
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="gb-student-options">
            {filteredStudents.length === 0 ? (
              <div className="gb-student-empty">No student found.</div>
            ) : (
              filteredStudents.map((student, index) => {
                const sid = getStudentId(student);
                const studentName = getStudentName(student);
                const studentMeta = getStudentMeta(student);
                const imageUrl = buildStudentImageUrl(getStudentImage(student));
                const isSelected = String(sid) === String(value);

                return (
                  <button
                    type="button"
                    key={`${sid || "student"}-${index}`}
                    className={`gb-student-option ${isSelected ? "active" : ""}`}
                    onClick={() => handleSelect(sid)}
                  >
                    <span className="gb-student-avatar">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={studentName || "Student"}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="gb-student-avatar-fallback">
                          {String(studentName || "S").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>

                    <span className="gb-student-option-info">
                      <span className="gb-student-option-name">
                        {studentName || "Unnamed Student"}
                      </span>

                      {studentMeta ? (
                        <span className="gb-student-option-meta">
                          {studentMeta}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
const CreateGroupBatchBookingModal = ({
  open,
  programme,
  onClose,
  onSuccess,
}) => {
  const [students, setStudents] = useState([]);
  const [timezones, setTimezones] = useState([]);

  const [studentId, setStudentId] = useState("");
  const [studentTz, setStudentTz] = useState(DEFAULT_PORTAL_DISPLAY_TIMEZONE);

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingTimezones, setLoadingTimezones] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const sessions = Array.isArray(programme?.sessions) ? programme.sessions : [];

  const activeSessions = useMemo(() => {
    return sessions.filter(
      (s) => String(s?.status || "").toLowerCase() === "active"
    );
  }, [sessions]);

  const buildHeaders = async () => {
    const tokenRes = await getToken();
    const token = resolveToken(tokenRes);

    return {
      ...API_HEADERS,
      ...(token ? { token } : {}),
    };
  };

  const timezoneOptions = useMemo(() => {
    let list = [];

    if (Array.isArray(timezones) && timezones.length) {
      list = timezones
        .map((t) => ({
          value: t?.timezone || t?.name || t?.value || "",
          label: t?.timezone || t?.name || t?.value || "",
          timezoneid: t?.timezoneid ?? t?.id ?? t?.timezoneId ?? "",
        }))
        .filter((t) => t.value);
    }

    const ensureOption = (tzValue) => {
      const val = String(tzValue || "").trim();
      if (!val) return;

      const exists = list.some((o) => String(o.value) === val);
      if (!exists) {
        list.unshift({
          value: val,
          label: val,
          timezoneid: "",
        });
      }
    };

    ensureOption(studentTz);
    ensureOption(DEFAULT_PORTAL_DISPLAY_TIMEZONE);

    if (!list.length) {
      list = [
        {
          value: DEFAULT_PORTAL_DISPLAY_TIMEZONE,
          label: DEFAULT_PORTAL_DISPLAY_TIMEZONE,
          timezoneid: "",
        },
      ];
    }

    const seen = new Set();

    return list.filter((item) => {
      const key = String(item.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [timezones, studentTz]);

  const getTimezoneIdByValue = (tzValue) => {
    const cleanValue = String(tzValue || "").trim();

    const opt = timezoneOptions.find(
      (o) => String(o.value || "").trim() === cleanValue
    );

    const id = opt?.timezoneid;

    if (id !== null && id !== undefined && id !== "") {
      return String(id);
    }

    if (cleanValue === DEFAULT_PORTAL_DISPLAY_TIMEZONE) {
      const dubaiOpt = timezoneOptions.find(
        (o) =>
          String(o.value || "").trim() === DEFAULT_PORTAL_DISPLAY_TIMEZONE ||
          String(o.label || "").trim() === DEFAULT_PORTAL_DISPLAY_TIMEZONE
      );

      if (
        dubaiOpt?.timezoneid !== null &&
        dubaiOpt?.timezoneid !== undefined &&
        dubaiOpt?.timezoneid !== ""
      ) {
        return String(dubaiOpt.timezoneid);
      }
    }

    return "";
  };

  const getTimezoneValueById = (timezoneId) => {
    const id = String(timezoneId ?? "").trim();
    if (!id) return "";

    const found = timezoneOptions.find(
      (o) => String(o.timezoneid ?? "") === id
    );

    return found?.value || "";
  };

  const getStudentTimezoneRaw = (student) => {
    const userDetails = student?.userdetails || student?.userDetails || {};

    return (
      student?.timezone ||
      student?.timezone_name ||
      student?.timezoneName ||
      student?.timezonename ||
      student?.timezoneid ||
      student?.timezoneId ||
      userDetails?.timezone ||
      userDetails?.timezone_name ||
      userDetails?.timezoneid ||
      userDetails?.timezoneId ||
      ""
    );
  };

  const resolveStudentTimezone = (student) => {
    const raw = String(getStudentTimezoneRaw(student) || "").trim();

    if (!raw) return studentTz || DEFAULT_PORTAL_DISPLAY_TIMEZONE;

    if (
      raw.includes("/") ||
      raw === "UTC" ||
      raw.startsWith("Etc/") ||
      raw.startsWith("GMT") ||
      raw.startsWith("UTC")
    ) {
      return raw;
    }

    const byId = getTimezoneValueById(raw);
    if (byId) return byId;

    return studentTz || DEFAULT_PORTAL_DISPLAY_TIMEZONE;
  };

  const loadTimezones = async () => {
    setLoadingTimezones(true);

    try {
      const res = await getTimezonesLookup();

      if (res?.statusCode === 200 && Array.isArray(res?.data)) {
        setTimezones(res.data);
      } else {
        setTimezones([]);
      }

      setStudentTz(DEFAULT_PORTAL_DISPLAY_TIMEZONE);
    } catch (err) {
      console.error("getTimezonesLookup failed:", err);
      setTimezones([]);
      setStudentTz(DEFAULT_PORTAL_DISPLAY_TIMEZONE);
    } finally {
      setLoadingTimezones(false);
    }
  };

  const loadStudents = async () => {
    setLoadingStudents(true);
    setError("");
    setStudents([]);

    try {
      const headers = await buildHeaders();

      const response = await axios.post(
        RUN_STORED_PROCEDURE_URL,
        {
          procedureName: "GetAllStudents",
        },
        { headers }
      );

      if (Number(response?.data?.statusCode) !== 200) {
        throw new Error(
          response?.data?.message || "Students could not be loaded."
        );
      }

      const rows = extractRows(response.data);
      setStudents(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setStudents([]);
      setError(err?.message || "Students could not be loaded.");
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    setStudentId("");
    setStudentTz(DEFAULT_PORTAL_DISPLAY_TIMEZONE);
    setError("");
    setCreating(false);

    loadTimezones();
    loadStudents();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => String(getStudentId(s)) === String(studentId));
  }, [students, studentId]);

  const handleStudentChange = (value) => {
    setStudentId(value);
    setError("");

    console.log("SELECTED STUDENT RAW =>", {
      value,
      student: students.find((s) => String(getStudentId(s)) === String(value)),
    });

    const student = students.find(
      (s) => String(getStudentId(s)) === String(value)
    );

    if (student) {
      const tz = resolveStudentTimezone(student);
      setStudentTz(tz || DEFAULT_PORTAL_DISPLAY_TIMEZONE);
    } else {
      setStudentTz(DEFAULT_PORTAL_DISPLAY_TIMEZONE);
    }
  };

  const handleTimezoneChange = (value) => {
    setStudentTz(value || DEFAULT_PORTAL_DISPLAY_TIMEZONE);
  };

  const buildGroupBookingPayload = () => {
    const timezoneid = getTimezoneIdByValue(studentTz);
    const batchCreatedDate = moment().format("YYYY-MM-DD HH:mm:ss");

    return {
      studentid: Number(studentId),
      userid: Number(studentId),
      createdby: Number(studentId),

      timezone: studentTz,
      user_timezone: studentTz,
      timezoneid,
      source: "admin_portal",

      programme_id: Number(programme?.programme_id || 0),
      programme_name: programme?.programme_name || "",
      programme_stage: programme?.programme_stage || "",
      weekly_price: programme?.weekly_price || "",
      batch_key: programme?.batch_key || "",
      group_key: programme?.group_key || "",
      booking_createddate: batchCreatedDate,

      payment_status: "Paid",
      paymentmethod: "card",
      paymentType: "Group",
      sessionType: "Online",
      bookingType: "Manual",

      sessions: activeSessions.map((session) => {
        const converted = convertSessionToDisplayTimezone(session, studentTz);

        return {
          group_live_session_id: Number(session?.id),
          group_programme_id: Number(session?.programme_id),
          teacherid: Number(session?.teacherid),
          subjectid: Number(session?.subjectid),

          bookdate: converted.dbDate,
          slot_start: converted.dbStart,
          slot_end: converted.dbEnd,

          timezoneid,
          timezone: studentTz,
          user_timezone: studentTz,

          source_bookdate: String(session?.session_date || ""),
          source_slot_start: String(session?.slot_start || ""),
          source_slot_end: String(session?.slot_end || ""),
          source_timezone:
            session?.timezone_location || DEFAULT_PORTAL_DISPLAY_TIMEZONE,

          display_date: converted.date,
          display_slot: converted.slot,
        };
      }),
    };
  };

  const handleCreateBooking = async () => {
    if (!programme) {
      setError("Programme batch is missing.");
      return;
    }

    if (String(programme?.status || "").toLowerCase() !== "active") {
      setError("Only an active batch can be booked.");
      return;
    }

    if (!studentId) {
      setError("Please select a student first.");
      return;
    }

    if (!studentTz) {
      setError("Please select the student's timezone.");
      return;
    }

    const timezoneid = getTimezoneIdByValue(studentTz);

    if (!timezoneid) {
      setError(
        "Selected timezone ID was not found. Please reselect the student's timezone."
      );
      return;
    }

    if (activeSessions.length === 0) {
      setError("No active classes were found for this batch.");
      return;
    }

    const payload = buildGroupBookingPayload();

    const confirmResult = await Swal.fire({
      icon: "warning",
      title: "Create Group Booking?",
      html: `
    <div style="text-align:center; line-height:1.7;">
      <div>Please confirm the details before creating this group booking.</div>
      <div style="margin-top:10px;">
        <strong>Programme:</strong> ${programme?.programme_name || "-"}<br/>
        <strong>Student:</strong> ${getStudentName(selectedStudent) || "-"}<br/>
        <strong>Timezone:</strong> ${studentTz}<br/>
        <strong>Classes:</strong> ${activeSessions.length}
      </div>
    </div>
  `,
      showCancelButton: true,
      confirmButtonText: "Yes, Create Booking",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#198754",
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
      customClass: {
        container: "gb-swal-container",
      },
    });

    if (!confirmResult.isConfirmed) return;

    setCreating(true);
    setError("");

    try {
      console.log("GROUP BOOKING CREATE PAYLOAD =>", payload);

      const headers = await buildHeaders();

      const response = await axios.post(
        CREATE_GROUP_PORTAL_BOOKING_URL,
        payload,
        { headers }
      );

      console.log("GROUP BOOKING CREATE RESPONSE =>", response?.data);

      if (Number(response?.data?.statusCode) !== 200) {
        throw new Error(
          response?.data?.message || "Group booking could not be created."
        );
      }

      await Swal.fire({
        icon: "success",
        title: "Booking Created",
        text:
          response?.data?.message || "Group booking created successfully.",
        timer: 1800,
        timerProgressBar: true,
      });

      onSuccess?.({
        payload,
        response: response?.data,
        student: selectedStudent,
        programme,
      });
    } catch (err) {
      console.error("GROUP BOOKING CREATE ERROR =>", err);

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "The booking could not be created.";

      setError(message);

      await Swal.fire({
        icon: "error",
        title: "Booking Failed",
        text: message,
      });
    } finally {
      setCreating(false);
    }
  };

  if (!open || !programme) return null;

  return (
    <div
      className="gb-booking-overlay"
      onClick={() => {
        if (!creating) onClose?.();
      }}
    >
      <style>{`
        .gb-booking-overlay {
          position: fixed;
          inset: 0;
          z-index: 2600;
          background: rgba(2, 6, 23, 0.76);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .swal2-container {
  z-index: 99999 !important;
}

        .gb-booking-modal {
          width: min(760px, 96vw);
          max-height: 92vh;
          overflow: hidden;
          border-radius: 22px;
          background: #243247;
          color: #ffffff;
          border: 1px solid rgba(148, 163, 184, 0.25);
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.50);
          display: flex;
          flex-direction: column;
        }

        .gb-booking-header {
          padding: 22px 24px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.20);
          background: linear-gradient(135deg, #1d2b3f 0%, #26384f 100%);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-shrink: 0;
        }

        .gb-booking-title {
          margin: 0;
          color: #ffffff;
          font-size: 26px;
          font-weight: 900;
          line-height: 1.2;
        }

        .gb-booking-subtitle {
          color: #b8c4d6;
          font-size: 14px;
          margin-top: 6px;
          font-weight: 650;
        }

        .gb-booking-close {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(15, 23, 42, 0.30);
          color: #dbe4f0;
          font-size: 22px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .gb-booking-close:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .gb-booking-body {
          padding: 22px 24px;
          overflow-y: auto;
          flex: 1 1 auto;
          min-height: 0;
        }

        .gb-booking-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(148, 163, 184, 0.20);
          background: #202e42;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }

        .gb-card {
          border: 1px solid rgba(148, 163, 184, 0.20);
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.42);
          padding: 16px;
          margin-bottom: 16px;
          overflow: visible;
        }

        .gb-label {
          color: #dbe4f0;
          font-size: 13px;
          font-weight: 850;
          margin-bottom: 8px;
        }

        .gb-booking-body .form-select,
        .gb-booking-body .form-control {
          min-height: 48px;
          border-radius: 13px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: #1b2738;
          color: #ffffff;
          font-weight: 650;
          box-shadow: none !important;
        }

        .gb-booking-body .form-select option {
          background: #243247;
          color: #ffffff;
        }

        .gb-session-row {
          display: grid;
          grid-template-columns: 1.1fr 1.1fr 1fr;
          gap: 10px;
          padding: 12px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.40);
          border: 1px solid rgba(148, 163, 184, 0.14);
          margin-bottom: 8px;
        }

        .gb-session-label {
          color: #9fb0c8;
          font-size: 11px;
          font-weight: 850;
          margin-bottom: 3px;
        }

        .gb-session-value {
          color: #ffffff;
          font-size: 13px;
          font-weight: 750;
        }

        .gb-muted {
          color: #b8c4d6;
          font-size: 13px;
          font-weight: 650;
        }

        .gb-student-select-wrap {
  position: relative;
  width: 100%;
}

.gb-student-select-btn {
  width: 100%;
  min-height: 48px;
  border-radius: 13px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: #1b2738;
  color: #ffffff;
  padding: 7px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 750;
  text-align: left;
}

.gb-student-select-btn:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

.gb-student-selected-left {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.gb-student-placeholder {
  color: #8296b1;
}

.gb-student-selected-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.gb-student-selected-name {
  color: #ffffff;
  font-size: 14px;
  font-weight: 850;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gb-student-selected-meta {
  color: #9fb0c8;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gb-student-arrow {
  color: #ffffff;
  font-size: 12px;
  flex: 0 0 auto;
}

.gb-student-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 2800;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: #0b1220;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.42);
  overflow: hidden;
}

.gb-student-search-box {
  padding: 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  background: #111827;
}

.gb-student-search-input {
  width: 100%;
  height: 48px;
  border-radius: 13px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: #0f172a;
  color: #ffffff;
  padding: 0 14px;
  font-weight: 800;
  outline: none;
}

.gb-student-search-input::placeholder {
  color: #8b97aa;
}

.gb-student-search-input:focus {
  border-color: rgba(59, 130, 246, 0.85);
  box-shadow: 0 0 0 0.2rem rgba(59, 130, 246, 0.16);
}

.gb-student-options {
  max-height: 280px;
  overflow-y: auto;
  padding: 8px;
}

.gb-student-options::-webkit-scrollbar {
  width: 8px;
}

.gb-student-options::-webkit-scrollbar-track {
  background: #111827;
}

.gb-student-options::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 999px;
}

.gb-student-option {
  width: 100%;
  border: 0;
  background: transparent;
  color: #ffffff;
  border-radius: 12px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  cursor: pointer;
}

.gb-student-option:hover,
.gb-student-option.active {
  background: rgba(59, 130, 246, 0.14);
}

.gb-student-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  flex: 0 0 auto;
  background: #1f2937;
  border: 1px solid rgba(148, 163, 184, 0.28);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
}

.gb-student-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gb-student-avatar-fallback {
  font-size: 13px;
  font-weight: 900;
  color: #cbd5e1;
}

.gb-student-option-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gb-student-option-name {
  color: #ffffff;
  font-size: 14px;
  font-weight: 850;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gb-student-option-meta {
  color: #9fb0c8;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gb-student-empty {
  padding: 18px 12px;
  text-align: center;
  color: #94a3b8;
  font-weight: 800;
}

        @media (max-width: 767px) {
          .gb-booking-header,
          .gb-booking-body,
          .gb-booking-footer {
            padding-left: 16px;
            padding-right: 16px;
          }

          .gb-booking-title {
            font-size: 22px;
          }

          .gb-session-row {
            grid-template-columns: 1fr;
          }

          .gb-booking-footer button {
            width: 100%;
          }
        }
      `}</style>

      <div className="gb-booking-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gb-booking-header">
          <div>
            <h4 className="gb-booking-title">Create Group Booking</h4>
            <div className="gb-booking-subtitle">
              Select a student and timezone for this active batch.
            </div>
          </div>

          <button
            type="button"
            className="gb-booking-close"
            onClick={onClose}
            disabled={creating}
          >
            ×
          </button>
        </div>

        <div className="gb-booking-body">
          {error ? (
            <div className="alert alert-danger py-2">{error}</div>
          ) : null}

          <div className="gb-card">
            <div className="row g-3">
              <div className="col-md-7">
                <div className="gb-label">Programme</div>
                <div className="gb-muted">{programme.programme_name || "-"}</div>
              </div>

              <div className="col-md-5">
                <div className="gb-label">Batch Status</div>
                <span
                  className={`badge ${getStatusBadgeClass(programme.status)}`}
                >
                  {programme.status || "-"}
                </span>
              </div>

              <div className="col-md-7">
                <div className="gb-label">Stage</div>
                <div className="gb-muted">
                  {programme.programme_stage || "-"}
                </div>
              </div>

              <div className="col-md-5">
                <div className="gb-label">Weekly Fee</div>
                <div className="gb-muted">
                  AED {Number(programme.weekly_price || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="gb-card">
            <div className="gb-label">Select Student</div>

            {loadingStudents ? (
              <div className="alert alert-info py-2 mb-0">
                Loading students...
              </div>
            ) : (
              <SearchableStudentSelect
                students={students}
                value={studentId}
                disabled={creating}
                placeholder="Select Student"
                onChange={(selectedStudentId) => handleStudentChange(selectedStudentId)}
              />
            )}
          </div>

          <div className="gb-card">
            <div className="gb-label">Student Timezone</div>

            {loadingTimezones ? (
              <div className="alert alert-info py-2 mb-0">
                Loading timezones...
              </div>
            ) : (
              <select
                className="form-select"
                value={studentTz}
                disabled={creating}
                onChange={(e) => handleTimezoneChange(e.target.value)}
              >
                {timezoneOptions.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="gb-card">
            <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
              <div className="gb-label mb-0">Batch Classes</div>
              <span className="badge bg-primary">
                {activeSessions.length} Active Classes
              </span>
            </div>

            {activeSessions.length === 0 ? (
              <div className="gb-muted">No active classes found.</div>
            ) : (
              activeSessions.map((session, index) => {
                const converted = convertSessionToDisplayTimezone(
                  session,
                  studentTz
                );

                return (
                  <div className="gb-session-row" key={session?.id || index}>
                    <div>
                      <div className="gb-session-label">Class</div>
                      <div className="gb-session-value">
                        {index + 1}. {session?.subjectname || "-"}
                      </div>
                    </div>

                    <div>
                      <div className="gb-session-label">Teacher</div>
                      <div className="gb-session-value">
                        {session?.teacher_name || "-"}
                      </div>
                    </div>

                    <div>
                      <div className="gb-session-label">Date / Time</div>
                      <div className="gb-session-value">
                        {converted.date} {converted.slot}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="gb-booking-footer">
          <button
            type="button"
            className="btn btn-outline-light"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-success"
            onClick={handleCreateBooking}
            disabled={
              creating ||
              loadingStudents ||
              loadingTimezones ||
              !studentId ||
              activeSessions.length === 0 ||
              String(programme?.status || "").toLowerCase() !== "active"
            }
          >
            {creating ? "Creating..." : "Create Booking"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupBatchBookingModal;