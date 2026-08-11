import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment-timezone";
import { getToken } from "../api/getToken";
import { getTimezonesLookup } from "../api/getTimezonesLookup";

const RUN_STORED_PROCEDURE_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const ADD_DYNAMIC_DATA_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=add_dynamic_data";

const UPDATE_DYNAMIC_DATA_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const TEACHER_PROFILE_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=teacher_profile";

const UPDATE_GROUP_TEACHER_SETUP_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_group_session_teacher_setup";

const API_HEADERS = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

const PROGRAMME_PROCEDURE = "get_portal_programmes";
const TEACHER_PROCEDURE = "GetAllTeachers";
const PORTAL_TIMEZONE = "Asia/Dubai";

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

const getArrayFromResponse = (res, procedureName = "") => {
  const data = res?.data || res || {};

  const candidates = [
    res,
    res?.data,
    res?.data?.data,
    res?.data?.result,
    res?.result,
    data?.data,
    data?.result,
    data?.[procedureName],
    data?.get_portal_programmes,
    data?.GetAllTeachers,
    data?.getAllTeachers,
    data?.teachers,
    data?.programmes,
    data?.rows,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  for (const value of Object.values(data || {})) {
    if (Array.isArray(value)) return value;
  }

  if (data?.data && typeof data.data === "object") {
    for (const value of Object.values(data.data || {})) {
      if (Array.isArray(value)) return value;
    }
  }

  return [];
};

const isSuccessResponse = (response) => {
  const data = response?.data || {};

  if (Number(response?.status) >= 200 && Number(response?.status) < 300) {
    if (
      data?.error ||
      Number(data?.statusCode) === 400 ||
      Number(data?.statusCode) === 401 ||
      Number(data?.statusCode) === 403 ||
      Number(data?.statusCode) === 404 ||
      Number(data?.statusCode) === 500
    ) {
      return false;
    }

    if (
      data?.success === true ||
      Number(data?.statusCode) === 200 ||
      Number(data?.statusCode) === 201 ||
      String(data?.status || "").toLowerCase() === "success" ||
      String(data?.message || "").toLowerCase().includes("success") ||
      String(data?.message || "").toLowerCase().includes("insert") ||
      String(data?.message || "").toLowerCase().includes("update")
    ) {
      return true;
    }

    return true;
  }

  return false;
};

const extractDynamicInsertedId = (payload) => {
  const candidates = [
    payload?.id,
    payload?.data?.id,
    payload?.data?.data?.id,
    payload?.data?.data?.insert_id,
    payload?.data?.data?.insertId,
    payload?.data?.data?.[0]?.id,
    payload?.data?.insert_id,
    payload?.data?.insertId,
    payload?.result?.id,
    payload?.result?.insert_id,
    payload?.result?.insertId,
    payload?.insert_id,
    payload?.insertId,
    payload?.last_insert_id,
    payload?.data?.last_insert_id,
  ];

  for (const item of candidates) {
    const num = Number(item);

    if (Number.isFinite(num) && num > 0) {
      return num;
    }
  }

  return 0;
};

const normalizeAssistantTeacherIds = (value) => {
  const normalizeOne = (item) => {
    if (item === null || item === undefined) return "";

    if (typeof item === "object") {
      return String(
        item.teacherid ||
        item.teacher_id ||
        item.userid ||
        item.userId ||
        item.id ||
        item.value ||
        ""
      ).trim();
    }

    return String(item || "").trim();
  };

  if (Array.isArray(value)) {
    return value
      .map(normalizeOne)
      .filter(Boolean)
      .filter((item) => item.toLowerCase() !== "null")
      .filter((item) => item.toLowerCase() !== "undefined")
      .filter((item) => item !== "[object Object]");
  }

  if (typeof value === "string") {
    const clean = value.trim();

    if (!clean) return [];

    try {
      const decoded = JSON.parse(clean);
      if (Array.isArray(decoded)) {
        return normalizeAssistantTeacherIds(decoded);
      }
    } catch (_) {
      // CSV fallback below
    }

    return clean
      .replace(/\[/g, "")
      .replace(/\]/g, "")
      .replace(/"/g, "")
      .replace(/'/g, "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => item.toLowerCase() !== "null")
      .filter((item) => item.toLowerCase() !== "undefined")
      .filter((item) => item !== "[object Object]");
  }

  if (typeof value === "number" && value > 0) {
    return [String(value)];
  }

  if (value && typeof value === "object") {
    const one = normalizeOne(value);
    return one ? [one] : [];
  }

  return [];
};

const cleanAssistantTeacherIds = (value, mainTeacherId = "") => {
  const mainId = String(mainTeacherId || "").trim();

  return Array.from(new Set(normalizeAssistantTeacherIds(value))).filter(
    (teacherId) => teacherId && teacherId !== mainId
  );
};

const formatTimeForDb = (value) => {
  if (!value) return "";
  const parsed = moment(value, ["HH:mm", "HH:mm:ss"], true);
  return parsed.isValid() ? parsed.format("HH:mm:ss") : "";
};

const formatTimeForInput = (value) => {
  if (!value) return "";
  const clean = String(value || "").split(".")[0];
  const parsed = moment(clean, ["HH:mm:ss", "HH:mm"], true);
  return parsed.isValid() ? parsed.format("HH:mm") : "";
};

const normaliseTime = (value = "") => {
  const clean = String(value || "").split(".")[0].trim();
  if (!clean) return "";

  const parsed = moment(clean, ["HH:mm:ss", "HH:mm", "hh:mm A"], true);
  return parsed.isValid() ? parsed.format("HH:mm:ss") : clean;
};

const convertTeacherSessionToPortalForm = (session) => {
  const teacherTimezone =
    session?.timezone_location ||
    session?.teacher_timezone_location ||
    session?.timezone ||
    PORTAL_TIMEZONE;

  const sourceDate = session?.session_date || "";
  const sourceStart = normaliseTime(session?.slot_start || "");
  const sourceEnd = normaliseTime(session?.slot_end || "");

  if (!sourceDate || !sourceStart || !sourceEnd || !teacherTimezone) {
    return {
      session_date: sourceDate,
      slot_start: formatTimeForInput(sourceStart),
      slot_end: formatTimeForInput(sourceEnd),
    };
  }

  const teacherStart = moment.tz(
    `${sourceDate} ${sourceStart}`,
    "YYYY-MM-DD HH:mm:ss",
    teacherTimezone
  );

  let teacherEnd = moment.tz(
    `${sourceDate} ${sourceEnd}`,
    "YYYY-MM-DD HH:mm:ss",
    teacherTimezone
  );

  if (!teacherStart.isValid() || !teacherEnd.isValid()) {
    return {
      session_date: sourceDate,
      slot_start: formatTimeForInput(sourceStart),
      slot_end: formatTimeForInput(sourceEnd),
    };
  }

  if (!teacherEnd.isAfter(teacherStart)) {
    teacherEnd = teacherEnd.add(1, "day");
  }

  const portalStart = teacherStart.clone().tz(PORTAL_TIMEZONE);
  const portalEnd = teacherEnd.clone().tz(PORTAL_TIMEZONE);

  return {
    session_date: portalStart.format("YYYY-MM-DD"),
    slot_start: portalStart.format("HH:mm"),
    slot_end: portalEnd.format("HH:mm"),
  };
};

const convertPortalClassToTeacherTimezone = (item) => {
  const teacherTimezone = item?.teacher_timezone_location || PORTAL_TIMEZONE;

  const portalDate = item?.session_date || "";
  const portalStartTime = item?.slot_start || "";
  const portalEndTime = item?.slot_end || "";

  if (!portalDate || !portalStartTime || !portalEndTime || !teacherTimezone) {
    return {
      session_date: portalDate,
      slot_start: formatTimeForDb(portalStartTime),
      slot_end: formatTimeForDb(portalEndTime),
      teacher_timezone: teacherTimezone,
      isValid: false,
    };
  }

  const portalStart = moment.tz(
    `${portalDate} ${portalStartTime}`,
    "YYYY-MM-DD HH:mm",
    PORTAL_TIMEZONE
  );

  let portalEnd = moment.tz(
    `${portalDate} ${portalEndTime}`,
    "YYYY-MM-DD HH:mm",
    PORTAL_TIMEZONE
  );

  if (!portalStart.isValid() || !portalEnd.isValid()) {
    return {
      session_date: portalDate,
      slot_start: formatTimeForDb(portalStartTime),
      slot_end: formatTimeForDb(portalEndTime),
      teacher_timezone: teacherTimezone,
      isValid: false,
    };
  }

  if (!portalEnd.isAfter(portalStart)) {
    portalEnd = portalEnd.add(1, "day");
  }

  const teacherStart = portalStart.clone().tz(teacherTimezone);
  const teacherEnd = portalEnd.clone().tz(teacherTimezone);

  return {
    session_date: teacherStart.format("YYYY-MM-DD"),
    slot_start: teacherStart.format("HH:mm:ss"),
    slot_end: teacherEnd.format("HH:mm:ss"),
    teacher_date_label: teacherStart.format("DD MMM YYYY"),
    teacher_time_label: `${teacherStart.format("hh:mm A")} - ${teacherEnd.format(
      "hh:mm A"
    )}`,
    portal_date_label: portalStart.format("DD MMM YYYY"),
    portal_time_label: `${portalStart.format("hh:mm A")} - ${portalEnd.format(
      "hh:mm A"
    )}`,
    teacher_timezone: teacherTimezone,
    isValid: true,
  };
};

const addOneHourToTime = (value) => {
  if (!value) return "";

  const parsed = moment(value, ["HH:mm", "HH:mm:ss"], true);

  if (!parsed.isValid()) return "";

  return parsed.add(1, "hour").format("HH:mm");
};

const getTimeDurationMinutes = (startValue, endValue) => {
  const start = moment(startValue, ["HH:mm", "HH:mm:ss"], true);
  let end = moment(endValue, ["HH:mm", "HH:mm:ss"], true);

  if (!start.isValid() || !end.isValid()) return null;

  if (!end.isAfter(start)) {
    end = end.add(1, "day");
  }

  return end.diff(start, "minutes");
};

const getProgrammeId = (item) => item?.id ?? item?.programme_id;

const getTeacherId = (item) => item?.userid ?? item?.id;

const getTeacherName = (item) =>
  item?.fullname ||
  item?.teacher_name ||
  [item?.firstname, item?.lastname].filter(Boolean).join(" ") ||
  [item?.firstName, item?.lastName].filter(Boolean).join(" ") ||
  item?.name ||
  "";

const getTeacherImage = (item) =>
  item?.imagepath ||
  item?.profileImage ||
  item?.profile_image ||
  item?.image ||
  item?.userimage ||
  item?.avatar ||
  "";

const buildImageUrl = (imagePath) => {
  const value = String(imagePath || "").trim();

  if (!value) return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://api.learnyourlanguage.org/${value.replace(/^\/+/, "")}`;
};

const getSubjectId = (item) => item?.subjectid ?? item?.id ?? item?.value;

const getSubjectName = (item) =>
  item?.subjectname || item?.name || item?.label || "";

const getTimezoneId = (item) =>
  item?.id ?? item?.timezoneid ?? item?.timezoneId ?? "";

const getTimezoneValue = (item) =>
  item?.timezone || item?.timezone_location || item?.name || item?.value || "";

const getTimezoneLabel = (item) => {
  const id = getTimezoneId(item);
  const value = getTimezoneValue(item);

  if (!value) return "";

  return id ? `${value} (ID: ${id})` : value;
};

const getProgrammeBookedCount = (programme) => {
  const programmeBooked = Number(programme?.booked_count || 0);

  const sessionBooked = Array.isArray(programme?.sessions)
    ? Math.max(
      ...programme.sessions.map((session) =>
        Number(session?.booked_count || 0)
      ),
      0
    )
    : 0;

  return Math.max(programmeBooked, sessionBooked);
};

const makeSubjectOptionFromSession = (session) => {
  const subjectid = session?.subjectid || "";
  const subjectname = session?.subjectname || session?.subject_name || "";

  if (!subjectid && !subjectname) return null;

  return {
    subjectid: String(subjectid),
    subjectname: subjectname || `Subject ${subjectid}`,
  };
};

const SearchableTeacherSelect = ({
  teachers = [],
  value,
  onChange,
  disabled = false,
  placeholder = "Select Teacher",
  fallbackLabel = "",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedTeacher = teachers.find(
    (teacher) => String(getTeacherId(teacher)) === String(value)
  );

  const selectedTeacherName = selectedTeacher
    ? getTeacherName(selectedTeacher)
    : fallbackLabel;

  const filteredTeachers = teachers.filter((teacher) => {
    const searchValue = String(search || "").toLowerCase().trim();

    if (!searchValue) return true;

    return (
      String(getTeacherName(teacher) || "")
        .toLowerCase()
        .includes(searchValue) ||
      String(teacher?.email || "").toLowerCase().includes(searchValue)
    );
  });

  return (
    <div className="gl-teacher-select-wrap">
      <button
        type="button"
        className="gl-teacher-select-btn"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
      >
        <span
          className={
            selectedTeacherName ? "gl-teacher-selected" : "gl-teacher-placeholder"
          }
        >
          {selectedTeacherName || placeholder}
        </span>

        <span className="gl-teacher-arrow">{open ? "▴" : "▾"}</span>
      </button>

      {open ? (
        <div className="gl-teacher-dropdown">
          <div className="gl-teacher-search-box">
            <input
              type="text"
              className="gl-teacher-search-input"
              placeholder="Search..."
              value={search}
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="gl-teacher-options">
            {filteredTeachers.length === 0 ? (
              <div className="gl-teacher-empty">No teacher found.</div>
            ) : (
              filteredTeachers.map((teacher) => {
                const teacherId = getTeacherId(teacher);
                const teacherName = getTeacherName(teacher);
                const imageUrl = buildImageUrl(getTeacherImage(teacher));
                const isSelected = String(teacherId) === String(value);

                return (
                  <button
                    type="button"
                    key={teacherId}
                    className={`gl-teacher-option ${isSelected ? "active" : ""}`}
                    onClick={() => {
                      onChange?.(teacherId);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <span className="gl-teacher-avatar">
                      {imageUrl ? (
                        <img src={imageUrl} alt={teacherName || "Teacher"} />
                      ) : (
                        <span className="gl-teacher-avatar-fallback">
                          {String(teacherName || "T").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>

                    <span className="gl-teacher-name">
                      {teacherName || "Unnamed Teacher"}
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

const SearchableAssistantTeachersSelect = ({
  teachers = [],
  value = [],
  mainTeacherId = "",
  onChange,
  disabled = false,
  placeholder = "Select Assistant Teachers",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedIds = cleanAssistantTeacherIds(value, mainTeacherId);

  const selectedTeachers = selectedIds
    .map((id) =>
      teachers.find((teacher) => String(getTeacherId(teacher)) === String(id))
    )
    .filter(Boolean);

  const filteredTeachers = teachers.filter((teacher) => {
    const teacherId = String(getTeacherId(teacher) || "");
    const searchValue = String(search || "").toLowerCase().trim();

    if (String(mainTeacherId || "") && teacherId === String(mainTeacherId)) {
      return false;
    }

    if (!searchValue) return true;

    return (
      String(getTeacherName(teacher) || "")
        .toLowerCase()
        .includes(searchValue) ||
      String(teacher?.email || "").toLowerCase().includes(searchValue)
    );
  });

  const toggleTeacher = (teacherId) => {
    const id = String(teacherId || "");
    if (!id || id === String(mainTeacherId || "")) return;

    const nextIds = selectedIds.includes(id)
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];

    onChange?.(cleanAssistantTeacherIds(nextIds, mainTeacherId));
  };

  const selectedLabel =
    selectedTeachers.length > 0
      ? `${selectedTeachers.length} assistant teacher${selectedTeachers.length > 1 ? "s" : ""
      } selected`
      : "";

  return (
    <div className="gl-teacher-select-wrap">
      <button
        type="button"
        className="gl-teacher-select-btn"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
      >
        <span
          className={selectedLabel ? "gl-teacher-selected" : "gl-teacher-placeholder"}
        >
          {selectedLabel || placeholder}
        </span>

        <span className="gl-teacher-arrow">{open ? "▴" : "▾"}</span>
      </button>

      {selectedTeachers.length > 0 ? (
        <div className="gl-assistant-chip-row">
          {selectedTeachers.map((teacher) => {
            const teacherId = String(getTeacherId(teacher));
            const teacherName = getTeacherName(teacher);

            return (
              <span className="gl-assistant-chip" key={teacherId}>
                {teacherName || `Teacher ${teacherId}`}
                {!disabled ? (
                  <button
                    type="button"
                    onClick={() => toggleTeacher(teacherId)}
                    aria-label="Remove assistant teacher"
                  >
                    ×
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
      ) : null}

      {open ? (
        <div className="gl-teacher-dropdown">
          <div className="gl-teacher-search-box">
            <input
              type="text"
              className="gl-teacher-search-input"
              placeholder="Search assistant teacher..."
              value={search}
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="gl-teacher-options">
            {filteredTeachers.length === 0 ? (
              <div className="gl-teacher-empty">No teacher found.</div>
            ) : (
              filteredTeachers.map((teacher) => {
                const teacherId = String(getTeacherId(teacher) || "");
                const teacherName = getTeacherName(teacher);
                const imageUrl = buildImageUrl(getTeacherImage(teacher));
                const isSelected = selectedIds.includes(teacherId);

                return (
                  <button
                    type="button"
                    key={teacherId}
                    className={`gl-teacher-option ${isSelected ? "active" : ""
                      }`}
                    onClick={() => toggleTeacher(teacherId)}
                  >
                    <span className="gl-assistant-check">
                      {isSelected ? "✓" : ""}
                    </span>

                    <span className="gl-teacher-avatar">
                      {imageUrl ? (
                        <img src={imageUrl} alt={teacherName || "Teacher"} />
                      ) : (
                        <span className="gl-teacher-avatar-fallback">
                          {String(teacherName || "T").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>

                    <span className="gl-teacher-name">
                      {teacherName || "Unnamed Teacher"}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="gl-assistant-dropdown-footer">
            <button
              type="button"
              onClick={() => {
                onChange?.([]);
                setSearch("");
              }}
              disabled={!selectedIds.length}
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSearch("");
              }}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const makeEmptyClass = (index) => ({
  uid: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
  id: "",
  class_no: index + 1,
  subjectid: "",
  teacherid: "",
  teacher_name: "",
  assistant_teacher_ids: [],

  teacher_timezoneid: "",
  teacher_timezone_location: "",

  session_date: "",
  slot_start: "",
  slot_end: "",
  title: "",
  status: "active",
  subjectOptions: [],
  subjectLoading: false,
  subjectError: "",
});

const generateGroupBatchId = () => {
  return Math.floor(Date.now() / 1000);
};

const getSafeNumberOfWeeks = (value) => {
  const weeks = Number(value || 1);

  if (!Number.isInteger(weeks) || weeks < 1) return 1;
  if (weeks > 10) return 10;

  return weeks;
};

const addRecurringWeeksToDate = (dateValue, weekNo) => {
  if (!dateValue) return "";

  const parsed = moment(dateValue, "YYYY-MM-DD", true);

  if (!parsed.isValid()) return dateValue;

  return parsed
    .add((Number(weekNo || 1) - 1) * 7, "days")
    .format("YYYY-MM-DD");
};

const addWeeksDeltaToDate = (dateValue, weeksDelta = 0) => {
  if (!dateValue) return "";

  const parsed = moment(dateValue, "YYYY-MM-DD", true);

  if (!parsed.isValid()) return dateValue;

  return parsed.add(Number(weeksDelta || 0) * 7, "days").format("YYYY-MM-DD");
};

const getSessionWeekNo = (session) => {
  const weekNo = Number(
    session?.week_no ||
    session?.actual_week_no ||
    session?.group_week_no ||
    session?.group_batch_week_no ||
    session?.recurrence_week_no ||
    1
  );

  return Number.isFinite(weekNo) && weekNo > 0 ? weekNo : 1;
};

const getSessionClassOrder = (session, fallbackIndex = 0) => {
  const classOrder = Number(
    session?.class_order ||
    session?.recurrence_day_no ||
    session?.class_no ||
    fallbackIndex + 1
  );

  return Number.isFinite(classOrder) && classOrder > 0
    ? classOrder
    : fallbackIndex + 1;
};

const isCancelledStatus = (value) => {
  const status = String(value || "").trim().toLowerCase();

  return status === "cancelled" || status === "canceled";
};

const isVisibleEditSession = (session) => {
  if (!session) return false;

  if (isCancelledStatus(session?.status)) return false;
  if (isCancelledStatus(session?.week_status)) return false;
  if (isCancelledStatus(session?.batch_week_status)) return false;
  if (isCancelledStatus(session?.group_batch_week_status)) return false;

  return true;
};

const compareEditSessions = (a, b) => {
  const weekA = getSessionWeekNo(a);
  const weekB = getSessionWeekNo(b);

  if (weekA !== weekB) return weekA - weekB;

  const classA = getSessionClassOrder(a, 0);
  const classB = getSessionClassOrder(b, 0);

  if (classA !== classB) return classA - classB;

  const dateA = `${a?.session_date || ""} ${normaliseTime(a?.slot_start || "")}`;
  const dateB = `${b?.session_date || ""} ${normaliseTime(b?.slot_start || "")}`;

  const timeA = moment(dateA, "YYYY-MM-DD HH:mm:ss", true).valueOf() || 0;
  const timeB = moment(dateB, "YYYY-MM-DD HH:mm:ss", true).valueOf() || 0;

  if (timeA !== timeB) return timeA - timeB;

  return Number(a?.id || 0) - Number(b?.id || 0);
};

const getTransparentEditSessions = (sessions = []) => {
  return (Array.isArray(sessions) ? sessions : [])
    .filter(isVisibleEditSession)
    .sort(compareEditSessions);
};

const getBaseWeekNoFromSessions = (sessions = []) => {
  const safeSessions = Array.isArray(sessions) ? sessions : [];

  const weekNos = safeSessions
    .filter(isVisibleEditSession)
    .map((session) => getSessionWeekNo(session))
    .filter((weekNo) => Number.isFinite(weekNo) && weekNo > 0);

  if (!weekNos.length) return 1;

  return Math.min(...weekNos);
};

const isBaseRecurringSession = (session, baseWeekNo = 1) => {
  return getSessionWeekNo(session) === Number(baseWeekNo || 1);
};

const getBaseRecurringSessions = (sessions = []) => {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const baseWeekNo = getBaseWeekNoFromSessions(safeSessions);

  return safeSessions.filter(
    (session) =>
      isVisibleEditSession(session) && isBaseRecurringSession(session, baseWeekNo)
  );
};

const getEditTotalWeeks = (sessions = []) => {
  const safeSessions = Array.isArray(sessions) ? sessions : [];

  const weekNos = safeSessions
    .filter(isVisibleEditSession)
    .map((session) =>
      Math.max(
        Number(session?.recurrence_total_weeks || 0),
        getSessionWeekNo(session)
      )
    )
    .filter((item) => Number.isFinite(item) && item > 0);

  const maxWeeks = Math.max(1, ...weekNos);

  return String(getSafeNumberOfWeeks(maxWeeks));
};

const CreateLiveGroupModal = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedProgramme = null,
  mode = "create",
  editProgramme = null,
  lockCurriculum = false,
  teacherOnlyEdit = false,
}) => {
  const isEditMode = mode === "edit" && !!editProgramme;
  const isTeacherOnlyEdit = isEditMode && !!teacherOnlyEdit;
  const isCurriculumLocked = isEditMode && !!lockCurriculum;

  const [programmes, setProgrammes] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [timezones, setTimezones] = useState([]);

  const [form, setForm] = useState({
    programme_id: "",
    capacity: "10",
    status: "active",
    show_on_web: "1",
    web_sort_order: "0",
    number_of_weeks: "1",
  });

  const [classes, setClasses] = useState([makeEmptyClass(0)]);
  const [removedSessionIds, setRemovedSessionIds] = useState([]);
  const [assistantDraftMap, setAssistantDraftMap] = useState({});

  const [loading, setLoading] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const selectedProgramme = useMemo(() => {
    return programmes.find(
      (p) => String(getProgrammeId(p)) === String(form.programme_id)
    );
  }, [programmes, form.programme_id]);

  const selectedProgrammeName =
    selectedProgramme?.name ||
    editProgramme?.programme_name ||
    preselectedProgramme?.programme_name ||
    "";

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

    const statusCode = Number(response?.data?.statusCode);

    if (statusCode && statusCode !== 200) {
      throw new Error(response?.data?.message || `${procedureName} failed`);
    }

    return getArrayFromResponse(response, procedureName);
  };

  const normalizeTimezones = (rows) => {
    if (!Array.isArray(rows)) return [];

    const seen = new Set();

    return rows
      .map((item) => {
        const id = getTimezoneId(item);
        const value = getTimezoneValue(item);

        return {
          ...item,
          id,
          timezoneid: id,
          timezone: value,
          label: getTimezoneLabel(item),
        };
      })
      .filter((item) => item.timezone)
      .filter((item) => {
        const key = `${item.timezoneid}-${item.timezone}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const getTimezoneByIdFromList = (list, timezoneId) => {
    const id = String(timezoneId || "").trim();

    if (!id) return null;

    return list.find((tz) => String(getTimezoneId(tz)) === id) || null;
  };

  const getTimezoneByValueFromList = (list, timezoneValue) => {
    const value = String(timezoneValue || "").trim();

    if (!value) return null;

    return (
      list.find((tz) => String(getTimezoneValue(tz)).trim() === value) || null
    );
  };

  const hydrateEditProgramme = (programme, timezoneList = []) => {
    const rawEditSessions = Array.isArray(programme?.sessions)
      ? programme.sessions
      : [];

    /*
     * Portal edit must stay transparent.
     * No-booking edit and teacher-only edit both show every active/non-cancelled
     * session/week, including past sessions, so admin can update each class time.
     * Booking modal has its own upcoming-only filter, so booking safety stays separate.
     */
    const editSessions = getTransparentEditSessions(rawEditSessions);

    const firstSession = editSessions[0] || rawEditSessions[0] || {};

    setForm({
      programme_id: String(
        programme?.programme_id || firstSession?.programme_id || ""
      ),
      capacity: String(programme?.capacity || firstSession?.capacity || "10"),
      status: String(programme?.status || firstSession?.status || "active"),
      show_on_web: String(
        programme?.show_on_web ?? firstSession?.show_on_web ?? 1
      ),
      web_sort_order: String(
        programme?.web_sort_order ?? firstSession?.web_sort_order ?? 0
      ),
      number_of_weeks: getEditTotalWeeks(rawEditSessions),
    });

    const mappedClasses = editSessions.map((session, index) => {
      const timezoneFromId = getTimezoneByIdFromList(
        timezoneList,
        session?.timezoneid
      );

      const timezoneFromValue = getTimezoneByValueFromList(
        timezoneList,
        session?.timezone_location || session?.timezone
      );

      const matchedTimezone = timezoneFromId || timezoneFromValue;
      const subjectOption = makeSubjectOptionFromSession(session);

      const portalTime = convertTeacherSessionToPortalForm({
        ...session,
        timezone_location:
          getTimezoneValue(matchedTimezone) ||
          session?.timezone_location ||
          session?.timezone ||
          "",
      });

      const mainTeacherId = String(
        session?.teacherid || session?.teacher_id || session?.userid || ""
      );

      return {
        uid: `edit-${session?.id || index}-${Date.now()}`,
        id: session?.id || "",
        group_batch_id:
          session?.group_batch_id || programme?.group_batch_id || "",
        class_no: index + 1,
        subjectid: String(session?.subjectid || ""),
        teacherid: mainTeacherId,
        teacher_name:
          session?.teacher_name ||
          session?.teacher_fullname ||
          session?.fullname ||
          "",

        assistant_teacher_ids: cleanAssistantTeacherIds(
          session?.assistant_teacher_ids ||
          session?.assistant_teacherids ||
          session?.assistant_teachers ||
          "",
          mainTeacherId
        ),

        teacher_timezoneid: String(
          getTimezoneId(matchedTimezone) || session?.timezoneid || ""
        ),
        teacher_timezone_location:
          getTimezoneValue(matchedTimezone) ||
          session?.timezone_location ||
          session?.timezone ||
          "",

        session_date: portalTime.session_date,
        slot_start: portalTime.slot_start,
        slot_end: portalTime.slot_end,
        title: session?.title || "",
        status: session?.status || programme?.status || "active",
        group_batch_week_id:
          session?.group_batch_week_id || session?.week_id || "",
        week_no: getSessionWeekNo(session),
        class_order: getSessionClassOrder(session, index),
        recurrence_total_weeks: Number(
          session?.recurrence_total_weeks || getEditTotalWeeks(rawEditSessions)
        ),
        recurrence_week_no: getSessionWeekNo(session),
        recurrence_day_no: getSessionClassOrder(session, index),
        recurrence_parent_session_id:
          session?.recurrence_parent_session_id || null,
        subjectOptions: subjectOption ? [subjectOption] : [],
        subjectLoading: false,
        subjectError: "",
      };
    });

    setClasses(mappedClasses.length ? mappedClasses : [makeEmptyClass(0)]);
    setRemovedSessionIds([]);
  };

  const loadLookups = async () => {
    setLookupsLoading(true);
    setError("");

    let programmeRows = [];
    let teacherRows = [];
    let normalizedTimezones = [];

    try {
      try {
        programmeRows = await runStoredProcedure(PROGRAMME_PROCEDURE);
      } catch (programmeErr) {
        console.error("Curriculum lookup failed:", programmeErr);
        programmeRows = [];
      }

      try {
        teacherRows = await runStoredProcedure(TEACHER_PROCEDURE);
      } catch (teacherErr) {
        console.error("Teacher lookup failed:", teacherErr);
        teacherRows = [];
      }

      try {
        const timezoneRes = await getTimezonesLookup();

        normalizedTimezones =
          timezoneRes?.statusCode === 200 && Array.isArray(timezoneRes?.data)
            ? normalizeTimezones(timezoneRes.data)
            : normalizeTimezones(getArrayFromResponse(timezoneRes));
      } catch (timezoneErr) {
        console.error("Timezone lookup failed:", timezoneErr);
        normalizedTimezones = [];
      }

      setProgrammes(programmeRows || []);
      setTeachers(teacherRows || []);
      setTimezones(normalizedTimezones || []);

      if (isEditMode) {
        hydrateEditProgramme(editProgramme, normalizedTimezones);
      } else if (preselectedProgramme?.programme_id) {
        setForm((prev) => ({
          ...prev,
          programme_id: String(preselectedProgramme.programme_id),
          capacity: String(preselectedProgramme.capacity || prev.capacity),
          status: String(preselectedProgramme.status || prev.status),
          show_on_web: String(
            preselectedProgramme.show_on_web ?? prev.show_on_web ?? 1
          ),
          web_sort_order: String(
            preselectedProgramme.web_sort_order ?? prev.web_sort_order ?? 0
          ),
          number_of_weeks: String(
            preselectedProgramme.number_of_weeks ||
            prev.number_of_weeks ||
            1
          ),
        }));
      }

      if (!programmeRows?.length) {
        setError(
          "Curriculum list could not be loaded. Please check get_portal_programmes response."
        );
      }
    } finally {
      setLookupsLoading(false);
    }
  };

  const resetModalState = () => {
    setError("");
    setSuccessMsg("");
    setRemovedSessionIds([]);
    setAssistantDraftMap({});

    setForm({
      programme_id: "",
      capacity: "10",
      status: "active",
      show_on_web: "1",
      web_sort_order: "0",
      number_of_weeks: "1",
    });

    setClasses([makeEmptyClass(0)]);
  };

  useEffect(() => {
    if (!isOpen) return;

    resetModalState();
    loadLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, editProgramme?.group_key]);

  useEffect(() => {
    if (!selectedProgramme || isEditMode) return;

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
      prev.map((item) => {
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
  }, [selectedProgramme, isEditMode]);

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

  const getTimezoneById = (timezoneId) => {
    const id = String(timezoneId || "").trim();

    if (!id) return null;

    return timezones.find((tz) => String(getTimezoneId(tz)) === id) || null;
  };

  const getTimezoneByValue = (timezoneValue) => {
    const value = String(timezoneValue || "").trim();

    if (!value) return null;

    return (
      timezones.find((tz) => String(getTimezoneValue(tz)).trim() === value) ||
      null
    );
  };

  const extractTeacherTimezone = (profileData) => {
    const profile =
      Array.isArray(profileData?.profile) && profileData.profile.length
        ? profileData.profile[0]
        : profileData;

    const timezoneIdFromProfile =
      profile?.timezoneid || profile?.timezone_id || profile?.timezoneId || "";

    const timezoneLocationFromProfile =
      profile?.timezone_location ||
      profile?.timezone ||
      profile?.userTimezone ||
      "";

    if (timezoneIdFromProfile) {
      const matchedById = getTimezoneById(timezoneIdFromProfile);

      if (matchedById) {
        return {
          timezoneid: String(getTimezoneId(matchedById)),
          timezone_location: getTimezoneValue(matchedById),
        };
      }
    }

    if (timezoneLocationFromProfile) {
      const matchedByValue = getTimezoneByValue(timezoneLocationFromProfile);

      if (matchedByValue) {
        return {
          timezoneid: String(getTimezoneId(matchedByValue)),
          timezone_location: getTimezoneValue(matchedByValue),
        };
      }

      return {
        timezoneid: "",
        timezone_location: timezoneLocationFromProfile,
      };
    }

    return {
      timezoneid: "",
      timezone_location: "",
    };
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

  const fetchTeacherSubjectsForClass = async (
    index,
    teacherid,
    options = {}
  ) => {
    const preserveCurriculumFields = !!options.preserveCurriculumFields;

    if (!teacherid) {
      setClasses((prev) =>
        prev.map((item, i) => {
          if (i !== index) return item;

          if (preserveCurriculumFields) {
            return {
              ...item,
              teacherid: "",
              teacher_name: "",
              assistant_teacher_ids: [],
              teacher_timezoneid: "",
              teacher_timezone_location: "",
              subjectLoading: false,
              subjectError: "",
            };
          }

          return {
            ...item,
            teacherid: "",
            teacher_name: "",
            assistant_teacher_ids: [],
            subjectid: "",
            title: "",
            teacher_timezoneid: "",
            teacher_timezone_location: "",
            subjectOptions: [],
            subjectLoading: false,
            subjectError: "",
          };
        })
      );
      return;
    }

    const selectedTeacher = teachers.find(
      (teacher) => String(getTeacherId(teacher)) === String(teacherid)
    );

    setClasses((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const basePatch = {
          teacherid: String(teacherid),
          teacher_name: getTeacherName(selectedTeacher) || item.teacher_name || "",
          assistant_teacher_ids: cleanAssistantTeacherIds(
            item.assistant_teacher_ids,
            teacherid
          ),
          teacher_timezoneid: "",
          teacher_timezone_location: "",
          subjectLoading: true,
          subjectError: "",
        };

        if (preserveCurriculumFields) {
          return {
            ...item,
            ...basePatch,
          };
        }

        return {
          ...item,
          ...basePatch,
          subjectid: "",
          title: "",
          subjectOptions: [],
        };
      })
    );

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
          response?.data?.message || "Teacher profile could not be loaded."
        );
      }

      const profileData = response?.data?.data || {};
      const subjectOptions = normalizeTeacherSubjects(profileData);
      const teacherTimezone = extractTeacherTimezone(profileData);

      const firstSubject = subjectOptions?.[0] || null;
      const firstSubjectId = firstSubject
        ? String(getSubjectId(firstSubject))
        : "";

      setClasses((prev) =>
        prev.map((item, i) => {
          if (i !== index) return item;

          if (preserveCurriculumFields) {
            return {
              ...item,
              subjectOptions: item.subjectOptions?.length
                ? item.subjectOptions
                : subjectOptions,
              subjectLoading: false,
              subjectError: "",
              teacher_timezoneid: teacherTimezone.timezoneid,
              teacher_timezone_location: teacherTimezone.timezone_location,
              assistant_teacher_ids: cleanAssistantTeacherIds(
                item.assistant_teacher_ids,
                teacherid
              ),
            };
          }

          return {
            ...item,
            subjectOptions,
            subjectLoading: false,
            subjectError: subjectOptions.length
              ? ""
              : "No subjects found for this teacher.",
            subjectid: firstSubjectId,
            title:
              selectedProgrammeName && firstSubject
                ? `${selectedProgrammeName} - ${getSubjectName(firstSubject)}`
                : "",
            teacher_timezoneid: teacherTimezone.timezoneid,
            teacher_timezone_location: teacherTimezone.timezone_location,
            assistant_teacher_ids: cleanAssistantTeacherIds(
              item.assistant_teacher_ids,
              teacherid
            ),
          };
        })
      );
    } catch (err) {
      console.error("Teacher subjects load failed:", err);

      setClasses((prev) =>
        prev.map((item, i) => {
          if (i !== index) return item;

          if (preserveCurriculumFields) {
            return {
              ...item,
              subjectLoading: false,
              subjectError:
                err?.message || "Teacher profile could not be loaded.",
              teacher_timezoneid: "",
              teacher_timezone_location: "",
            };
          }

          return {
            ...item,
            subjectOptions: [],
            subjectLoading: false,
            subjectError: err?.message || "Teacher subjects could not be loaded.",
            subjectid: "",
            title: "",
            teacher_timezoneid: "",
            teacher_timezone_location: "",
          };
        })
      );
    }
  };

  const handleTeacherChange = (index, teacherid) => {
    fetchTeacherSubjectsForClass(index, teacherid, {
      preserveCurriculumFields: isTeacherOnlyEdit,
    });
  };

  const handleAssistantTeachersChange = (index, selectedIds) => {
    const rawSelected = normalizeAssistantTeacherIds(selectedIds);

    setClasses((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const cleanedIds = cleanAssistantTeacherIds(rawSelected, item.teacherid);
        const mapKeys = [
          item.uid,
          String(item.class_no || index + 1),
          `index_${index}`,
        ].filter(Boolean);

        setAssistantDraftMap((old) => {
          const next = { ...old };
          mapKeys.forEach((key) => {
            next[key] = cleanedIds;
          });
          return next;
        });

        return {
          ...item,
          assistant_teacher_ids: cleanedIds,
          assistant_teacherids: cleanedIds.join(","),
          assistant_teachers: cleanedIds.join(","),
          assistant_teacher_ids_array: cleanedIds,
          _resolved_assistant_teacher_ids: cleanedIds,
        };
      })
    );
  };

  const handleSubjectChange = (index, subjectid) => {
    setClasses((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const selectedSubject = (item?.subjectOptions || []).find(
          (s) => String(getSubjectId(s)) === String(subjectid)
        );

        const subjectName = getSubjectName(selectedSubject);

        return {
          ...item,
          subjectid,
          title:
            selectedProgrammeName && subjectName
              ? `${selectedProgrammeName} - ${subjectName}`
              : item.title,
        };
      })
    );
  };

  const handleStartTimeChange = (index, startTime) => {
    const autoEndTime = addOneHourToTime(startTime);

    setClasses((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        return {
          ...item,
          slot_start: startTime,
          slot_end: autoEndTime,
        };
      })
    );
  };

  const handleAddClass = () => {
    if (isCurriculumLocked) return;
    setClasses((prev) => [...prev, makeEmptyClass(prev.length)]);
  };

  const handleRemoveClass = (index) => {
    if (isCurriculumLocked) return;

    setClasses((prev) => {
      if (prev.length <= 1) return prev;

      const removedItem = prev[index];

      if (removedItem?.id) {
        setRemovedSessionIds((old) => {
          const sessionId = String(removedItem.id);
          if (old.includes(sessionId)) return old;
          return [...old, sessionId];
        });
      }

      return prev
        .filter((_, i) => i !== index)
        .map((item, i) => ({
          ...item,
          class_no: i + 1,
        }));
    });
  };

  const handleTimezoneChange = (index, timezoneId) => {
    const selectedTimezone = getTimezoneById(timezoneId);

    setClassPatch(index, {
      teacher_timezoneid: timezoneId,
      teacher_timezone_location: selectedTimezone
        ? getTimezoneValue(selectedTimezone)
        : "",
    });
  };

  const getTeacherById = (teacherid) =>
    teachers.find((t) => String(getTeacherId(t)) === String(teacherid));

  const getAssistantTeacherNamesByIds = (assistantIds) => {
    const ids = normalizeAssistantTeacherIds(assistantIds);

    return ids
      .map((id) => getTeacherById(id))
      .filter(Boolean)
      .map((teacher) => getTeacherName(teacher))
      .filter(Boolean);
  };

  const validateForm = () => {
    if (!form.programme_id) return "Please select a curriculum.";

    const numberOfWeeks = Number(form.number_of_weeks);

    if (
      !isTeacherOnlyEdit &&
      (!Number.isInteger(numberOfWeeks) ||
        numberOfWeeks < 1 ||
        numberOfWeeks > 10)
    ) {
      return "Number of weeks must be between 1 and 10.";
    }

    if (isTeacherOnlyEdit) {
      if (!classes || classes.length < 1) {
        return "No classes found for teacher update.";
      }

      for (let i = 0; i < classes.length; i += 1) {
        const item = classes[i];
        const label = `Class ${i + 1}`;

        if (!item.id) {
          return `${label}: Session ID missing. Teacher setup can only update existing sessions.`;
        }

        if (!item.teacherid) return `${label}: Please select a main teacher.`;

        if (!item.teacher_timezoneid || !item.teacher_timezone_location) {
          return `${label}: Please select the teacher timezone.`;
        }

        if (item.subjectLoading) {
          return `${label}: Teacher profile is still loading.`;
        }

        const assistantIds = cleanAssistantTeacherIds(
          item.assistant_teacher_ids,
          item.teacherid
        );

        if (assistantIds.includes(String(item.teacherid))) {
          return `${label}: Main teacher cannot be selected as assistant teacher.`;
        }
      }

      return "";
    }

    const cap = Number(form.capacity);
    if (!Number.isFinite(cap) || cap <= 0) {
      return "Capacity must be a valid number.";
    }

    if (!classes || classes.length < 1) {
      return "Please add at least one class.";
    }

    for (let i = 0; i < classes.length; i += 1) {
      const item = classes[i];
      const label = `Class ${i + 1}`;

      if (!item.teacherid) return `${label}: Please select a teacher.`;

      if (!item.teacher_timezoneid || !item.teacher_timezone_location) {
        return `${label}: Please select the teacher timezone.`;
      }

      if (item.subjectLoading) return `${label}: Subject is still loading.`;

      if (item.subjectError && !item.subjectOptions?.length) {
        return `${label}: ${item.subjectError}`;
      }

      if (!item.subjectid) return `${label}: Please select a subject.`;
      if (!item.session_date) return `${label}: Please select a session date.`;
      if (!item.slot_start) return `${label}: Please select a start time.`;
      if (!item.slot_end)
        return `${label}: End time will be generated automatically. Please select a start time again.`;

      const start = moment(item.slot_start, ["HH:mm", "HH:mm:ss"], true);
      const end = moment(item.slot_end, ["HH:mm", "HH:mm:ss"], true);

      if (!start.isValid()) return `${label}: Start time is invalid.`;
      if (!end.isValid()) return `${label}: End time is invalid.`;

      const durationMinutes = getTimeDurationMinutes(
        item.slot_start,
        item.slot_end
      );

      if (durationMinutes !== 60) {
        return `${label}: Class duration must be exactly 60 minutes.`;
      }
    }

    return "";
  };

  const getBatchMetaForSave = () => {
    const batchCreatedDate =
      isEditMode && editProgramme?.createddate
        ? editProgramme.createddate
        : moment().format("YYYY-MM-DD HH:mm:ss");

    const firstEditSession = Array.isArray(editProgramme?.sessions)
      ? editProgramme.sessions[0]
      : null;

    const existingGroupBatchId = Number(
      editProgramme?.group_batch_id ||
      firstEditSession?.group_batch_id ||
      classes?.[0]?.group_batch_id ||
      0
    );

    const groupBatchId =
      isEditMode && existingGroupBatchId > 0
        ? existingGroupBatchId
        : generateGroupBatchId();

    return {
      batchCreatedDate,
      groupBatchId,
      numberOfWeeks: getSafeNumberOfWeeks(form.number_of_weeks),
    };
  };

  const buildSingleInsertRow = ({
    item,
    index,
    groupBatchId,
    groupBatchWeekId,
    batchCreatedDate,
    numberOfWeeks,
    weekNo = 1,
    parentSessionId = null,
    dateOffsetWeeks = null,
  }) => {
    if (!Number(groupBatchWeekId)) {
      throw new Error(
        `Week ${weekNo} - Class ${index + 1
        }: group_batch_week_id is missing before session insert.`
      );
    }

    const recurringDate =
      dateOffsetWeeks === null || dateOffsetWeeks === undefined
        ? addRecurringWeeksToDate(item.session_date, weekNo)
        : addWeeksDeltaToDate(item.session_date, dateOffsetWeeks);

    const classItemForSave = {
      ...item,
      session_date: recurringDate,
    };

    const convertedTime = convertPortalClassToTeacherTimezone(classItemForSave);
    const assistantTeacherIds = cleanAssistantTeacherIds(
      item.assistant_teacher_ids,
      item.teacherid
    );

    const row = {
      tablename: "group_live_sessions",

      programme_id: Number(form.programme_id),
      group_batch_id: Number(groupBatchId),
      group_batch_week_id: Number(groupBatchWeekId),
      class_order: Number(index + 1),

      // Compatibility fields. Keep these until old portal/web code is fully migrated.
      recurrence_total_weeks: Number(numberOfWeeks || 1),
      recurrence_week_no: Number(weekNo || 1),
      recurrence_day_no: Number(index + 1),

      title: item.title || buildSessionTitle(item, index),
      subjectid: Number(item.subjectid),
      teacherid: Number(item.teacherid),
      assistant_teacher_ids: assistantTeacherIds.join(","),

      timezoneid: Number(item.teacher_timezoneid),
      timezone_location: item.teacher_timezone_location,

      session_date: convertedTime.session_date,
      slot_start: convertedTime.slot_start,
      slot_end: convertedTime.slot_end,
      capacity: Number(form.capacity || 10),

      classid: null,
      roomid: null,
      classhostlink: null,
      classcommonlink: null,
      classcommonhostlink: null,

      status: item.status || form.status || "active",
      show_on_web: Number(form.show_on_web ?? 1),
      web_sort_order: Number(form.web_sort_order || 0),
      createddate: batchCreatedDate,
    };

    if (parentSessionId) {
      row.recurrence_parent_session_id = Number(parentSessionId);
    } else {
      row.recurrence_parent_session_id = null;
    }

    return row;
  };

  const buildInsertRows = () => {
    const { batchCreatedDate, groupBatchId, numberOfWeeks } =
      getBatchMetaForSave();

    return classes.map((item, index) =>
      buildSingleInsertRow({
        item,
        index,
        groupBatchId,
        groupBatchWeekId: item.group_batch_week_id || 0,
        batchCreatedDate,
        numberOfWeeks,
        weekNo: 1,
        parentSessionId: null,
      })
    );
  };

  const getAllExistingEditSessionIds = () => {
    const editSessions = Array.isArray(editProgramme?.sessions)
      ? editProgramme.sessions
      : [];

    return Array.from(
      new Set(
        editSessions
          .map((session) => session?.id)
          .filter(Boolean)
          .map((id) => String(id))
      )
    );
  };

  const addDynamicData = async (rowPayload, headers) => {
    const response = await axios.post(ADD_DYNAMIC_DATA_URL, rowPayload, {
      headers,
    });

    if (!isSuccessResponse(response)) {
      throw new Error(
        response?.data?.message ||
        response?.data?.error ||
        "Live group session could not be created."
      );
    }

    return response?.data;
  };

  const updateDynamicData = async (sessionId, updatedata, token) => {
    const conditionId = /^\d+$/.test(String(sessionId))
      ? Number(sessionId)
      : sessionId;

    const response = await axios.post(
      UPDATE_DYNAMIC_DATA_URL,
      {
        token,
        tablename: "group_live_sessions",
        conditions: [
          {
            id: conditionId,
          },
        ],
        updatedata: [updatedata],
      },
      {
        headers: API_HEADERS,
      }
    );

    if (!isSuccessResponse(response)) {
      throw new Error(
        response?.data?.message ||
        response?.data?.error ||
        "Live group session could not be updated."
      );
    }

    return response?.data;
  };

  const buildExistingSessionUpdateData = (item, index) => {
    const convertedTime = convertPortalClassToTeacherTimezone(item);
    const assistantTeacherIds = cleanAssistantTeacherIds(
      item.assistant_teacher_ids,
      item.teacherid
    );

    if (!convertedTime.isValid) {
      throw new Error(
        `Week ${getSessionWeekNo(item)} - Class ${getSessionClassOrder(
          item,
          index
        )}: Date/time conversion failed. Please check timezone, date and time.`
      );
    }

    return {
      programme_id: Number(form.programme_id),
      group_batch_id: Number(item.group_batch_id || editProgramme?.group_batch_id || 0),
      group_batch_week_id: Number(item.group_batch_week_id || 0),
      class_order: Number(getSessionClassOrder(item, index)),

      recurrence_total_weeks: Number(getSafeNumberOfWeeks(form.number_of_weeks)),
      recurrence_week_no: Number(getSessionWeekNo(item)),
      recurrence_day_no: Number(getSessionClassOrder(item, index)),
      recurrence_parent_session_id: item.recurrence_parent_session_id || null,

      title: item.title || buildSessionTitle(item, index),
      subjectid: Number(item.subjectid),
      teacherid: Number(item.teacherid),
      assistant_teacher_ids: assistantTeacherIds.join(","),

      timezoneid: Number(item.teacher_timezoneid),
      timezone_location: item.teacher_timezone_location,

      session_date: convertedTime.session_date,
      slot_start: convertedTime.slot_start,
      slot_end: convertedTime.slot_end,
      capacity: Number(form.capacity || 10),

      status: item.status || form.status || "active",
      show_on_web: Number(form.show_on_web ?? 1),
      web_sort_order: Number(form.web_sort_order || 0),
      modifieddate: moment().format("YYYY-MM-DD HH:mm:ss"),
    };
  };

  const updateDynamicTable = async (tablename, rowId, updatedata, token) => {
    const conditionId = /^\d+$/.test(String(rowId)) ? Number(rowId) : rowId;

    const response = await axios.post(
      UPDATE_DYNAMIC_DATA_URL,
      {
        token,
        tablename,
        conditions: [
          {
            id: conditionId,
          },
        ],
        updatedata: [updatedata],
      },
      {
        headers: API_HEADERS,
      }
    );

    if (!isSuccessResponse(response)) {
      throw new Error(
        response?.data?.message ||
        response?.data?.error ||
        `${tablename} could not be updated.`
      );
    }

    return response?.data;
  };

  const getExistingWeekMapByNo = () => {
    const map = {};

    const editSessions = Array.isArray(editProgramme?.sessions)
      ? editProgramme.sessions
      : [];

    editSessions.forEach((session) => {
      const weekNo = getSessionWeekNo(session);

      const weekId = Number(
        session?.group_batch_week_id ||
        session?.week_id ||
        session?.groupBatchWeekId ||
        0
      );

      if (weekNo > 0 && weekId > 0) {
        map[weekNo] = {
          id: weekId,
          week_no: weekNo,
          status: session?.week_status || "active",
        };
      }
    });

    return map;
  };

  const buildWeekDateRange = (weekNo) => {
    const safeClasses = Array.isArray(classes) ? classes : [];
    const targetWeekNo = Number(weekNo || 1);

    const existingWeekClasses = isEditMode
      ? safeClasses.filter(
        (item) => item?.id && getSessionWeekNo(item) === targetWeekNo
      )
      : [];

    const sourceClasses = existingWeekClasses.length
      ? existingWeekClasses
      : safeClasses.filter((item) => {
        if (!item?.id) return true;
        return getSessionWeekNo(item) === getBaseWeekNoFromSessions(safeClasses);
      });

    const weekDates = sourceClasses
      .map((item) => {
        const itemWeekNo = getSessionWeekNo(item);

        if (existingWeekClasses.length) {
          return item.session_date;
        }

        return addWeeksDeltaToDate(item.session_date, targetWeekNo - itemWeekNo);
      })
      .filter(Boolean)
      .sort();

    return {
      week_start_date: weekDates[0] || null,
      week_end_date: weekDates[weekDates.length - 1] || weekDates[0] || null,
    };
  };

  const ensureGroupBatchWeekRow = async ({
    weekNo,
    groupBatchId,
    batchCreatedDate,
    token,
    headers,
    existingWeekMap,
  }) => {
    const range = buildWeekDateRange(weekNo);
    const existingWeek = existingWeekMap?.[Number(weekNo)];

    if (existingWeek?.id) {
      await updateDynamicTable(
        "group_batch_weeks",
        existingWeek.id,
        {
          week_start_date: range.week_start_date,
          week_end_date: range.week_end_date,
          status: "active",
          is_locked: 0,
          locked_reason: null,
          modifieddate: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
        token
      );

      return Number(existingWeek.id);
    }

    /*
     * IMPORTANT:
     * Do not use generic add_dynamic_data for group_batch_weeks here.
     * On this backend that endpoint can route through the user/MeritHub email validation
     * and returns: "This email is already linked to an existing account" even though
     * this payload has no email field. We create/update the week through a small SP
     * called by runStoredProcedure instead.
     */
    const rows = await runStoredProcedure("sp_portal_upsert_group_batch_week", [
      Number(form.programme_id),
      Number(groupBatchId),
      Number(weekNo),
      range.week_start_date || null,
      range.week_end_date || null,
      batchCreatedDate,
    ]);

    const firstRow = Array.isArray(rows) && rows.length ? rows[0] : null;

    const insertedWeekId = Number(
      firstRow?.group_batch_week_id ||
      firstRow?.id ||
      firstRow?.week_id ||
      0
    );

    if (!insertedWeekId) {
      console.error("GROUP WEEK UPSERT SP RESPONSE ID MISSING =>", rows);

      throw new Error(
        `Week ${weekNo}: group_batch_week_id was not returned from sp_portal_upsert_group_batch_week.`
      );
    }

    return Number(insertedWeekId);
  };

  const cancelUnusedOldWeeks = async (existingWeekMap, numberOfWeeks, token) => {
    const cancelledWeeks = [];

    const entries = Object.values(existingWeekMap || {});

    for (const week of entries) {
      if (Number(week.week_no) > Number(numberOfWeeks) && Number(week.id) > 0) {
        const res = await updateDynamicTable(
          "group_batch_weeks",
          week.id,
          {
            status: "cancelled",
            is_locked: 0,
            locked_reason: "Cancelled during no-booking batch update",
            modifieddate: moment().format("YYYY-MM-DD HH:mm:ss"),
          },
          token
        );

        cancelledWeeks.push(res);
      }
    }

    return cancelledWeeks;
  };

  const updateSingleGroupTeacherSetup = async (
    sessionId,
    classItem,
    token,
    sendEmails = false
  ) => {
    const assistantTeacherIds = cleanAssistantTeacherIds(
      classItem.assistant_teacher_ids,
      classItem.teacherid
    ).map((id) => Number(id));

    const response = await axios.post(
      UPDATE_GROUP_TEACHER_SETUP_URL,
      {
        token,
        group_live_session_id: Number(sessionId),
        main_teacherid: Number(classItem.teacherid),
        assistant_teacher_ids: assistantTeacherIds,
        send_emails: sendEmails,
      },
      {
        headers: API_HEADERS,
      }
    );

    if (!isSuccessResponse(response)) {
      throw new Error(
        response?.data?.message ||
        response?.data?.error ||
        `Teacher setup could not be updated for session ${sessionId}.`
      );
    }

    return response?.data;
  };

  const updateGroupTeacherSetup = async (token, sendEmails = true) => {
    const responses = [];

    for (let i = 0; i < classes.length; i += 1) {
      const item = classes[i];

      if (!item.id) {
        throw new Error(`Class ${i + 1}: Session ID missing.`);
      }

      const res = await updateSingleGroupTeacherSetup(
        item.id,
        item,
        token,
        sendEmails
      );

      responses.push(res);
    }

    return {
      sessions_updated: responses.length,
      responses,
    };
  };


  const resolveAssistantTeacherIdsForLocalSync = (
    classItem,
    overrideValue = null,
    fallbackIndex = null
  ) => {
    const rawValues = [];

    if (overrideValue !== null && overrideValue !== undefined) {
      rawValues.push(overrideValue);
    }

    const mapKeys = [
      classItem?.uid,
      String(classItem?.class_no || ""),
      fallbackIndex !== null && fallbackIndex !== undefined
        ? `index_${fallbackIndex}`
        : "",
    ].filter(Boolean);

    mapKeys.forEach((key) => {
      if (assistantDraftMap?.[key]) {
        rawValues.push(assistantDraftMap[key]);
      }
    });

    rawValues.push(
      classItem?.assistant_teacher_ids,
      classItem?.assistant_teacherids,
      classItem?.assistant_teachers,
      classItem?.assistant_teacher_ids_array,
      classItem?._resolved_assistant_teacher_ids
    );

    const allIds = rawValues.flatMap((value) => normalizeAssistantTeacherIds(value));

    return cleanAssistantTeacherIds(allIds, classItem?.teacherid)
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
  };

  const syncPendingTeacherSetupRows = async ({
    sessionId,
    classItem,
    groupBatchId,
    batchCreatedDate,
    assistantTeacherIdsOverride = null,
  }) => {
    if (!sessionId || !classItem?.teacherid) return [];

    const assistantTeacherIds = resolveAssistantTeacherIdsForLocalSync(
      classItem,
      assistantTeacherIdsOverride,
      classItem?._originalIndex ?? null
    );

    const spParams = [
      Number(sessionId),
      Number(form.programme_id),
      Number(groupBatchId || 0),
      Number(classItem.teacherid),
      assistantTeacherIds.join(","),
      batchCreatedDate || moment().format("YYYY-MM-DD HH:mm:ss"),
    ];

    console.log("PORTAL LOCAL TEACHER SETUP SYNC PARAMS =>", {
      sessionId,
      programme_id: form.programme_id,
      groupBatchId,
      mainTeacherId: classItem.teacherid,
      assistantTeacherIds,
      assistantTeacherIdsOverride,
      classItemAssistantTeacherIds: classItem?.assistant_teacher_ids,
      spParams,
    });

    /*
     * IMPORTANT:
     * Do not use update_group_session_teacher_setup here because it can sync MeritHub.
     * Do not use add_dynamic_data either because duplicate rows can fail on repeated edits.
     * This small SP only upserts local group_live_session_teachers rows as pending.
     */
    return await runStoredProcedure("sp_portal_sync_group_session_teachers", spParams);
  };

  const handleCreateSubmit = async (headers, token) => {
    const { batchCreatedDate, groupBatchId, numberOfWeeks } =
      getBatchMetaForSave();

    const existingWeekMap = isEditMode ? getExistingWeekMapByNo() : {};

    const insertedResponses = [];
    const teacherSetupResponses = [];
    const teacherSetupWarnings = [];
    const createdWeeks = [];
    const createdSessions = [];
    const baseInsertedSessionIds = [];

    console.log("GROUP LIVE SESSION BASE CLASSES =>", classes);
    console.log("GROUP LIVE SESSION NUMBER OF WEEKS =>", numberOfWeeks);

    for (let weekNo = 1; weekNo <= numberOfWeeks; weekNo += 1) {
      const groupBatchWeekId = await ensureGroupBatchWeekRow({
        weekNo,
        groupBatchId,
        batchCreatedDate,
        token,
        headers,
        existingWeekMap,
      });

      createdWeeks.push({
        week_no: weekNo,
        group_batch_week_id: Number(groupBatchWeekId),
      });

      for (let i = 0; i < classes.length; i += 1) {
        const classItem = classes[i];
        const parentSessionId =
          weekNo === 1 ? null : baseInsertedSessionIds[i] || null;

        const row = buildSingleInsertRow({
          item: classItem,
          index: i,
          groupBatchId,
          groupBatchWeekId,
          batchCreatedDate,
          numberOfWeeks,
          weekNo,
          parentSessionId,
        });

        try {
          const res = await addDynamicData(row, headers);
          insertedResponses.push(res);

          const insertedSessionId = extractDynamicInsertedId(res);

          if (!insertedSessionId) {
            console.error("GROUP SESSION INSERT RESPONSE ID MISSING =>", res);

            throw new Error(
              `Week ${weekNo} - Class ${i + 1
              }: Session created but inserted ID was not returned.`
            );
          }

          if (weekNo === 1) {
            baseInsertedSessionIds[i] = insertedSessionId;
          }

          createdSessions.push({
            week_no: weekNo,
            class_order: i + 1,
            group_live_session_id: Number(insertedSessionId),
            group_batch_week_id: Number(groupBatchWeekId),
          });

          /*
           * Important:
           * Newly created group sessions do not have a Merithub class yet.
           * Do not call update_group_session_teacher_setup here, because that API
           * can try to sync Merithub users and may return "email already linked".
           * We only create pending rows in group_live_session_teachers.
           * When the first student booking creates/reuses the Merithub class,
           * backend can sync these pending teachers safely.
           */
          try {
            const pendingTeacherRows = await syncPendingTeacherSetupRows({
              sessionId: insertedSessionId,
              classItem,
              groupBatchId,
              batchCreatedDate,
              assistantTeacherIdsOverride: row?.assistant_teacher_ids || classItem?.assistant_teacher_ids,
            });

            teacherSetupResponses.push(...pendingTeacherRows);
          } catch (teacherSetupErr) {
            const warning = {
              week_no: weekNo,
              class_order: i + 1,
              group_live_session_id: Number(insertedSessionId),
              message:
                teacherSetupErr?.message ||
                "Pending teacher setup rows could not be created for this session.",
            };

            console.warn("GROUP TEACHER SETUP PENDING WARNING =>", warning);
            teacherSetupWarnings.push(warning);
          }
        } catch (insertErr) {
          throw new Error(
            `Week ${weekNo} - Class ${i + 1} insert failed: ${insertErr?.message || "Unknown error"
            }`
          );
        }
      }
    }

    if (isEditMode) {
      await cancelUnusedOldWeeks(existingWeekMap, numberOfWeeks, token);
    }

    return {
      group_batch_id: groupBatchId,
      number_of_weeks: numberOfWeeks,
      base_classes: classes.length,
      weeks_created_or_updated: createdWeeks,
      sessions_created: createdSessions,
      total_sessions_created: createdSessions.length,
      insertedResponses,
      teacherSetupResponses,
      teacherSetupWarnings,
    };
  };

  const handleUpdateSubmit = async (headers, token) => {
    if (isTeacherOnlyEdit) {
      return updateGroupTeacherSetup(token, true);
    }

    const bookedCount = getProgrammeBookedCount(editProgramme);

    if (bookedCount > 0) {
      throw new Error(
        "This curriculum already has bookings. Existing weeks/classes are locked. Only teachers and assistant teachers can be updated."
      );
    }

    /*
     * No-booking edit professional flow:
     * 1. Existing sessions are updated directly, so Week 1 / Week 2 stay transparent in portal.
     * 2. If admin increases Number of Weeks, missing week rows and session rows are created.
     * 3. If admin decreases Number of Weeks, extra old sessions/weeks are cancelled, not hard deleted.
     */
    const { batchCreatedDate, groupBatchId, numberOfWeeks } =
      getBatchMetaForSave();

    const existingWeekMap = getExistingWeekMapByNo();
    const updatedSessions = [];
    const createdWeeks = [];
    const createdSessions = [];
    const insertedResponses = [];
    const teacherSetupResponses = [];
    const teacherSetupWarnings = [];
    const cancelledRemovedSessions = [];

    const safeNumberOfWeeks = Number(numberOfWeeks || 1);

    const allEditableClasses = (classes || [])
      .filter(Boolean)
      .map((item, index) => ({
        ...item,
        _originalIndex: index,
      }));

    const baseWeekNo = getBaseWeekNoFromSessions(allEditableClasses);

    const rawBaseTemplates = allEditableClasses
      .filter((item) => {
        if (!item?.id) return true;
        return getSessionWeekNo(item) === baseWeekNo;
      })
      .sort(compareEditSessions);

    if (!rawBaseTemplates.length) {
      throw new Error("No base classes found for this curriculum edit.");
    }

    /*
     * Important old-data fix:
     * Some old batches have English/Maths/Science all saved as class_order = 1.
     * In that case, edit expansion thinks all classes are the same class and only
     * replicates the first one. So for the base week, if class_order is duplicated,
     * resolve class order from the sorted base week row order.
     */
    const rawBaseOrders = rawBaseTemplates.map((item, index) =>
      Number(getSessionClassOrder(item, index))
    );

    const hasDuplicateBaseClassOrders =
      new Set(rawBaseOrders.filter((item) => Number.isFinite(item) && item > 0))
        .size !== rawBaseOrders.length;

    const baseTemplates = rawBaseTemplates.map((item, index) => {
      const resolvedClassOrder = hasDuplicateBaseClassOrders
        ? index + 1
        : getSessionClassOrder(item, index);

      return {
        ...item,
        class_no: resolvedClassOrder,
        class_order: resolvedClassOrder,
        recurrence_day_no: resolvedClassOrder,
        _resolved_class_order: resolvedClassOrder,
      };
    });

    const getTemplateSignature = (item) =>
      [
        String(item?.subjectid || ""),
        String(item?.teacherid || ""),
        normaliseTime(item?.slot_start || ""),
        normaliseTime(item?.slot_end || ""),
      ].join("_");

    const baseClassOrderBySignature = new Map();

    baseTemplates.forEach((template, index) => {
      const classOrder = Number(
        template?._resolved_class_order || getSessionClassOrder(template, index)
      );

      baseClassOrderBySignature.set(getTemplateSignature(template), classOrder);
    });

    const getResolvedClassOrderForEditItem = (item, index = 0) => {
      const signatureClassOrder = baseClassOrderBySignature.get(
        getTemplateSignature(item)
      );

      if (Number(signatureClassOrder) > 0) {
        return Number(signatureClassOrder);
      }

      const fallbackClassOrder = Number(
        item?._resolved_class_order || getSessionClassOrder(item, index)
      );

      return Number.isFinite(fallbackClassOrder) && fallbackClassOrder > 0
        ? fallbackClassOrder
        : index + 1;
    };

    const existingClasses = allEditableClasses
      .filter((item) => item?.id)
      .map((item, index) => {
        const resolvedClassOrder = getResolvedClassOrderForEditItem(item, index);

        return {
          ...item,
          class_no: resolvedClassOrder,
          class_order: resolvedClassOrder,
          recurrence_day_no: resolvedClassOrder,
          _resolved_class_order: resolvedClassOrder,
        };
      });

    const existingKeySet = new Set(
      existingClasses
        .filter((item) => getSessionWeekNo(item) <= safeNumberOfWeeks)
        .map(
          (item, index) =>
            `${getSessionWeekNo(item)}_${getResolvedClassOrderForEditItem(
              item,
              index
            )}`
        )
    );

    const baseParentSessionByClassOrder = new Map();

    baseTemplates.forEach((item, index) => {
      const classOrder = getResolvedClassOrderForEditItem(item, index);

      if (item?.id) {
        baseParentSessionByClassOrder.set(classOrder, Number(item.id));
      }
    });

    /*
     * Assistant inheritance for recurring edit:
     * Portal is transparent, so all weeks can appear. But teacher setup is controlled
     * from the base week class. If Week 1 has assistant teachers and Week 2/3/4
     * sessions were created later, those weeks must inherit the same assistants.
     * If admin clears assistants on the base class, inherited list becomes empty
     * and old assistant rows on other weeks will be inactivated by sync SP.
     */
    const baseAssistantIdsByClassOrder = new Map();

    baseTemplates.forEach((template, index) => {
      const classOrder = getResolvedClassOrderForEditItem(template, index);

      const assistantIds = cleanAssistantTeacherIds(
        template?.assistant_teacher_ids,
        template?.teacherid
      );

      baseAssistantIdsByClassOrder.set(Number(classOrder), assistantIds);
    });

    const withInheritedAssistants = (item, index) => {
      const classOrder = getResolvedClassOrderForEditItem(item, index);

      const ownAssistantIds = cleanAssistantTeacherIds(
        item?.assistant_teacher_ids,
        item?.teacherid
      );

      const inheritedAssistantIds =
        baseAssistantIdsByClassOrder.get(Number(classOrder)) || [];

      return {
        ...item,
        class_no: classOrder,
        class_order: classOrder,
        recurrence_day_no: classOrder,
        _resolved_class_order: classOrder,
        assistant_teacher_ids: ownAssistantIds.length
          ? ownAssistantIds
          : inheritedAssistantIds,
      };
    };

    /* Update existing sessions that are still inside selected number of weeks. */
    for (let i = 0; i < existingClasses.length; i += 1) {
      const item = existingClasses[i];
      const weekNo = getSessionWeekNo(item);

      if (weekNo > Number(numberOfWeeks || 1)) {
        continue;
      }

      const classOrder = getResolvedClassOrderForEditItem(item, i);
      const itemForSave = withInheritedAssistants(item, classOrder - 1);
      const updatePayload = buildExistingSessionUpdateData(
        itemForSave,
        classOrder - 1
      );
      const res = await updateDynamicData(item.id, updatePayload, token);

      updatedSessions.push({
        id: item.id,
        week_no: weekNo,
        class_order: classOrder,
        response: res,
      });

      try {
        const teacherRows = await syncPendingTeacherSetupRows({
          sessionId: item.id,
          classItem: itemForSave,
          groupBatchId,
          batchCreatedDate,
          assistantTeacherIdsOverride: updatePayload?.assistant_teacher_ids || itemForSave?.assistant_teacher_ids,
        });

        teacherSetupResponses.push(...teacherRows);
      } catch (teacherSetupErr) {
        teacherSetupWarnings.push({
          id: item.id,
          message:
            teacherSetupErr?.message ||
            "Teacher setup rows could not be synced for this existing session.",
        });
      }
    }

    /* Create missing sessions when admin expands 1 week to 2/3/4 weeks or adds a new class. */
    for (let weekNo = 1; weekNo <= Number(numberOfWeeks || 1); weekNo += 1) {
      const groupBatchWeekId = await ensureGroupBatchWeekRow({
        weekNo,
        groupBatchId,
        batchCreatedDate,
        token,
        headers,
        existingWeekMap,
      });

      createdWeeks.push({
        week_no: weekNo,
        group_batch_week_id: Number(groupBatchWeekId),
      });

      for (let templateIndex = 0; templateIndex < baseTemplates.length; templateIndex += 1) {
        const template = baseTemplates[templateIndex];

        const classOrder = getResolvedClassOrderForEditItem(
          template,
          templateIndex
        );

        const templateForSave = withInheritedAssistants(
          template,
          classOrder - 1
        );
        const sessionKey = `${weekNo}_${classOrder}`;

        if (existingKeySet.has(sessionKey)) {
          continue;
        }

        const templateWeekNo = getSessionWeekNo(templateForSave);
        const parentSessionId =
          weekNo === templateWeekNo
            ? null
            : baseParentSessionByClassOrder.get(classOrder) ||
            (Number(templateForSave?.id || 0) > 0 ? Number(templateForSave.id) : null);

        const row = buildSingleInsertRow({
          item: {
            ...templateForSave,
            id: "",
            group_batch_id: groupBatchId,
            group_batch_week_id: groupBatchWeekId,
            week_no: weekNo,
            recurrence_week_no: weekNo,
            class_order: classOrder,
            recurrence_day_no: classOrder,
            status: form.status || "active",
          },
          index: classOrder - 1,
          groupBatchId,
          groupBatchWeekId,
          batchCreatedDate,
          numberOfWeeks,
          weekNo,
          parentSessionId,
          dateOffsetWeeks: weekNo - templateWeekNo,
        });

        try {
          const res = await addDynamicData(row, headers);
          insertedResponses.push(res);

          const insertedSessionId = extractDynamicInsertedId(res);

          if (!insertedSessionId) {
            console.error("GROUP SESSION INSERT RESPONSE ID MISSING =>", res);

            throw new Error(
              `Week ${weekNo} - Class ${classOrder}: Session created but inserted ID was not returned.`
            );
          }

          existingKeySet.add(sessionKey);

          if (weekNo === templateWeekNo) {
            baseParentSessionByClassOrder.set(classOrder, Number(insertedSessionId));
          }

          createdSessions.push({
            week_no: weekNo,
            class_order: classOrder,
            group_live_session_id: Number(insertedSessionId),
            group_batch_week_id: Number(groupBatchWeekId),
          });

          try {
            const teacherRows = await syncPendingTeacherSetupRows({
              sessionId: insertedSessionId,
              classItem: templateForSave,
              groupBatchId,
              batchCreatedDate,
              assistantTeacherIdsOverride: row?.assistant_teacher_ids || templateForSave?.assistant_teacher_ids,
            });

            teacherSetupResponses.push(...teacherRows);
          } catch (teacherSetupErr) {
            teacherSetupWarnings.push({
              week_no: weekNo,
              class_order: classOrder,
              group_live_session_id: Number(insertedSessionId),
              message:
                teacherSetupErr?.message ||
                "Pending teacher setup rows could not be synced for this expanded week session.",
            });
          }
        } catch (insertErr) {
          throw new Error(
            `Week ${weekNo} - Class ${classOrder} insert failed: ${insertErr?.message || "Unknown error"
            }`
          );
        }
      }
    }

    /* Cancel manually removed sessions and sessions beyond the selected week count. */
    const overflowSessionIds = (Array.isArray(editProgramme?.sessions)
      ? editProgramme.sessions
      : []
    )
      .filter(isVisibleEditSession)
      .filter((session) => getSessionWeekNo(session) > Number(numberOfWeeks || 1))
      .map((session) => session?.id)
      .filter(Boolean)
      .map((id) => String(id));

    const cancelIdSet = new Set([
      ...removedSessionIds.map((id) => String(id)),
      ...overflowSessionIds,
    ]);

    for (const sessionId of cancelIdSet) {
      const res = await updateDynamicData(
        sessionId,
        {
          status: "cancelled",
          modifieddate: moment().format("YYYY-MM-DD HH:mm:ss"),
        },
        token
      );

      cancelledRemovedSessions.push(res);
    }

    await cancelUnusedOldWeeks(existingWeekMap, numberOfWeeks, token);

    return {
      group_batch_id: groupBatchId,
      number_of_weeks: numberOfWeeks,
      sessions_updated: updatedSessions.length,
      sessions_created: createdSessions.length,
      updatedSessions,
      createdWeeks,
      createdSessions,
      insertedResponses,
      removed_sessions_cancelled: cancelIdSet.size,
      cancelledRemovedSessions,
      teacherSetupResponses,
      teacherSetupWarnings,
    };
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
        throw new Error("Authentication token not found.");
      }

      const headers = {
        ...API_HEADERS,
        token,
      };

      const result = isEditMode
        ? await handleUpdateSubmit(headers, token)
        : await handleCreateSubmit(headers, token);

      const totalGeneratedSessions =
        classes.length * getSafeNumberOfWeeks(form.number_of_weeks);

      const successText = isTeacherOnlyEdit
        ? "Teachers and assistant teachers updated successfully."
        : isEditMode
          ? "Live group sessions updated successfully."
          : `${totalGeneratedSessions} live group session${totalGeneratedSessions > 1 ? "s" : ""
          } created successfully.`;

      setSuccessMsg(successText);

      setTimeout(() => {
        onSuccess?.({
          mode: isEditMode ? "edit" : "create",
          teacherOnlyEdit: isTeacherOnlyEdit,
          result,
        });
        onClose?.();
      }, 700);
    } catch (err) {
      console.error("Create/update live group sessions failed:", err);
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
      const convertedTime = convertPortalClassToTeacherTimezone(item);
      const assistantNames = getAssistantTeacherNamesByIds(
        item.assistant_teacher_ids
      );

      return {
        index,
        teacherName: getTeacherName(teacher) || item.teacher_name || "",
        assistantNames,
        subjectName: getSubjectName(subject),
        title: item.title || buildSessionTitle(item, index),

        adminDate: convertedTime.isValid
          ? convertedTime.portal_date_label
          : item.session_date || "-",
        adminTime: convertedTime.isValid
          ? convertedTime.portal_time_label
          : item.slot_start && item.slot_end
            ? `${item.slot_start} - ${item.slot_end}`
            : "-",

        teacherDate: convertedTime.isValid
          ? convertedTime.teacher_date_label
          : "-",
        teacherTime: convertedTime.isValid
          ? convertedTime.teacher_time_label
          : "-",

        timezone: item.teacher_timezone_location || "",
        timezoneid: item.teacher_timezoneid || "",
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
          height: min(94vh, 920px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 22px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          background: #243247;
          color: #ffffff;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.50);
        }

        .gl-create-header {
          flex-shrink: 0;
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
          cursor: pointer;
        }

        .gl-create-close:hover {
          background: rgba(239, 68, 68, 0.16);
          border-color: rgba(239, 68, 68, 0.48);
          color: #ffffff;
        }

        .gl-create-close:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .gl-create-form {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .gl-create-body {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          padding: 24px 26px 28px;
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
          flex-shrink: 0;
          padding: 16px 26px;
          border-top: 1px solid rgba(148, 163, 184, 0.20);
          background: #202e42;
          position: sticky;
          bottom: 0;
          z-index: 2;
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

        .gl-create-body .form-control:disabled,
        .gl-create-body .form-select:disabled {
          opacity: 0.75;
          cursor: not-allowed;
        }

        .gl-create-body .form-select option {
          background: #243247;
          color: #ffffff;
        }

        .gl-time-disabled {
          opacity: 0.85 !important;
          cursor: not-allowed;
          background: #172033 !important;
        }

        .gl-lock-note {
          border-radius: 14px;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.28);
          color: #fde68a;
          font-weight: 800;
          padding: 11px 14px;
          margin-bottom: 14px;
          font-size: 13px;
          line-height: 1.55;
        }

        .gl-visibility-card {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.46);
          padding: 14px 16px;
          height: 100%;
        }

        .gl-visibility-title {
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          margin-bottom: 3px;
        }

        .gl-visibility-subtitle {
          color: #9fb0c8;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.45;
        }

        .gl-visibility-switch {
          position: relative;
          width: 54px;
          height: 30px;
          flex: 0 0 auto;
        }

        .gl-visibility-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .gl-visibility-slider {
          position: absolute;
          cursor: pointer;
          inset: 0;
          background: #475569;
          transition: 0.2s;
          border-radius: 999px;
        }

        .gl-visibility-slider:before {
          position: absolute;
          content: "";
          height: 22px;
          width: 22px;
          left: 4px;
          top: 4px;
          background: #ffffff;
          transition: 0.2s;
          border-radius: 50%;
        }

        .gl-visibility-switch input:checked + .gl-visibility-slider {
          background: #22c55e;
        }

        .gl-visibility-switch input:checked + .gl-visibility-slider:before {
          transform: translateX(24px);
        }

        .gl-visibility-badge-text {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          margin-top: 8px;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .gl-web-settings-row {
          display: grid;
          grid-template-columns: 1fr 150px 60px;
          align-items: center;
          gap: 18px;
        }

        .gl-web-visibility-content {
          min-width: 0;
        }

        .gl-web-sort-wrap {
          width: 150px;
        }

        .gl-web-sort-label {
          color: #dbe4f0;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
          display: block;
        }

        .gl-web-sort-input {
          width: 100%;
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: #1b2738;
          color: #ffffff;
          padding: 0 12px;
          font-size: 14px;
          font-weight: 900;
          outline: none;
        }

        .gl-web-sort-input:focus {
          border-color: #3b82f6;
        }

        .gl-web-sort-input:disabled {
          opacity: 0.75;
          cursor: not-allowed;
        }

        .gl-web-sort-help {
          display: block;
          color: #9fb0c8;
          font-size: 10px;
          font-weight: 700;
          margin-top: 5px;
          line-height: 1.3;
        }

        .gl-visibility-badge-public {
          color: #86efac;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        .gl-visibility-badge-private {
          color: #fcd34d;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.28);
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
          overflow: visible;
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

        .gl-timezone-note {
          color: #86efac;
          font-size: 12px;
          font-weight: 750;
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

        .gl-add-class-wrap {
          display: flex;
          justify-content: flex-end;
          margin: 4px 0 18px;
        }

        .gl-add-class-btn {
          border: 1px solid rgba(59, 130, 246, 0.45);
          background: rgba(59, 130, 246, 0.14);
          color: #dbeafe;
          border-radius: 999px;
          padding: 10px 18px;
          font-weight: 900;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .gl-add-class-btn:hover {
          background: rgba(59, 130, 246, 0.22);
          color: #ffffff;
        }

        .gl-add-class-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .gl-remove-class-btn {
          border: 1px solid rgba(248, 113, 113, 0.42);
          background: rgba(239, 68, 68, 0.12);
          color: #fecaca;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .gl-remove-class-btn:hover {
          background: rgba(239, 68, 68, 0.22);
          color: #ffffff;
        }

        .gl-remove-class-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .gl-teacher-select-wrap {
          position: relative;
          width: 100%;
        }

        .gl-teacher-select-btn {
          width: 100%;
          min-height: 50px;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: #1b2738;
          color: #ffffff;
          padding: 0 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-weight: 750;
          text-align: left;
        }

        .gl-teacher-select-btn:disabled {
          opacity: 0.75;
          cursor: not-allowed;
        }

        .gl-teacher-placeholder {
          color: #8296b1;
        }

        .gl-teacher-selected {
          color: #ffffff;
        }

        .gl-teacher-arrow {
          color: #ffffff;
          font-size: 12px;
          flex: 0 0 auto;
        }

        .gl-teacher-dropdown {
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

        .gl-teacher-search-box {
          padding: 10px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          background: #111827;
        }

        .gl-teacher-search-input {
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

        .gl-teacher-search-input::placeholder {
          color: #8b97aa;
        }

        .gl-teacher-search-input:focus {
          border-color: rgba(59, 130, 246, 0.85);
          box-shadow: 0 0 0 0.2rem rgba(59, 130, 246, 0.16);
        }

        .gl-teacher-options {
          max-height: 260px;
          overflow-y: auto;
          padding: 8px;
        }

        .gl-teacher-options::-webkit-scrollbar {
          width: 8px;
        }

        .gl-teacher-options::-webkit-scrollbar-track {
          background: #111827;
        }

        .gl-teacher-options::-webkit-scrollbar-thumb {
          background: #6b7280;
          border-radius: 999px;
        }

        .gl-teacher-option {
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
          font-weight: 900;
        }

        .gl-teacher-option:hover,
        .gl-teacher-option.active {
          background: rgba(59, 130, 246, 0.14);
        }

        .gl-teacher-avatar {
          width: 30px;
          height: 30px;
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

        .gl-teacher-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .gl-teacher-avatar-fallback {
          font-size: 13px;
          font-weight: 900;
          color: #cbd5e1;
        }

        .gl-teacher-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gl-teacher-empty {
          padding: 18px 12px;
          text-align: center;
          color: #94a3b8;
          font-weight: 800;
        }

        .gl-assistant-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 8px;
        }

        .gl-assistant-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border-radius: 999px;
          padding: 5px 9px;
          color: #bfdbfe;
          background: rgba(59, 130, 246, 0.14);
          border: 1px solid rgba(59, 130, 246, 0.26);
          font-size: 11px;
          font-weight: 900;
          line-height: 1;
        }

        .gl-assistant-chip button {
          border: 0;
          background: transparent;
          color: #ffffff;
          padding: 0;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
        }

        .gl-assistant-check {
          width: 20px;
          height: 20px;
          border-radius: 7px;
          border: 1px solid rgba(148, 163, 184, 0.34);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #86efac;
          font-size: 12px;
          font-weight: 900;
          flex: 0 0 auto;
        }

        .gl-assistant-dropdown-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 10px;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
          background: #111827;
        }

        .gl-assistant-dropdown-footer button {
          border: 1px solid rgba(148, 163, 184, 0.28);
          background: rgba(15, 23, 42, 0.78);
          color: #ffffff;
          border-radius: 10px;
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 900;
        }

        .gl-assistant-dropdown-footer button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 767px) {
          .gl-create-modal {
            width: 100%;
            height: 94vh;
            border-radius: 18px;
          }

          .gl-create-header,
          .gl-create-body,
          .gl-create-footer {
            padding-left: 16px;
            padding-right: 16px;
          }

          .gl-create-body {
            padding-bottom: 20px;
          }

          .gl-create-title {
            font-size: 23px;
          }

          .gl-class-body {
            padding: 16px;
          }

          .gl-create-footer {
            padding-top: 14px;
            padding-bottom: 14px;
          }

          .gl-submit-btn,
          .gl-cancel-btn {
            width: 100%;
          }

          .gl-add-class-wrap {
            justify-content: stretch;
          }

          .gl-add-class-btn {
            width: 100%;
          }

          .gl-class-header {
            align-items: flex-start;
          }

          .gl-web-settings-row {
            grid-template-columns: 1fr;
            align-items: flex-start;
          }

          .gl-web-sort-wrap {
            width: 100%;
          }

          .gl-visibility-switch {
            margin-left: auto;
          }
        }
      `}</style>

      <div className="gl-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gl-create-header d-flex justify-content-between align-items-start gap-3">
          <div>
            <h4 className="gl-create-title">
              {isTeacherOnlyEdit
                ? "Update Teachers & Assistants"
                : isEditMode
                  ? "Edit Live Group Sessions"
                  : "Create Live Group Sessions"}
            </h4>

            <div className="gl-create-subtitle">
              {isTeacherOnlyEdit
                ? "This batch already has bookings, so only main teachers and assistant teachers can be updated."
                : isEditMode
                  ? "Update curriculum classes, teacher, subject, timezone, date and time."
                  : "Select curriculum and create one or more live classes."}
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

        <form className="gl-create-form" onSubmit={handleSubmit}>
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
              <div className="alert alert-info gl-alert py-2">Loading...</div>
            ) : null}

            {isTeacherOnlyEdit ? (
              <div className="gl-lock-note">
                Bookings already exist for this batch. Curriculum, subject, date,
                time, capacity and web settings are locked. You can update only
                teachers and assistant teachers.
              </div>
            ) : null}

            <div className="gl-top-card">
              <div className="row g-3">
                <div className="col-lg-4">
                  <label className="form-label">Curriculum</label>
                  <select
                    className="form-select"
                    value={form.programme_id}
                    onChange={(e) => setField("programme_id", e.target.value)}
                    disabled={loading || lookupsLoading || isCurriculumLocked}
                  >
                    <option value="">Select Curriculum</option>

                    {programmes.map((item, index) => {
                      const programmeId = getProgrammeId(item);
                      const programmeName =
                        item?.name ||
                        item?.programme_name ||
                        item?.programmename ||
                        item?.title ||
                        `Curriculum ${index + 1}`;

                      const programmeStage =
                        item?.stage || item?.programme_stage || "";

                      return (
                        <option key={programmeId || index} value={programmeId}>
                          {programmeName}
                          {programmeStage ? ` - ${programmeStage}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="col-lg-2 col-md-6">
                  <label className="form-label">Capacity</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.capacity}
                    onChange={(e) => setField("capacity", e.target.value)}
                    min="1"
                    disabled={loading || isCurriculumLocked}
                  />
                </div>

                <div className="col-lg-3 col-md-6">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(e) => setField("status", e.target.value)}
                    disabled={loading || isCurriculumLocked}
                  >
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="col-lg-3 col-md-6">
                  <label className="form-label">Number of Weeks</label>

                  <select
                    className="form-select"
                    value={form.number_of_weeks}
                    onChange={(e) => setField("number_of_weeks", e.target.value)}
                    disabled={loading || isCurriculumLocked || isTeacherOnlyEdit}
                  >
                    {Array.from({ length: 10 }, (_, index) => {
                      const week = index + 1;

                      return (
                        <option key={week} value={String(week)}>
                          {week} {week === 1 ? "Week" : "Weeks"}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="col-lg-12">
                  <div className="gl-visibility-card">
                    <div className="gl-web-settings-row">
                      <div className="gl-web-visibility-content">
                        <div className="gl-visibility-title">
                          Website Visibility
                        </div>

                        <div className="gl-visibility-subtitle">
                          If public, this batch will appear on the website
                          listing. If private, it will be hidden from the
                          listing but users can still book through the direct
                          link.
                        </div>

                        <span
                          className={`gl-visibility-badge-text ${Number(form.show_on_web ?? 1) === 1
                            ? "gl-visibility-badge-public"
                            : "gl-visibility-badge-private"
                            }`}
                        >
                          {Number(form.show_on_web ?? 1) === 1
                            ? "Public Batch"
                            : "Private Batch"}
                        </span>
                      </div>

                      <div className="gl-web-sort-wrap">
                        <label className="gl-web-sort-label">Sort Order</label>

                        <input
                          type="number"
                          className="gl-web-sort-input"
                          min="0"
                          value={form.web_sort_order}
                          onChange={(e) =>
                            setField("web_sort_order", e.target.value)
                          }
                          placeholder="1"
                          disabled={loading || isCurriculumLocked}
                        />

                        <small className="gl-web-sort-help">
                          Lower number appears first
                        </small>
                      </div>

                      <label className="gl-visibility-switch">
                        <input
                          type="checkbox"
                          checked={Number(form.show_on_web ?? 1) === 1}
                          disabled={loading || isCurriculumLocked}
                          onChange={(e) =>
                            setField("show_on_web", e.target.checked ? "1" : "0")
                          }
                        />
                        <span className="gl-visibility-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {classes.map((item, index) => {
              const teacher = getTeacherById(item.teacherid);
              const subject = getSubjectByClassItem(item);
              const autoTitle = buildSessionTitle(item, index);
              const assistantNames = getAssistantTeacherNamesByIds(
                item.assistant_teacher_ids
              );

              return (
                <div className="gl-class-card" key={item.uid || item.class_no}>
                  <div className="gl-class-header">
                    <div>
                      <h6 className="gl-class-title">
                        {isEditMode
                          ? `Week ${item.week_no || getSessionWeekNo(item)} • Class ${item.class_order || getSessionClassOrder(item, index)
                          }`
                          : `Class ${index + 1}`}
                      </h6>

                      <div className="gl-class-subtitle">
                        {getTeacherName(teacher) ||
                          item.teacher_name ||
                          "Teacher not selected"}
                        {getSubjectName(subject)
                          ? ` • ${getSubjectName(subject)}`
                          : ""}
                      </div>

                      {assistantNames.length ? (
                        <div className="gl-class-subtitle mt-1">
                          Assistants: {assistantNames.join(", ")}
                        </div>
                      ) : null}

                      {item.teacher_timezone_location ? (
                        <div className="gl-timezone-note">
                          Timezone: {item.teacher_timezone_location}
                          {item.teacher_timezoneid
                            ? ` (ID: ${item.teacher_timezoneid})`
                            : ""}
                        </div>
                      ) : null}
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-primary">
                        {isTeacherOnlyEdit
                          ? "Teachers Only"
                          : isEditMode
                            ? "Editable Session"
                            : "Required"}
                      </span>

                      {!isCurriculumLocked && classes.length > 1 ? (
                        <button
                          type="button"
                          className="gl-remove-class-btn"
                          onClick={() => handleRemoveClass(index)}
                          disabled={loading}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="gl-class-body">
                    <div className="row g-3">
                      <div className="col-lg-4 col-md-6">
                        <label className="form-label">Main Teacher</label>

                        <SearchableTeacherSelect
                          teachers={teachers}
                          value={item.teacherid}
                          disabled={loading || lookupsLoading}
                          placeholder="Select Teacher"
                          fallbackLabel={item.teacher_name}
                          onChange={(teacherId) =>
                            handleTeacherChange(index, teacherId)
                          }
                        />
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <label className="form-label">Assistant Teachers</label>

                        <SearchableAssistantTeachersSelect
                          teachers={teachers}
                          value={item.assistant_teacher_ids}
                          mainTeacherId={item.teacherid}
                          disabled={loading || lookupsLoading}
                          placeholder="Select Assistant Teachers"
                          onChange={(selectedIds) =>
                            handleAssistantTeachersChange(index, selectedIds)
                          }
                        />
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
                            isCurriculumLocked ||
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
                            Teacher profile loading...
                          </div>
                        ) : null}

                        {item.subjectError && !isTeacherOnlyEdit ? (
                          <div className="gl-subject-error">
                            {item.subjectError}
                          </div>
                        ) : null}
                      </div>

                      <div className="col-lg-4 col-md-12">
                        <label className="form-label">Teacher Timezone</label>
                        <select
                          className="form-select"
                          value={item.teacher_timezoneid || ""}
                          onChange={(e) =>
                            handleTimezoneChange(index, e.target.value)
                          }
                          disabled={loading || lookupsLoading}
                        >
                          <option value="">Select Timezone</option>

                          {timezones.map((tz) => {
                            const tzId = getTimezoneId(tz);
                            const tzValue = getTimezoneValue(tz);
                            const tzLabel = getTimezoneLabel(tz);

                            return (
                              <option key={`${tzId}-${tzValue}`} value={tzId}>
                                {tzLabel}
                              </option>
                            );
                          })}
                        </select>

                        {item.teacher_timezone_location ? (
                          <div className="gl-timezone-note">
                            Selected: {item.teacher_timezone_location}
                            {item.teacher_timezoneid
                              ? ` (ID: ${item.teacher_timezoneid})`
                              : ""}
                          </div>
                        ) : (
                          <div className="gl-subject-error">
                            Please select teacher timezone.
                          </div>
                        )}
                      </div>

                      <div className="col-lg-4 col-md-12">
                        <label className="form-label">Session Title</label>
                        <input
                          type="text"
                          className="form-control"
                          value={item.title}
                          onChange={(e) =>
                            updateClass(index, "title", e.target.value)
                          }
                          placeholder={autoTitle}
                          disabled={loading || isCurriculumLocked}
                        />
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <label className="form-label">
                          Session Date - Admin Time (Asia/Dubai)
                        </label>
                        <input
                          type="date"
                          className="form-control"
                          value={item.session_date}
                          onChange={(e) =>
                            updateClass(index, "session_date", e.target.value)
                          }
                          disabled={loading || isCurriculumLocked}
                        />
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <label className="form-label">
                          Start Time - Admin Time (Asia/Dubai)
                        </label>
                        <input
                          type="time"
                          className="form-control"
                          value={item.slot_start}
                          onChange={(e) =>
                            handleStartTimeChange(index, e.target.value)
                          }
                          disabled={loading || isCurriculumLocked}
                        />
                      </div>

                      <div className="col-lg-4 col-md-6">
                        <label className="form-label">End Time</label>
                        <input
                          type="time"
                          className="form-control gl-time-disabled"
                          value={item.slot_end}
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {!isCurriculumLocked && !isEditMode ? (
              <div className="gl-add-class-wrap">
                <button
                  type="button"
                  className="gl-add-class-btn"
                  onClick={handleAddClass}
                  disabled={loading}
                >
                  + Add Another Class
                </button>
              </div>
            ) : null}

            <div className="gl-preview-card">
              <div className="gl-preview-title">Preview</div>

              <div className="gl-preview-line">
                <strong>Curriculum:</strong> {selectedProgrammeName || "-"}
              </div>

              <div className="gl-preview-line">
                <strong>Stage:</strong>{" "}
                {selectedProgramme?.stage ||
                  editProgramme?.programme_stage ||
                  preselectedProgramme?.programme_stage ||
                  "-"}
              </div>

              <div className="gl-preview-line">
                <strong>Group Session Price:</strong>{" "}
                {selectedProgramme?.weekly_price ||
                  editProgramme?.weekly_price ||
                  preselectedProgramme?.weekly_price
                  ? `AED ${selectedProgramme?.weekly_price ||
                  editProgramme?.weekly_price ||
                  preselectedProgramme?.weekly_price
                  }`
                  : "-"}
              </div>

              {!isTeacherOnlyEdit ? (
                <>
                  <div className="gl-preview-line">
                    <strong>Number of Weeks:</strong>{" "}
                    {getSafeNumberOfWeeks(form.number_of_weeks)} Week
                    {getSafeNumberOfWeeks(form.number_of_weeks) > 1 ? "s" : ""}
                  </div>

                  <div className="gl-preview-line">
                    <strong>Total Sessions to Create:</strong> {classes.length}{" "}
                    class{classes.length > 1 ? "es" : ""} ×{" "}
                    {getSafeNumberOfWeeks(form.number_of_weeks)} week
                    {getSafeNumberOfWeeks(form.number_of_weeks) > 1 ? "s" : ""} ={" "}
                    {classes.length * getSafeNumberOfWeeks(form.number_of_weeks)}
                    {" sessions"}
                  </div>
                </>
              ) : null}

              <div className="gl-preview-line">
                <strong>Capacity:</strong> {form.capacity || "-"} students
              </div>

              <div className="gl-preview-line">
                <strong>Website Visibility:</strong>{" "}
                {Number(form.show_on_web ?? 1) === 1
                  ? "Public - Show on website listing"
                  : "Private - Hide from listing, direct link booking allowed"}
              </div>

              <div className="gl-preview-line">
                <strong>Web Sort Order:</strong>{" "}
                {Number(form.web_sort_order || 0) === 0
                  ? "Default"
                  : Number(form.web_sort_order || 0)}
              </div>

              {previewClasses.map((item) => (
                <div className="gl-preview-line" key={item.index}>
                  <strong>Class {item.index + 1}:</strong> {item.title || "-"} |{" "}
                  Main Teacher: {item.teacherName || "-"}
                  <br />
                  <strong>Assistant Teachers:</strong>{" "}
                  {item.assistantNames?.length
                    ? item.assistantNames.join(", ")
                    : "-"}
                  <br />
                  <strong>Admin Time:</strong> {item.adminDate} |{" "}
                  {item.adminTime} | Asia/Dubai
                  <br />
                  <strong>Teacher Save Time:</strong> {item.teacherDate} |{" "}
                  {item.teacherTime} | {item.timezone || "Timezone not selected"}
                  {item.timezoneid ? ` | Timezone ID: ${item.timezoneid}` : ""}
                </div>
              ))}
            </div>
          </div>

          <div className="gl-create-footer d-flex justify-content-end gap-2 flex-wrap">
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
              {loading
                ? isTeacherOnlyEdit
                  ? "Updating Teachers..."
                  : isEditMode
                    ? "Updating..."
                    : "Creating..."
                : isTeacherOnlyEdit
                  ? "Update Teachers & Assistants"
                  : isEditMode
                    ? "Update Sessions"
                    : "Create Sessions"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLiveGroupModal;