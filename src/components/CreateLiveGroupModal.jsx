import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
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
                    className={`gl-teacher-option ${isSelected ? "active" : ""
                      }`}
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

const makeEmptyClass = (index) => ({
  uid: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
  id: "",
  class_no: index + 1,
  subjectid: "",
  teacherid: "",
  teacher_name: "",

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
const CreateLiveGroupModal = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedProgramme = null,
  mode = "create",
  editProgramme = null,
}) => {
  const isEditMode = mode === "edit" && !!editProgramme;
  const [programmes, setProgrammes] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [timezones, setTimezones] = useState([]);

  const [form, setForm] = useState({
    programme_id: "",
    capacity: "10",
    status: "active",
  });

  const [classes, setClasses] = useState([makeEmptyClass(0)]);
  const [removedSessionIds, setRemovedSessionIds] = useState([]);

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
    const editSessions = Array.isArray(programme?.sessions)
      ? programme.sessions
      : [];

    const firstSession = editSessions[0] || {};

    setForm({
      programme_id: String(programme?.programme_id || firstSession?.programme_id || ""),
      capacity: String(programme?.capacity || firstSession?.capacity || "10"),
      status: String(programme?.status || firstSession?.status || "active"),
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

      return {
        uid: `edit-${session?.id || index}-${Date.now()}`,
        id: session?.id || "",
        group_batch_id:
          session?.group_batch_id ||
          programme?.group_batch_id ||
          "",
        class_no: index + 1,
        subjectid: String(session?.subjectid || ""),
        teacherid: String(
          session?.teacherid || session?.teacher_id || session?.userid || ""
        ),
        teacher_name:
          session?.teacher_name ||
          session?.teacher_fullname ||
          session?.fullname ||
          "",

        teacher_timezoneid: String(
          getTimezoneId(matchedTimezone) || session?.timezoneid || ""
        ),
        teacher_timezone_location:
          getTimezoneValue(matchedTimezone) ||
          session?.timezone_location ||
          session?.timezone ||
          "",

        session_date: session?.session_date || "",
        slot_start: formatTimeForInput(session?.slot_start),
        slot_end: formatTimeForInput(session?.slot_end),
        title: session?.title || "",
        status: session?.status || programme?.status || "active",
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
        console.error("Programme lookup failed:", programmeErr);
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
        }));
      }

      if (!programmeRows?.length) {
        setError(
          "Programme list could not be loaded. Please check get_portal_programmes response."
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

    setForm({
      programme_id: "",
      capacity: "10",
      status: "active",
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

  const fetchTeacherSubjectsForClass = async (index, teacherid) => {
    if (!teacherid) {
      setClassPatch(index, {
        teacherid: "",
        subjectid: "",
        title: "",
        teacher_timezoneid: "",
        teacher_timezone_location: "",
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
      teacher_timezoneid: "",
      teacher_timezone_location: "",
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

      setClassPatch(index, {
        subjectOptions,
        subjectLoading: false,
        subjectError: subjectOptions.length
          ? ""
          : "No subjects found for this teacher.",
        subjectid: firstSubjectId,
        title: "",

        teacher_timezoneid: teacherTimezone.timezoneid,
        teacher_timezone_location: teacherTimezone.timezone_location,
      });
    } catch (err) {
      console.error("Teacher subjects load failed:", err);

      setClassPatch(index, {
        subjectOptions: [],
        subjectLoading: false,
        subjectError: err?.message || "Teacher subjects could not be loaded.",
        subjectid: "",
        title: "",
        teacher_timezoneid: "",
        teacher_timezone_location: "",
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
    setClasses((prev) => [...prev, makeEmptyClass(prev.length)]);
  };

  const handleRemoveClass = (index) => {
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

  const validateForm = () => {
    if (!form.programme_id) return "Please select a programme.";

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
      if (!item.session_date)
        return `${label}: Please select a session date.`;
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

  const buildInsertRows = () => {
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

    return classes.map((item, index) => {
      return {
        tablename: "group_live_sessions",

        programme_id: Number(form.programme_id),
        group_batch_id: groupBatchId,

        title: item.title || buildSessionTitle(item, index),
        subjectid: Number(item.subjectid),
        teacherid: Number(item.teacherid),

        timezoneid: Number(item.teacher_timezoneid),
        timezone_location: item.teacher_timezone_location,

        session_date: item.session_date,
        slot_start: formatTimeForDb(item.slot_start),
        slot_end: formatTimeForDb(item.slot_end),
        capacity: Number(form.capacity || 10),

        classid: null,
        roomid: null,
        classhostlink: null,
        classcommonlink: null,

        status: item.status || form.status || "active",
        createddate: batchCreatedDate,
      };
    });
  };

  const buildUpdateRow = (item, index) => {
    const firstEditSession = Array.isArray(editProgramme?.sessions)
      ? editProgramme.sessions[0]
      : null;

    const existingGroupBatchId = Number(
      item?.group_batch_id ||
      editProgramme?.group_batch_id ||
      firstEditSession?.group_batch_id ||
      0
    );

    return {
      programme_id: Number(form.programme_id),
      group_batch_id: existingGroupBatchId > 0 ? existingGroupBatchId : generateGroupBatchId(),

      title: item.title || buildSessionTitle(item, index),
      subjectid: Number(item.subjectid),
      teacherid: Number(item.teacherid),

      timezoneid: Number(item.teacher_timezoneid),
      timezone_location: item.teacher_timezone_location,

      session_date: item.session_date,
      slot_start: formatTimeForDb(item.slot_start),
      slot_end: formatTimeForDb(item.slot_end),
      capacity: Number(form.capacity || 10),

      status: item.status || form.status || "active",
    };
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

  const handleCreateSubmit = async (headers) => {
    const insertRows = buildInsertRows();
    const insertedResponses = [];

    console.log("GROUP LIVE SESSION INSERT ROWS =>", insertRows);

    for (let i = 0; i < insertRows.length; i += 1) {
      const row = insertRows[i];

      try {
        const res = await addDynamicData(row, headers);
        insertedResponses.push(res);
      } catch (insertErr) {
        throw new Error(
          `Class ${i + 1} insert failed: ${insertErr?.message || "Unknown error"
          }`
        );
      }
    }

    return {
      insertedRows: insertRows,
      insertedResponses,
    };
  };

  const handleUpdateSubmit = async (headers, token) => {
    const bookedCount = getProgrammeBookedCount(editProgramme);

    if (bookedCount > 0) {
      throw new Error(
        "This programme already has a group booking, so it cannot be edited."
      );
    }

    const updatedResponses = [];
    const insertedResponses = [];
    const removedResponses = [];
    const insertRows = buildInsertRows();

    for (let i = 0; i < classes.length; i += 1) {
      const item = classes[i];

      if (item.id) {
        const updateRow = buildUpdateRow(item, i);
        const res = await updateDynamicData(item.id, updateRow, token);
        updatedResponses.push(res);
      } else {
        const insertRow = insertRows[i];
        const res = await addDynamicData(insertRow, headers);
        insertedResponses.push(res);
      }
    }

    for (const sessionId of removedSessionIds) {
      const res = await updateDynamicData(
        sessionId,
        {
          status: "cancelled",
        },
        token
      );

      removedResponses.push(res);
    }

    return {
      updatedResponses,
      insertedResponses,
      removedResponses,
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
        : await handleCreateSubmit(headers);

      const successText = isEditMode
        ? "Live group sessions updated successfully."
        : `${classes.length} live group session${classes.length > 1 ? "s" : ""
        } created successfully.`;

      setSuccessMsg(successText);

      setTimeout(() => {
        onSuccess?.({
          mode: isEditMode ? "edit" : "create",
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

      return {
        index,
        teacherName: getTeacherName(teacher) || item.teacher_name || "",
        subjectName: getSubjectName(subject),
        title: item.title || buildSessionTitle(item, index),
        date: item.session_date,
        time:
          item.slot_start && item.slot_end
            ? `${item.slot_start} - ${item.slot_end}`
            : "",
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
        }
      `}</style>

      <div className="gl-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gl-create-header d-flex justify-content-between align-items-start gap-3">
          <div>
            <h4 className="gl-create-title">
              {isEditMode ? "Edit Live Group Sessions" : "Create Live Group Sessions"}
            </h4>
            <div className="gl-create-subtitle">
              {isEditMode
                ? "Update programme classes, teacher, subject, timezone, date and time."
                : "Select programme and create one or more live classes."}
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

                    {programmes.map((item, index) => {
                      const programmeId = getProgrammeId(item);
                      const programmeName =
                        item?.name ||
                        item?.programme_name ||
                        item?.programmename ||
                        item?.title ||
                        `Programme ${index + 1}`;

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
                <div className="gl-class-card" key={item.uid || item.class_no}>
                  <div className="gl-class-header">
                    <div>
                      <h6 className="gl-class-title">Class {index + 1}</h6>
                      <div className="gl-class-subtitle">
                        {getTeacherName(teacher) ||
                          item.teacher_name ||
                          "Teacher not selected"}
                        {getSubjectName(subject)
                          ? ` • ${getSubjectName(subject)}`
                          : ""}
                      </div>

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
                      <span className="badge bg-primary">Required</span>

                      {classes.length > 1 ? (
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
                        <label className="form-label">Teacher</label>

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
                          value={item.title || autoTitle}
                          onChange={(e) =>
                            updateClass(index, "title", e.target.value)
                          }
                          placeholder={`${selectedProgrammeName || "Programme"
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
                            handleStartTimeChange(index, e.target.value)
                          }
                          disabled={loading}
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

            <div className="gl-preview-card">
              <div className="gl-preview-title">Preview</div>

              <div className="gl-preview-line">
                <strong>Programme:</strong> {selectedProgrammeName || "-"}
              </div>

              <div className="gl-preview-line">
                <strong>Stage:</strong>{" "}
                {selectedProgramme?.stage ||
                  editProgramme?.programme_stage ||
                  preselectedProgramme?.programme_stage ||
                  "-"}
              </div>

              <div className="gl-preview-line">
                <strong>Weekly Price:</strong>{" "}
                {selectedProgramme?.weekly_price ||
                  editProgramme?.weekly_price ||
                  preselectedProgramme?.weekly_price
                  ? `AED ${selectedProgramme?.weekly_price ||
                  editProgramme?.weekly_price ||
                  preselectedProgramme?.weekly_price
                  }`
                  : "-"}
              </div>

              <div className="gl-preview-line">
                <strong>Capacity:</strong> {form.capacity || "-"} students
              </div>

              {previewClasses.map((item) => (
                <div className="gl-preview-line" key={item.index}>
                  <strong>Class {item.index + 1}:</strong> {item.title || "-"} |{" "}
                  {item.teacherName || "-"} | {item.date || "-"} |{" "}
                  {item.time || "-"} | {item.timezone || "Timezone not selected"}
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
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
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