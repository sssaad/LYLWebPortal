import React, { useEffect, useMemo, useState } from "react";
import moment from "moment-timezone";
import axios from "axios";
import { getTimezonesLookup } from "../api/getTimezonesLookup";
import { getToken } from "../api/getToken";

const themeNativeStyles = `
  .reschedule-modal-theme .theme-native-control,
  .reschedule-modal-theme .theme-native-control.form-select,
  .reschedule-modal-theme .theme-native-control.form-control {
    background-color: var(--bs-body-bg) !important;
    color: var(--bs-emphasis-color) !important;
    border: 1px solid var(--bs-border-color) !important;
    -webkit-text-fill-color: var(--bs-emphasis-color) !important;
    box-shadow: none !important;
    appearance: auto !important;
    opacity: 1 !important;
  }

  .reschedule-modal-theme .theme-native-control:focus {
    border-color: var(--bs-primary) !important;
    box-shadow: 0 0 0 0.15rem rgba(var(--bs-primary-rgb), 0.12) !important;
    background-color: var(--bs-body-bg) !important;
    color: var(--bs-emphasis-color) !important;
  }

  .reschedule-modal-theme .theme-native-control option {
    background-color: var(--bs-body-bg) !important;
    color: var(--bs-emphasis-color) !important;
  }

  .reschedule-modal-theme .theme-native-control:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  [data-bs-theme="dark"] .reschedule-modal-theme .theme-native-control,
  [data-theme="dark"] .reschedule-modal-theme .theme-native-control,
  .dark .reschedule-modal-theme .theme-native-control,
  body.dark .reschedule-modal-theme .theme-native-control {
    color-scheme: dark;
  }

  [data-bs-theme="light"] .reschedule-modal-theme .theme-native-control,
  [data-theme="light"] .reschedule-modal-theme .theme-native-control,
  .light .reschedule-modal-theme .theme-native-control,
  body.light .reschedule-modal-theme .theme-native-control {
    color-scheme: light;
  }

  [data-bs-theme="dark"] .reschedule-modal-theme input[type="date"].theme-native-control::-webkit-calendar-picker-indicator,
  [data-theme="dark"] .reschedule-modal-theme input[type="date"].theme-native-control::-webkit-calendar-picker-indicator,
  .dark .reschedule-modal-theme input[type="date"].theme-native-control::-webkit-calendar-picker-indicator,
  body.dark .reschedule-modal-theme input[type="date"].theme-native-control::-webkit-calendar-picker-indicator {
    filter: invert(1);
  }

  .reschedule-modal-theme .slot-btn,
  .reschedule-modal-theme .day-btn,
  .reschedule-modal-theme .nav-circle-btn,
  .reschedule-modal-theme .modal-action-btn {
    transition: all 0.2s ease;
  }

  .reschedule-modal-theme .slot-btn:hover,
  .reschedule-modal-theme .day-btn:hover,
  .reschedule-modal-theme .modal-action-btn:hover {
    transform: translateY(-1px);
  }

  .reschedule-modal-theme .nav-circle-btn:hover {
    transform: scale(1.04);
  }

  @media (max-width: 767px) {
    .reschedule-modal-theme .week-day-col {
      min-width: 110px;
    }
  }
`;

const TEACHER_PROFILE_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=teacher_profile";

const RUN_STORED_PROCEDURE_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const RESCHEDULE_BOOKING_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=reshedule_booking";

const DATE_FORMATS = [
  "YYYY-MM-DD",
  "YYYY/MM/DD",
  "DD-MM-YYYY",
  "DD/MM/YYYY",
  "YYYY-MM-DD HH:mm:ss",
  "YYYY-MM-DD HH:mm",
  moment.ISO_8601,
];

const DATETIME_FORMATS = [
  "YYYY-MM-DD HH:mm:ss.SSSSSS",
  "YYYY-MM-DD HH:mm:ss",
  "YYYY-MM-DD HH:mm",
  "YYYY/MM/DD HH:mm:ss.SSSSSS",
  "YYYY/MM/DD HH:mm:ss",
  "YYYY/MM/DD HH:mm",
  moment.ISO_8601,
];

const DAY_TO_ISO = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

const firstFilled = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const safeJsonParse = (value, fallback = []) => {
  if (!value || typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const uniqBy = (list, getKey) => {
  const seen = new Set();
  const result = [];

  for (const item of list || []) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
};

const extractIanaTimezone = (...candidates) => {
  for (const raw of candidates) {
    const value = String(raw ?? "").trim();
    if (!value) continue;

    if (moment.tz.zone(value)) return value;

    const match = value.match(/[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?/);
    if (match?.[0] && moment.tz.zone(match[0])) {
      return match[0];
    }
  }

  return "";
};

const getSafeTimezone = (tz) => {
  const resolved = extractIanaTimezone(tz);
  return resolved || "Asia/Karachi";
};

const formatClock = (value) => {
  if (!value) return "--:--";
  const normalized = String(value).split(".")[0];
  const parsed = moment(normalized, ["HH:mm:ss", "HH:mm"], true);
  return parsed.isValid() ? parsed.format("HH:mm") : "--:--";
};

const parseBookingDate = (value, timezone) => {
  if (!value) return null;
  const tz = getSafeTimezone(timezone);

  let parsed = moment.tz(value, DATE_FORMATS, true, tz);
  if (!parsed.isValid()) parsed = moment.tz(value, DATE_FORMATS, tz);
  if (!parsed.isValid()) parsed = moment.tz(value, tz);

  return parsed.isValid() ? parsed : null;
};

const parseSelectedDate = (value, timezone) => {
  if (!value) return null;
  const tz = getSafeTimezone(timezone);
  const parsed = moment.tz(value, "YYYY-MM-DD", true, tz);
  return parsed.isValid() ? parsed : null;
};

const getWeekStart = (dateMoment, timezone) => {
  const tz = getSafeTimezone(timezone);
  const base = dateMoment?.clone?.() || moment.tz(tz);
  return base.startOf("isoWeek");
};

const getTodayInTimezone = (timezone) =>
  moment.tz(getSafeTimezone(timezone)).startOf("day");

const getDefaultVisibleDateForWeek = (weekStartMoment, timezone) => {
  const tz = getSafeTimezone(timezone);
  const weekStart = (weekStartMoment?.clone?.() || getWeekStart(null, tz)).startOf("day");
  const today = getTodayInTimezone(tz);
  const currentWeekStart = getWeekStart(today.clone(), tz).startOf("day");

  if (weekStart.isSame(currentWeekStart, "day")) {
    return today.format("YYYY-MM-DD");
  }

  return weekStart.format("YYYY-MM-DD");
};

const parseClockParts = (value) => {
  if (!value) return null;
  const normalized = String(value).split(".")[0];
  const parsed = moment(normalized, ["HH:mm:ss", "HH:mm"], true);
  if (!parsed.isValid()) return null;

  return {
    hour: parsed.hour(),
    minute: parsed.minute(),
    second: parsed.second(),
  };
};

const parseDateTimeInTimezone = (dateValue, timeValue, timezone) => {
  if (!dateValue || !timeValue) return null;

  const tz = getSafeTimezone(timezone);
  const normalizedTime = String(timeValue).split(".")[0];
  const fullValue = `${dateValue} ${normalizedTime}`;

  let parsed = moment.tz(fullValue, DATETIME_FORMATS, true, tz);
  if (!parsed.isValid()) parsed = moment.tz(fullValue, DATETIME_FORMATS, tz);

  return parsed.isValid() ? parsed : null;
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

const buildApiHeaders = async () => {
  const tokenRes = await getToken();
  const token = resolveToken(tokenRes);

  return {
    projectid: "1",
    userid: "test",
    password: "test",
    "x-api-key": "abc123456789",
    ...(token ? { token } : {}),
  };
};

const fetchTeacherProfileInsideModal = async (teacherid, headers) => {
  const response = await axios.post(
    TEACHER_PROFILE_URL,
    { teacherid },
    { headers }
  );

  return response.data;
};

const fetchTeacherBookedSlotsInsideModal = async (teacherid, headers) => {
  const response = await axios.post(
    RUN_STORED_PROCEDURE_URL,
    {
      procedureName: "get_teacher_bookings",
      parameters: [teacherid],
    },
    { headers }
  );

  return response.data;
};

const submitRescheduleBookingInsideModal = async (payload, headers) => {
  const response = await axios.post(RESCHEDULE_BOOKING_URL, payload, { headers });
  return response.data;
};

const extractLookupArray = (response) => {
  const candidates = [
    response,
    response?.data,
    response?.data?.data,
    response?.timezones,
    response?.data?.timezones,
    response?.lookup,
    response?.data?.lookup,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
};

const normalizeTimezoneOptions = (lookupResponse, fallbackZones = []) => {
  const raw = extractLookupArray(lookupResponse);

  const mapped = raw
    .map((item) => {
      if (typeof item === "string") {
        const zone = getSafeTimezone(item);
        return zone
          ? {
              id: "",
              value: zone,
              label: item,
            }
          : null;
      }

      const value = extractIanaTimezone(
        item?.timezone,
        item?.zone,
        item?.iana,
        item?.value,
        item?.timezone_name,
        item?.timezonename,
        item?.name,
        item?.label
      );

      const label = firstFilled(
        item?.timezonename,
        item?.timezone_name,
        item?.label,
        item?.name,
        value
      );

      const id = String(firstFilled(item?.timezoneid, item?.id, ""));

      if (!value) return null;

      return { id, value, label };
    })
    .filter(Boolean);

  const fallbacks = (fallbackZones || [])
    .map((zone) => {
      const value = getSafeTimezone(zone);
      if (!value) return null;
      return {
        id: "",
        value,
        label: value,
      };
    })
    .filter(Boolean);

  return uniqBy([...mapped, ...fallbacks], (item) => item.value);
};

const getSubjectOptionValue = (item) =>
  String(firstFilled(item?.subjectid, item?.subjectname));

const normalizeSubjects = (profileData, booking) => {
  const fromTable = Array.isArray(profileData?.teachingprofile_subjects)
    ? profileData.teachingprofile_subjects
    : [];

  const fromProfile = safeJsonParse(profileData?.profile?.[0]?.teacherSubjects, []);

  const currentBookingSubject = booking?.subjectname
    ? [
        {
          subjectid: booking?.subjectid,
          subjectname: booking?.subjectname,
        },
      ]
    : [];

  const all = [
    ...currentBookingSubject,
    ...fromTable.map((item) => ({
      subjectid: item?.subjectid,
      subjectname: item?.subjectname,
    })),
    ...fromProfile.map((item) => ({
      subjectid: item?.subjectid,
      subjectname: item?.subjectname,
    })),
  ].filter((item) => item?.subjectname);

  return uniqBy(
    all,
    (item) => String(firstFilled(item?.subjectid, item?.subjectname)).toLowerCase()
  );
};

const normalizeAvailability = (profileData) => {
  const fromTable = Array.isArray(profileData?.teacheravailability)
    ? profileData.teacheravailability
    : [];

  const fromProfile = safeJsonParse(profileData?.profile?.[0]?.availability, []);

  const all = [
    ...fromTable.map((item) => ({
      day: item?.day,
      timefrom: item?.timefrom,
      timeto: item?.timeto,
      timezoneid: item?.timezoneid,
      deleted: item?.deleted,
    })),
    ...fromProfile.map((item) => ({
      day: item?.day,
      timefrom: item?.timefrom,
      timeto: item?.timeto,
      timezoneid: item?.timezoneid,
      deleted: item?.deleted,
    })),
  ];

  return uniqBy(
    all.filter(
      (item) =>
        item?.day &&
        item?.timefrom &&
        item?.timeto &&
        String(item?.deleted ?? "0") !== "1"
    ),
    (item) =>
      `${item?.day}|${item?.timefrom}|${item?.timeto}|${String(item?.timezoneid ?? "")}`
  );
};

const normalizeTeacherBookedSlots = (storedProcResponse, fallbackTimezone = "Asia/Karachi") => {
  const raw = Array.isArray(storedProcResponse?.data)
    ? storedProcResponse.data
    : Array.isArray(storedProcResponse?.data?.data)
    ? storedProcResponse.data.data
    : [];

  return uniqBy(
    raw
      .map((item) => ({
        teacherid: item?.teacherid,
        bookdate: item?.bookdate || item?.booking_date,
        slot_start: item?.slot_start,
        slot_end: item?.slot_end,
        timezone: getSafeTimezone(item?.timezone || fallbackTimezone),
      }))
      .filter((item) => item?.bookdate && item?.slot_start && item?.slot_end),
    (item) =>
      `${item?.bookdate}|${item?.slot_start}|${item?.slot_end}|${item?.timezone}`
  );
};

const isOverlap = (startA, endA, startB, endB) => {
  const aStart = moment.isMoment(startA) ? startA.clone() : moment.parseZone(startA);
  const aEnd = moment.isMoment(endA) ? endA.clone() : moment.parseZone(endA);
  const bStart = moment.isMoment(startB) ? startB.clone() : moment.parseZone(startB);
  const bEnd = moment.isMoment(endB) ? endB.clone() : moment.parseZone(endB);

  return aStart.isBefore(bEnd) && aEnd.isAfter(bStart);
};

const RescheduleBookingModal = ({
  isOpen,
  onClose,
  onSuccess,
  booking,
  timezone = "Asia/Karachi",
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedTimezone, setSelectedTimezone] = useState(getSafeTimezone(timezone));
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);

  const [subjectOptions, setSubjectOptions] = useState([]);
  const [teacherAvailability, setTeacherAvailability] = useState([]);
  const [teacherBookedSlots, setTeacherBookedSlots] = useState([]);
  const [timezoneOptions, setTimezoneOptions] = useState([]);
  const [teacherProfileData, setTeacherProfileData] = useState(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [bookedSlotsWarning, setBookedSlotsWarning] = useState("");

  useEffect(() => {
    if (!isOpen || !booking) return;

    let active = true;

    const defaultTimezone = getSafeTimezone(
      booking?.studentTime_zone || timezone || "Asia/Karachi"
    );

    const currentWeek = getWeekStart(moment.tz(defaultTimezone), defaultTimezone);

    setSelectedTimezone(defaultTimezone);
    setSelectedWeekStart(currentWeek);
    setSelectedDate(getDefaultVisibleDateForWeek(currentWeek, defaultTimezone));
    setSelectedSlot(null);
    setProfileError("");
    setSubmitError("");
    setBookedSlotsWarning("");
    setTeacherProfileData(null);
    setTeacherAvailability([]);
    setTeacherBookedSlots([]);
    setSubjectOptions([]);
    setTimezoneOptions(
      normalizeTimezoneOptions(null, [
        booking?.studentTime_zone,
        booking?.teacherTime_zone,
        timezone,
        "Asia/Karachi",
      ])
    );
    setSelectedSubjectId(String(firstFilled(booking?.subjectid, booking?.subjectname)));

    const loadModalData = async () => {
      if (!booking?.teacherid) {
        setProfileError("Teacher id missing hai.");
        return;
      }

      setProfileLoading(true);

      try {
        const headers = await buildApiHeaders();

        const [profileRes, timezonesRes, bookedRes] = await Promise.allSettled([
          fetchTeacherProfileInsideModal(booking.teacherid, headers),
          getTimezonesLookup(),
          fetchTeacherBookedSlotsInsideModal(booking.teacherid, headers),
        ]);

        if (!active) return;

        const normalizedTimezones = normalizeTimezoneOptions(
          timezonesRes.status === "fulfilled" ? timezonesRes.value : null,
          [booking?.studentTime_zone, booking?.teacherTime_zone, timezone, "Asia/Karachi"]
        );

        setTimezoneOptions(normalizedTimezones);

        const exactMatch = normalizedTimezones.find(
          (item) => item.value === defaultTimezone
        );
        if (exactMatch?.value) {
          setSelectedTimezone(exactMatch.value);
        }

        if (
          profileRes.status !== "fulfilled" ||
          Number(profileRes.value?.statusCode) !== 200
        ) {
          const msg =
            profileRes.status === "fulfilled"
              ? profileRes.value?.message || "Teacher profile load nahi hua."
              : profileRes.reason?.message || "Teacher profile load nahi hua.";
          throw new Error(msg);
        }

        const profileData = profileRes.value?.data || {};
        setTeacherProfileData(profileData);

        const subjects = normalizeSubjects(profileData, booking);
        const availability = normalizeAvailability(profileData);

        setSubjectOptions(subjects);
        setTeacherAvailability(availability);
        setSelectedSubjectId(
          String(
            firstFilled(
              booking?.subjectid,
              subjects?.[0]?.subjectid,
              booking?.subjectname,
              subjects?.[0]?.subjectname
            )
          )
        );

        if (
          bookedRes.status === "fulfilled" &&
          Number(bookedRes.value?.statusCode) === 200
        ) {
          setTeacherBookedSlots(
            normalizeTeacherBookedSlots(
              bookedRes.value,
              booking?.teacherTime_zone || defaultTimezone
            )
          );
        } else {
          setTeacherBookedSlots([]);
          setBookedSlotsWarning(
            "Booked slots load nahi huay. Abhi sirf teacher availability dikh rahi hai."
          );
        }
      } catch (error) {
        if (!active) return;
        console.error("Reschedule modal load failed:", error);
        setProfileError(error?.message || "Teacher profile / slots load nahi huay.");
      } finally {
        if (active) {
          setProfileLoading(false);
        }
      }
    };

    loadModalData();

    return () => {
      active = false;
    };
  }, [isOpen, booking, timezone]);

  const timezoneById = useMemo(() => {
    const map = {};
    (timezoneOptions || []).forEach((item) => {
      if (item?.id) {
        map[String(item.id)] = item.value;
      }
    });
    return map;
  }, [timezoneOptions]);

  const selectedTimezoneOption = useMemo(() => {
    return (
      (timezoneOptions || []).find((item) => item.value === selectedTimezone) || null
    );
  }, [timezoneOptions, selectedTimezone]);

  const selectedTimezoneId = useMemo(() => {
    const rawId = String(selectedTimezoneOption?.id ?? "").trim();
    return /^\d+$/.test(rawId) ? rawId : "";
  }, [selectedTimezoneOption]);

  const teacherBaseTimezone = useMemo(() => {
    const profile = teacherProfileData?.profile?.[0] || {};
    const zone =
      timezoneById[String(profile?.timezoneid)] ||
      booking?.teacherTime_zone ||
      timezone ||
      "Asia/Karachi";

    return getSafeTimezone(zone);
  }, [teacherProfileData, timezoneById, booking, timezone]);

  const selectedSubject = useMemo(() => {
    return (
      (subjectOptions || []).find(
        (item) => getSubjectOptionValue(item) === String(selectedSubjectId)
      ) || null
    );
  }, [subjectOptions, selectedSubjectId]);

  const currentTeacher =
    booking?.teachername || booking?.teacher_name || booking?.teacher || "-";

  const currentSubject = booking?.subjectname || "-";

  const currentDateFormatted = useMemo(() => {
    const bookingDate = booking?.bookdate || booking?.booking_date || "";
    const parsed = parseBookingDate(
      bookingDate,
      booking?.studentTime_zone || timezone || "Asia/Karachi"
    );
    return parsed ? parsed.format("DD MMM YYYY") : "-";
  }, [booking, timezone]);

  const currentTimeSlot = useMemo(() => {
    const start = formatClock(booking?.slot_start);
    const end = formatClock(booking?.slot_end);
    return `${start} - ${end}`;
  }, [booking]);

  const todayLocal = useMemo(
    () => getTodayInTimezone(selectedTimezone),
    [selectedTimezone]
  );

  const minSelectableDate = useMemo(
    () => todayLocal.format("YYYY-MM-DD"),
    [todayLocal]
  );

  const currentWeekStart = useMemo(
    () => getWeekStart(todayLocal.clone(), selectedTimezone),
    [todayLocal, selectedTimezone]
  );

  const canGoPrevWeek = useMemo(() => {
    const activeWeekStart = selectedWeekStart
      ? selectedWeekStart.clone().startOf("day")
      : currentWeekStart.clone().startOf("day");

    return activeWeekStart.isAfter(currentWeekStart, "day");
  }, [selectedWeekStart, currentWeekStart]);

  const weekDays = useMemo(() => {
    const start = selectedWeekStart
      ? selectedWeekStart.clone()
      : getWeekStart(null, selectedTimezone);

    return Array.from({ length: 7 }, (_, i) => start.clone().add(i, "day"));
  }, [selectedWeekStart, selectedTimezone]);

  const slotsMap = useMemo(() => {
    const safeSelectedTz = getSafeTimezone(selectedTimezone);
    const map = {};

    weekDays.forEach((day) => {
      map[day.format("YYYY-MM-DD")] = [];
    });

    const visibleStart = weekDays[0].clone().startOf("day");
    const visibleEnd = weekDays[6].clone().endOf("day");
    const now = moment.tz(safeSelectedTz);

    teacherAvailability.forEach((item) => {
      const isoDay = DAY_TO_ISO[item?.day];
      const startParts = parseClockParts(item?.timefrom);
      const endParts = parseClockParts(item?.timeto);

      if (!isoDay || !startParts || !endParts) return;

      const sourceTimezone = getSafeTimezone(
        timezoneById[String(item?.timezoneid)] || teacherBaseTimezone
      );

      const sourceWeekStart = visibleStart
        .clone()
        .tz(sourceTimezone)
        .startOf("isoWeek");

      [-7, 0, 7].forEach((offset) => {
        const sourceDate = sourceWeekStart.clone().add(offset, "days").isoWeekday(isoDay);

        let startDT = sourceDate
          .clone()
          .hour(startParts.hour)
          .minute(startParts.minute)
          .second(startParts.second)
          .millisecond(0);

        let endDT = sourceDate
          .clone()
          .hour(endParts.hour)
          .minute(endParts.minute)
          .second(endParts.second)
          .millisecond(0);

        if (endDT.isSame(startDT)) return;
        if (endDT.isBefore(startDT)) endDT.add(1, "day");

        const localStart = startDT.clone().tz(safeSelectedTz);
        const localEnd = endDT.clone().tz(safeSelectedTz);

        if (localStart.isSameOrBefore(now)) return;
        if (localEnd.isBefore(visibleStart) || localStart.isAfter(visibleEnd)) return;

        const dayKey = localStart.format("YYYY-MM-DD");
        if (!map[dayKey]) return;

        map[dayKey].push({
          label: `${localStart.format("HH:mm")} - ${localEnd.format("HH:mm")}`,
          start: localStart.format(),
          end: localEnd.format(),
          isBooked: false,
        });
      });
    });

    teacherBookedSlots.forEach((item) => {
      let bookedStart = parseDateTimeInTimezone(item?.bookdate, item?.slot_start, item?.timezone);
      let bookedEnd = parseDateTimeInTimezone(item?.bookdate, item?.slot_end, item?.timezone);

      if (!bookedStart || !bookedEnd) return;
      if (bookedEnd.isSameOrBefore(bookedStart)) bookedEnd = bookedEnd.add(1, "day");

      const localStart = bookedStart.clone().tz(safeSelectedTz);
      const localEnd = bookedEnd.clone().tz(safeSelectedTz);

      if (localEnd.isSameOrBefore(now)) return;
      if (localEnd.isBefore(visibleStart) || localStart.isAfter(visibleEnd)) return;

      const dayKey = localStart.format("YYYY-MM-DD");
      if (!map[dayKey]) return;

      let matchedExisting = false;

      map[dayKey] = map[dayKey].map((slot) => {
        if (isOverlap(slot.start, slot.end, localStart, localEnd)) {
          matchedExisting = true;
          return {
            ...slot,
            isBooked: true,
          };
        }
        return slot;
      });

      if (!matchedExisting) {
        map[dayKey].push({
          label: `${localStart.format("HH:mm")} - ${localEnd.format("HH:mm")}`,
          start: localStart.format(),
          end: localEnd.format(),
          isBooked: true,
        });
      }
    });

    Object.keys(map).forEach((dayKey) => {
      map[dayKey] = uniqBy(
        map[dayKey].sort(
          (a, b) => moment.parseZone(a.start).valueOf() - moment.parseZone(b.start).valueOf()
        ),
        (item) => `${item.start}|${item.end}`
      );
    });

    return map;
  }, [
    teacherAvailability,
    teacherBookedSlots,
    weekDays,
    selectedTimezone,
    teacherBaseTimezone,
    timezoneById,
  ]);

  useEffect(() => {
    if (!selectedSlot || !selectedDate) return;

    const stillExists = (slotsMap[selectedDate] || []).some(
      (slot) =>
        slot.start === selectedSlot.start &&
        slot.end === selectedSlot.end &&
        Boolean(slot.isBooked) === Boolean(selectedSlot.isBooked)
    );

    if (!stillExists || selectedSlot?.isBooked) {
      setSelectedSlot(null);
    }
  }, [slotsMap, selectedDate, selectedSlot]);

  const goPrevWeek = () => {
    if (!canGoPrevWeek) return;

    const prevWeek = (
      selectedWeekStart ? selectedWeekStart.clone() : currentWeekStart.clone()
    ).subtract(7, "days");

    setSelectedWeekStart(prevWeek);
    setSelectedDate(getDefaultVisibleDateForWeek(prevWeek, selectedTimezone));
    setSelectedSlot(null);
  };

  const goNextWeek = () => {
    const nextWeek = (
      selectedWeekStart ? selectedWeekStart.clone() : currentWeekStart.clone()
    ).add(7, "days");

    setSelectedWeekStart(nextWeek);
    setSelectedDate(getDefaultVisibleDateForWeek(nextWeek, selectedTimezone));
    setSelectedSlot(null);
  };

  const handleDateInputChange = (e) => {
    const value = e.target.value;
    const parsed = parseSelectedDate(value, selectedTimezone);
    const today = getTodayInTimezone(selectedTimezone);

    if (parsed && parsed.isBefore(today, "day")) {
      setSelectedDate(today.format("YYYY-MM-DD"));
      setSelectedWeekStart(getWeekStart(today.clone(), selectedTimezone));
      setSelectedSlot(null);
      return;
    }

    setSelectedDate(value);
    setSelectedSlot(null);

    if (parsed) {
      setSelectedWeekStart(getWeekStart(parsed, selectedTimezone));
    }
  };

  const handleDayPick = (dayKey) => {
    const parsed = parseSelectedDate(dayKey, selectedTimezone);
    if (!parsed) return;

    const today = getTodayInTimezone(selectedTimezone);
    if (parsed.isBefore(today, "day")) return;

    setSelectedDate(dayKey);
    setSelectedSlot(null);
  };

  const handleSlotPick = (day, slot) => {
    if (slot?.isBooked) return;

    setSelectedDate(day.format("YYYY-MM-DD"));
    setSelectedSlot(slot);
    setSelectedWeekStart(getWeekStart(day, selectedTimezone));
    setSubmitError("");
  };

  const canSubmit = Boolean(
    selectedSubjectId &&
      selectedDate &&
      selectedSlot &&
      !selectedSlot?.isBooked &&
      selectedTimezoneId &&
      !profileLoading &&
      !submitting
  );

  const handleSubmit = async () => {
    if (!booking?.bookingid) {
      setSubmitError("Booking id missing hai.");
      return;
    }

    if (!selectedSlot) {
      setSubmitError("Please select a slot.");
      return;
    }

    if (selectedSlot?.isBooked) {
      setSubmitError("Booked slot select nahi ho sakta.");
      return;
    }

    if (!selectedSubject?.subjectid && !booking?.subjectid) {
      setSubmitError("Subject id missing hai.");
      return;
    }

    if (!selectedTimezoneId) {
      setSubmitError("Timezone id load nahi hui. Please try again.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const headers = await buildApiHeaders();

      const startMoment = moment.parseZone(selectedSlot.start).tz(selectedTimezone);
      const endMoment = moment.parseZone(selectedSlot.end).tz(selectedTimezone);

      const body = {
        bookingId: booking?.bookingid,
        newDate: selectedDate,
        newStartTime: startMoment.format("HH:mm"),
        newEndTime: endMoment.format("HH:mm"),
        newTimezone: selectedTimezoneId,
        newSubjectid: Number(selectedSubject?.subjectid ?? booking?.subjectid),
      };

      const result = await submitRescheduleBookingInsideModal(body, headers);

      if (Number(result?.statusCode) !== 200) {
        throw new Error(result?.message || "Reschedule failed.");
      }

      try {
        if (typeof onSuccess === "function") {
          await Promise.resolve(onSuccess());
        }
      } catch (refreshError) {
        console.error("Bookings refresh failed after reschedule:", refreshError);
      }

      onClose?.();
    } catch (error) {
      console.error("Reschedule submit failed:", error);
      setSubmitError(error?.message || "Reschedule submit nahi hua.");
    } finally {
      setSubmitting(false);
    }
  };

  const stop = (e) => e.stopPropagation();

  if (!isOpen) return null;

  const theme = {
    overlay: "rgba(15, 23, 42, 0.52)",
    modalBg: "var(--bs-body-bg)",
    sectionBg: "var(--bs-tertiary-bg)",
    softBg: "var(--bs-secondary-bg)",
    border: "var(--bs-border-color)",
    text: "var(--bs-body-color)",
    muted: "var(--bs-secondary-color)",
    heading: "var(--bs-emphasis-color)",
    primary: "var(--bs-primary)",
    primarySubtle: "var(--bs-primary-bg-subtle)",
    primaryText: "var(--bs-primary-text-emphasis)",
    secondaryBtnBg: "var(--bs-secondary-bg)",
    secondaryBtnText: "var(--bs-body-color)",
    warning: "var(--bs-warning)",
    dangerBg: "var(--bs-danger-bg-subtle)",
    dangerText: "var(--bs-danger-text-emphasis)",
    dangerBorder: "var(--bs-danger-border-subtle)",
    shadow: "0 18px 48px rgba(2, 6, 23, 0.18)",
  };

  const selectedDateLabel = (() => {
    const parsed = parseSelectedDate(selectedDate, selectedTimezone);
    return parsed ? parsed.format("DD MMM YYYY") : "-";
  })();

  const timezoneIdWarning =
    !profileLoading && !selectedTimezoneId
      ? "Selected timezone ka id lookup se nahi mila. Submit disable rahega."
      : "";

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center reschedule-modal-theme"
      style={{
        background: theme.overlay,
        zIndex: 2000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <style>{themeNativeStyles}</style>

      <div
        onClick={stop}
        style={{
          width: "min(1100px, 98vw)",
          maxHeight: "94vh",
          overflowY: "auto",
          background: theme.modalBg,
          borderRadius: "18px",
          boxShadow: theme.shadow,
          padding: "20px 22px 24px",
          border: `1px solid ${theme.border}`,
          color: theme.text,
        }}
      >
        <div
          className="d-flex justify-content-between align-items-center pb-3 mb-3"
          style={{ borderBottom: `1px solid ${theme.border}` }}
        >
          <h4
            className="mb-0"
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: theme.heading,
              lineHeight: 1.2,
            }}
          >
            Reschedule Session
          </h4>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm"
            style={{
              border: "none",
              background: "transparent",
              fontSize: "20px",
              lineHeight: 1,
              color: theme.muted,
              boxShadow: "none",
              padding: "2px 6px",
            }}
            disabled={submitting}
          >
            ×
          </button>
        </div>

        {profileError ? (
          <div className="alert alert-danger py-2">{profileError}</div>
        ) : null}

        {bookedSlotsWarning ? (
          <div className="alert alert-warning py-2">{bookedSlotsWarning}</div>
        ) : null}

        {submitError ? (
          <div className="alert alert-danger py-2">{submitError}</div>
        ) : null}

        <div
          className="mb-3"
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: "10px",
            background: theme.sectionBg,
            padding: "14px 14px",
          }}
        >
          <h6
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: theme.heading,
              marginBottom: "14px",
            }}
          >
            Current Session Details
          </h6>

          <div className="row g-3 align-items-center">
            <div className="col-lg-6">
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: `1px solid ${theme.border}`,
                  background: "var(--bs-body-bg)",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: theme.heading,
                    lineHeight: 1.3,
                  }}
                >
                  {currentTeacher}
                </div>
                <div style={{ color: theme.muted, fontSize: "12px" }}>
                  Teacher
                </div>
              </div>

              <div
                className="mt-3 d-flex align-items-center gap-2"
                style={{ color: theme.muted, fontSize: "13px" }}
              >
                <span style={{ fontSize: "15px" }}>📅</span>
                <span>Date:</span>
                <strong style={{ color: theme.heading, fontSize: "13px" }}>
                  {currentDateFormatted}
                </strong>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="mb-3 d-flex align-items-start gap-2">
                <span style={{ fontSize: "14px", color: theme.primary }}>◌</span>
                <div>
                  <div style={{ color: theme.muted, fontSize: "12px" }}>Subject:</div>
                  <div
                    style={{
                      color: theme.heading,
                      fontSize: "14px",
                      fontWeight: 700,
                      lineHeight: 1.3,
                    }}
                  >
                    {currentSubject}
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-start gap-2">
                <span style={{ fontSize: "14px", color: theme.warning }}>◔</span>
                <div>
                  <div style={{ color: theme.muted, fontSize: "12px" }}>Time Slot:</div>
                  <div
                    style={{
                      color: theme.heading,
                      fontSize: "14px",
                      fontWeight: 700,
                      lineHeight: 1.3,
                    }}
                  >
                    {currentTimeSlot}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="mb-3"
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: "10px",
            background: theme.sectionBg,
            padding: "14px 14px",
          }}
        >
          <h6
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: theme.heading,
              marginBottom: "14px",
            }}
          >
            New Session Details
          </h6>

          <div className="row g-3 align-items-end">
            <div className="col-lg-6">
              <label
                className="form-label"
                style={{
                  fontWeight: 500,
                  color: theme.muted,
                  fontSize: "12px",
                  marginBottom: "6px",
                }}
              >
                Subject:
              </label>

              <select
                className="form-select theme-native-control"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                disabled={profileLoading || submitting}
                style={{
                  height: "40px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                {subjectOptions.length === 0 ? (
                  <option value="">
                    {profileLoading ? "Loading..." : "No subjects found"}
                  </option>
                ) : (
                  subjectOptions.map((item) => (
                    <option
                      key={`${String(item?.subjectid ?? "")}-${item?.subjectname}`}
                      value={getSubjectOptionValue(item)}
                    >
                      {item?.subjectname}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="col-lg-3">
              <div
                className="d-flex align-items-center gap-2"
                style={{ minHeight: "40px" }}
              >
                <span style={{ fontSize: "15px" }}>📅</span>
                <span style={{ color: theme.muted, fontSize: "12px" }}>Date:</span>
                <strong style={{ color: theme.heading, fontSize: "13px" }}>
                  {selectedDateLabel}
                </strong>
              </div>
            </div>

            <div className="col-lg-3">
              <div
                className="d-flex align-items-center gap-2"
                style={{ minHeight: "40px" }}
              >
                <span style={{ fontSize: "15px", color: theme.warning }}>◔</span>
                <span style={{ color: theme.muted, fontSize: "12px" }}>Time Slot:</span>
                <strong style={{ color: theme.heading, fontSize: "13px" }}>
                  {selectedSlot?.label || "-"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3 align-items-end mb-3">
          <div className="col-lg-8">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm nav-circle-btn"
                  onClick={goPrevWeek}
                  disabled={!canGoPrevWeek || submitting}
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    border: `1px solid ${theme.border}`,
                    background: theme.softBg,
                    color: theme.text,
                    fontSize: "15px",
                    padding: 0,
                    opacity: canGoPrevWeek ? 1 : 0.5,
                    cursor: canGoPrevWeek ? "pointer" : "not-allowed",
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="btn btn-sm nav-circle-btn"
                  onClick={goNextWeek}
                  disabled={submitting}
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    border: `1px solid ${theme.border}`,
                    background: theme.softBg,
                    color: theme.text,
                    fontSize: "15px",
                    padding: 0,
                  }}
                >
                  ›
                </button>
              </div>

              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: theme.heading,
                }}
              >
                {weekDays[0].format("MMM D")} - {weekDays[6].format("MMM D, YYYY")}
              </div>

              <input
                type="date"
                min={minSelectableDate}
                className="form-control theme-native-control"
                value={selectedDate}
                onChange={handleDateInputChange}
                disabled={submitting}
                style={{
                  width: "240px",
                  height: "38px",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              />
            </div>
          </div>

          <div className="col-lg-4">
            <label
              className="form-label text-center w-100"
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: theme.heading,
                marginBottom: "6px",
              }}
            >
              Set Your Time Zone
            </label>

            <select
              className="form-select theme-native-control"
              value={selectedTimezone}
              onChange={(e) => {
                const nextTz = getSafeTimezone(e.target.value);
                const parsedSelectedDate = parseSelectedDate(selectedDate, nextTz);
                const today = getTodayInTimezone(nextTz);

                setSelectedTimezone(nextTz);
                setSelectedSlot(null);
                setSubmitError("");

                if (parsedSelectedDate && !parsedSelectedDate.isBefore(today, "day")) {
                  setSelectedDate(parsedSelectedDate.format("YYYY-MM-DD"));
                  setSelectedWeekStart(getWeekStart(parsedSelectedDate, nextTz));
                } else {
                  const nextWeek = getWeekStart(today.clone(), nextTz);
                  setSelectedWeekStart(nextWeek);
                  setSelectedDate(getDefaultVisibleDateForWeek(nextWeek, nextTz));
                }
              }}
              disabled={submitting}
              style={{
                height: "38px",
                borderRadius: "8px",
                fontWeight: 500,
                fontSize: "13px",
              }}
            >
              {(timezoneOptions || []).map((tz) => (
                <option key={`${tz.value}-${tz.id || "na"}`} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>

            {timezoneIdWarning ? (
              <div className="mt-2" style={{ fontSize: "11px", color: "var(--bs-danger)" }}>
                {timezoneIdWarning}
              </div>
            ) : null}
          </div>
        </div>

        {profileLoading ? (
          <div className="text-center py-5">Loading teacher availability...</div>
        ) : (
          <div className="row g-2 mb-4 flex-nowrap overflow-auto">
            {weekDays.map((day) => {
              const dayKey = day.format("YYYY-MM-DD");
              const slots = slotsMap[dayKey] || [];
              const isSelected = selectedDate === dayKey;
              const isPastDay = day.isBefore(todayLocal, "day");

              return (
                <div key={dayKey} className="col week-day-col">
                  <div
                    style={{
                      minWidth: "110px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "26px",
                        height: "3px",
                        background: theme.primary,
                        borderRadius: "999px",
                        margin: "0 auto 10px",
                      }}
                    />

                    <div
                      style={{
                        fontWeight: 700,
                        color: theme.heading,
                        marginBottom: "6px",
                        fontSize: "12px",
                      }}
                    >
                      {day.format("ddd")}
                    </div>

                    <button
                      type="button"
                      className="day-btn"
                      disabled={isPastDay || submitting}
                      onClick={() => handleDayPick(dayKey)}
                      style={{
                        width: "34px",
                        height: "30px",
                        borderRadius: "6px",
                        border: isSelected
                          ? `1px solid ${theme.primary}`
                          : `1px solid ${theme.border}`,
                        background: isSelected ? theme.primarySubtle : "var(--bs-body-bg)",
                        color: theme.heading,
                        fontWeight: 700,
                        marginBottom: "12px",
                        fontSize: "12px",
                        opacity: isPastDay ? 0.55 : 1,
                        cursor: isPastDay ? "not-allowed" : "pointer",
                      }}
                    >
                      {day.format("D")}
                    </button>

                    {slots.length === 0 ? (
                      <div
                        style={{
                          background: "var(--bs-secondary-bg)",
                          border: `1px solid ${theme.border}`,
                          borderRadius: "8px",
                          color: theme.muted,
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "8px 6px",
                          minHeight: "40px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1.25,
                        }}
                      >
                        {isPastDay ? "No Slots Available" : "No Slots Available"}
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {slots.map((slot) => {
                          const active =
                            selectedDate === dayKey &&
                            selectedSlot?.start === slot.start &&
                            selectedSlot?.end === slot.end &&
                            !slot.isBooked;

                          const isBooked = Boolean(slot?.isBooked);

                          return (
                            <button
                              key={`${slot.start}-${slot.end}`}
                              type="button"
                              className="slot-btn"
                              disabled={isBooked || submitting}
                              onClick={() => handleSlotPick(day, slot)}
                              style={{
                                border: isBooked
                                  ? `1px dashed ${theme.dangerBorder}`
                                  : active
                                  ? `1px solid ${theme.primary}`
                                  : `1px solid ${theme.border}`,
                                background: isBooked
                                  ? theme.dangerBg
                                  : active
                                  ? theme.primarySubtle
                                  : "var(--bs-secondary-bg)",
                                color: isBooked
                                  ? theme.dangerText
                                  : active
                                  ? theme.primaryText
                                  : theme.muted,
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "8px 6px",
                                lineHeight: 1.2,
                                cursor: isBooked ? "not-allowed" : "pointer",
                                opacity: isBooked ? 0.9 : 1,
                              }}
                              title={isBooked ? "Booked Slot" : "Select slot"}
                            >
                              <div>{slot.label}</div>
                              {isBooked ? (
                                <div style={{ fontSize: "10px", marginTop: "4px" }}>
                                  Booked Slot
                                </div>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="d-flex justify-content-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="btn modal-action-btn"
            disabled={submitting}
            style={{
              flex: 1,
              minWidth: "180px",
              height: "40px",
              borderRadius: "999px",
              background: theme.secondaryBtnBg,
              color: theme.secondaryBtnText,
              fontWeight: 700,
              border: `1px solid ${theme.border}`,
              fontSize: "13px",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn modal-action-btn"
            style={{
              flex: 1,
              minWidth: "180px",
              height: "40px",
              borderRadius: "999px",
              background: canSubmit ? theme.primary : "var(--bs-secondary-bg)",
              color: canSubmit ? "#fff" : theme.muted,
              fontWeight: 700,
              border: "none",
              fontSize: "13px",
              opacity: canSubmit ? 1 : 0.7,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {submitting ? "Rescheduling..." : "Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RescheduleBookingModal;
