import React, { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import Swal from "sweetalert2";
import { getTimezonesLookup } from "../api/getTimezonesLookup";
import { getToken } from "../api/getToken";

// ---------------- helpers ----------------
const norm = (v) => String(v ?? "").toLowerCase().trim();

const toHHMM = (t) => {
  const s = String(t || "");
  const m = moment(s, ["HH:mm:ss.SSSSSS", "HH:mm:ss", "HH:mm"], true);
  return m.isValid() ? m.format("HH:mm") : "";
};

const dayKeyFromName = (name) => {
  const n = String(name || "").toLowerCase().trim();
  if (n.startsWith("sun")) return "Sun";
  if (n.startsWith("mon")) return "Mon";
  if (n.startsWith("tue")) return "Tue";
  if (n.startsWith("wed")) return "Wed";
  if (n.startsWith("thu")) return "Thu";
  if (n.startsWith("fri")) return "Fri";
  if (n.startsWith("sat")) return "Sat";
  return null;
};

const pad2 = (n) => String(n).padStart(2, "0");

// ---- Fixed-offset TZ support (UTC+05:00, GMT+5, +0500 etc) ----
const parseFixedOffsetMinutes = (tzRaw) => {
  const tz = String(tzRaw || "").trim();
  if (!tz) return null;

  if (/^utc$/i.test(tz) || /^gmt$/i.test(tz)) return 0;

  const m =
    tz.match(/^(?:utc|gmt)?\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?\s*$/i) ||
    tz.match(/^([+-])\s*(\d{2})(\d{2})$/i);

  if (!m) return null;

  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2] || 0);
  const mm = Number(m[3] || 0);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return sign * (hh * 60 + mm);
};

const getOffsetMinutes = (timeZone, dateUtc) => {
  const fixed = parseFixedOffsetMinutes(timeZone);
  if (fixed !== null) return fixed;

  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(dateUtc);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "";
    const m = tzPart.match(/([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!m) return 0;
    const sign = m[1] === "-" ? -1 : 1;
    const hh = Number(m[2] || 0);
    const mm = Number(m[3] || 0);
    return sign * (hh * 60 + mm);
  } catch {
    return 0;
  }
};

const shiftUtcByOffset = (utcDate, offsetMin) =>
  new Date(utcDate.getTime() + offsetMin * 60 * 1000);

const formatInTZ = (utcDate, tz) => {
  const fixed = parseFixedOffsetMinutes(tz);
  if (fixed !== null) {
    const d = shiftUtcByOffset(utcDate, fixed);
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }

  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(utcDate);
};

const formatDateInTZ = (utcDate, tz) => {
  const fixed = parseFixedOffsetMinutes(tz);
  if (fixed !== null) {
    const d = shiftUtcByOffset(utcDate, fixed);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
      d.getUTCDate()
    )}`;
  }

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(utcDate);
};

const addDaysDateStr = (dateStr, days) => {
  const [Y, M, D] = String(dateStr).split("-").map(Number);
  const base = new Date(Date.UTC(Y || 1970, (M || 1) - 1, D || 1));
  const d2 = new Date(base.getTime() + (Number(days) || 0) * 86400000);
  return `${d2.getUTCFullYear()}-${pad2(d2.getUTCMonth() + 1)}-${pad2(
    d2.getUTCDate()
  )}`;
};

const isoIndexFromDayKey = (k) =>
  ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[k] || 1);

const getDayKeyInTZ = (utcDate, tz) => {
  const fixed = parseFixedOffsetMinutes(tz);
  if (fixed !== null) {
    const d = shiftUtcByOffset(utcDate, fixed);
    const wd = d.getUTCDay();
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return names[wd] || null;
  }

  try {
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    }).format(utcDate);
    return dayKeyFromName(name);
  } catch {
    return null;
  }
};

const zonedLocalToUtcDate = (dateStr, timeStr, sourceTZ) => {
  const [Y, M, D] = String(dateStr).split("-").map(Number);
  const [hh, mm] = String(timeStr).split(":").map(Number);

  const fixed = parseFixedOffsetMinutes(sourceTZ);
  if (fixed !== null) {
    return new Date(
      Date.UTC(Y, (M || 1) - 1, D || 1, hh || 0, mm || 0, 0) -
        fixed * 60 * 1000
    );
  }

  const off1 = getOffsetMinutes(
    sourceTZ,
    new Date(Date.UTC(Y, (M || 1) - 1, D || 1, hh || 0, mm || 0, 0))
  );
  const utc1 = new Date(
    Date.UTC(Y, (M || 1) - 1, D || 1, hh || 0, mm || 0, 0) - off1 * 60 * 1000
  );
  const off2 = getOffsetMinutes(sourceTZ, utc1);
  const utc2 = new Date(
    Date.UTC(Y, (M || 1) - 1, D || 1, hh || 0, mm || 0, 0) - off2 * 60 * 1000
  );
  return utc2;
};

const getTodayDateStr = (tz) => formatDateInTZ(new Date(), tz);

const isoWeekStartDateStr = (anchorDateStr, tz) => {
  const utcNoon = zonedLocalToUtcDate(anchorDateStr, "12:00", tz);
  const dk = getDayKeyInTZ(utcNoon, tz) || "Mon";
  const isoIdx = isoIndexFromDayKey(dk);
  return addDaysDateStr(anchorDateStr, -(isoIdx - 1));
};

const buildSteppedSlots = (startHHMM, endHHMM, stepMin = 60) => {
  const s = moment(startHHMM, "HH:mm", true);
  const e = moment(endHHMM, "HH:mm", true);
  const step = Number(stepMin || 60);

  if (!s.isValid() || !e.isValid() || !step || step <= 0) return [];

  let startMin = s.hours() * 60 + s.minutes();
  let endMin = e.hours() * 60 + e.minutes();

  if (endMin <= startMin) endMin += 1440;

  const out = [];
  for (let cur = startMin; cur + step <= endMin; cur += step) {
    const stOff = Math.floor(cur / 1440);
    const en = cur + step;
    const enOff = Math.floor(en / 1440);

    const st = cur % 1440;
    const enm = en % 1440;

    const sh = Math.floor(st / 60);
    const sm = st % 60;
    const eh = Math.floor(enm / 60);
    const em = enm % 60;

    out.push({
      start: `${pad2(sh)}:${pad2(sm)}`,
      end: `${pad2(eh)}:${pad2(em)}`,
      startDayOffset: stOff,
      endDayOffset: enOff,
    });
  }
  return out;
};

const overlaps = (aStart, aEnd, bStart, bEnd) =>
  aStart < bEnd && aEnd > bStart;

const FALLBACK_AVATAR = "https://gostudy.ae/assets/invalid-square.png";

const getAvatarSrc = (src) => {
  const s = String(src ?? "").trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
    return FALLBACK_AVATAR;
  }
  return s;
};

// ---------- Searchable Select ----------
const SearchableSelect = ({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false,
  theme = "light",
  withAvatar = false,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value]
  );

  const filtered = useMemo(() => {
    const s = norm(q);
    if (!s) return options;
    return options.filter((o) => norm(o.label).includes(s));
  }, [options, q]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!open) return;
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <div ref={wrapRef} className="mbmSS">
      <button
        type="button"
        disabled={disabled}
        className={`mbmSSBtn ${theme === "dark" ? "mbmSSBtnDark" : ""}`}
        onClick={() => setOpen((p) => !p)}
      >
        <span className={`mbmSSText ${!selected ? "mbmSSPlaceholder" : ""}`}>
          {selected ? (
            <span className="mbmOptRow">
              {withAvatar ? (
                <img
                  className="mbmAvatar"
                  src={getAvatarSrc(selected?.avatar)}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = FALLBACK_AVATAR;
                  }}
                />
              ) : null}
              <span>{selected.label}</span>
            </span>
          ) : (
            placeholder
          )}
        </span>
        <span className="mbmSSChevron">▾</span>
      </button>

      {open && !disabled && (
        <div className={`mbmSSMenu ${theme === "dark" ? "mbmSSMenuDark" : ""}`}>
          <div className="mbmSSSearchWrap">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={`mbmSSSearch ${
                theme === "dark" ? "mbmSSSearchDark" : ""
              }`}
              placeholder={searchPlaceholder}
            />
          </div>

          <div className="mbmSSList">
            {filtered.length === 0 ? (
              <div className="mbmSSEmpty">No results</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`mbmSSItem ${
                    String(o.value) === String(value) ? "mbmSSItemActive" : ""
                  } ${theme === "dark" ? "mbmSSItemDark" : ""}`}
                  onClick={() => {
                    onChange?.(o.value);
                    setOpen(false);
                  }}
                >
                  <span className="mbmOptRow">
                    {withAvatar ? (
                      <img
                        className="mbmAvatar"
                        src={getAvatarSrc(o?.avatar)}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = FALLBACK_AVATAR;
                        }}
                      />
                    ) : null}
                    <span>{o.label}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ManualBookingModal = ({ isOpen, title = "Manual Booking", onClose }) => {
  // ---------------- DARK DETECT ----------------
  const [isDark, setIsDark] = useState(false);

  const detectDark = () => {
    try {
      const b = document.body;
      const html = document.documentElement;

      const classDark =
        b.classList.contains("dark") ||
        b.classList.contains("dark-mode") ||
        b.classList.contains("theme-dark") ||
        html.classList.contains("dark") ||
        html.classList.contains("theme-dark") ||
        b.getAttribute("data-theme") === "dark" ||
        b.getAttribute("data-bs-theme") === "dark" ||
        html.getAttribute("data-theme") === "dark" ||
        html.getAttribute("data-bs-theme") === "dark";

      if (classDark) return true;

      const bg = window.getComputedStyle(b).backgroundColor || "";
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!m) return false;

      const r = Number(m[1]);
      const g = Number(m[2]);
      const bl = Number(m[3]);
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      return luminance < 120;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const apply = () => setIsDark(detectDark());
    apply();

    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-bs-theme"],
    });
    obs.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "data-bs-theme", "style"],
    });

    return () => obs.disconnect();
  }, []);

  // ---------------- state ----------------
  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState("");

  const [studentsRaw, setStudentsRaw] = useState([]);
  const [teachersRaw, setTeachersRaw] = useState([]);

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  const [studentListError, setStudentListError] = useState("");
  const [teacherListError, setTeacherListError] = useState("");

  const [teacherProfileLoading, setTeacherProfileLoading] = useState(false);
  const [teacherProfileError, setTeacherProfileError] = useState("");
  const [teacherProfileData, setTeacherProfileData] = useState(null);

  const [subjectId, setSubjectId] = useState("");
  const [subjects, setSubjects] = useState([]);

  const [paymentType, setPaymentType] = useState("direct");
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [sessionType, setSessionType] = useState("Online");
  const [bookingType, setBookingType] = useState("Manual");
  const [paymentStatus, setPaymentStatus] = useState("Paid");

  const [selectedSlot, setSelectedSlot] = useState(null);

  const [customSlotDate, setCustomSlotDate] = useState("");
  const [customSlotStart, setCustomSlotStart] = useState("");
  const [customSlotEnd, setCustomSlotEnd] = useState("");
  const [customSlotTz, setCustomSlotTz] = useState("UTC");
  const [customSlotError, setCustomSlotError] = useState("");

  const lastNonFreeAmountRef = useRef("");
  const prevPaymentStatusRef = useRef("Paid");

  const [bookedUtcIntervals, setBookedUtcIntervals] = useState([]);
  const [bookedLoading, setBookedLoading] = useState(false);

  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");

  const [timezones, setTimezones] = useState([]);
  const [studentTz, setStudentTz] = useState("UTC");
  const userDetectedTzRef = useRef("UTC");

  const [weekAnchorDateStr, setWeekAnchorDateStr] = useState(() =>
    getTodayDateStr("UTC")
  );

  const [scrollA, setScrollA] = useState(0);
  const [scrollB, setScrollB] = useState(0);
  const schedRefA = useRef(null);
  const schedRefB = useRef(null);

  // ---------------- Entitlements (Block + Subscription) ----------------
  const [blockInfo, setBlockInfo] = useState({ hasActive: false });
  const [subInfo, setSubInfo] = useState({ hasActive: false });
  const [entDone, setEntDone] = useState({ block: false, sub: false });
  const studentReqRef = useRef(0);

  // ---------------- APIs ----------------
  const STORED_PROC_URL =
    "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";
  const TEACHER_PROFILE_URL =
    "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=teacher_profile";

  const FUTURE_BOOKING_COUNT_URL =
    "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_future_booking_count";

  const SUBSCRIPTION_URL =
    "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_monthly_subscription_by_userid";

  const BOOK_TEACHER_URL =
    "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=book_teacher";

  const BOOKED_SLOTS_PROC = "get_teacher_bookings";

  const buildHeaders = async () => {
    const token = await getToken();
    return {
      projectid: "1",
      userid: "test",
      password: "test",
      "x-api-key": "abc123456789",
      "Content-Type": "application/json",
      token: token || "",
    };
  };

  // ---------------- timezones lookup + auto detect user TZ ----------------
  useEffect(() => {
    (async () => {
      let userTz = "UTC";
      try {
        userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch {}

      userDetectedTzRef.current = userTz;

      try {
        const res = await getTimezonesLookup();
        if (res?.statusCode === 200) {
          const tzs = res?.data || [];
          setTimezones(Array.isArray(tzs) ? tzs : []);
          setStudentTz(userTz);
          setCustomSlotTz(userTz);
          setWeekAnchorDateStr(getTodayDateStr(userTz));
          return;
        }
      } catch (e) {
        console.error("getTimezonesLookup error:", e);
      }

      setTimezones([]);
      setStudentTz(userTz);
      setCustomSlotTz(userTz);
      setWeekAnchorDateStr(getTodayDateStr(userTz));
    })();
  }, []);

  const timezoneOptions = useMemo(() => {
    let list = [];
    if (Array.isArray(timezones) && timezones.length) {
      list = timezones.map((t) => ({
        value: t.timezone,
        label: t.timezone,
        timezoneid: t.timezoneid ?? t.id ?? t.timezoneId ?? null,
      }));
    }

    const ensureOption = (tzValue) => {
      const val = String(tzValue || "").trim();
      if (!val) return;
      const exists = list.some((o) => String(o.value) === val);
      if (!exists) {
        list.unshift({
          value: val,
          label: val,
          timezoneid: null,
        });
      }
    };

    ensureOption(studentTz);
    ensureOption(customSlotTz);

    if (!list.length) {
      const fallbackTz = studentTz || customSlotTz || "UTC";
      list = [
        {
          value: fallbackTz,
          label: fallbackTz,
          timezoneid: null,
        },
      ];
    }

    const seen = new Set();
    return list.filter((x) => {
      const k = String(x.value);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [timezones, studentTz, customSlotTz]);

  const getTzStringById = (tzId) => {
    const id = String(tzId ?? "").trim();
    if (!id) return "";
    const found = (timezoneOptions || []).find(
      (z) => String(z.timezoneid ?? "") === id
    );
    return found?.value || "";
  };

  const resolveTz = (tzIdOrName, fallback) => {
    const raw = String(tzIdOrName ?? "").trim();
    if (!raw) return fallback || "UTC";

    if (
      raw.includes("/") ||
      raw === "UTC" ||
      raw.startsWith("Etc/") ||
      parseFixedOffsetMinutes(raw) !== null
    ) {
      return raw;
    }

    const byId = getTzStringById(raw);
    if (byId) return byId;

    return fallback || "UTC";
  };

  const getTimezoneIdByValue = (tzValue) => {
    const opt = (timezoneOptions || []).find(
      (o) => String(o.value) === String(tzValue)
    );
    const id = opt?.timezoneid;
    return id === null || id === undefined || id === "" ? "" : String(id);
  };

  // ---------------- fetch Students/Teachers ----------------
  const fetchStudents = async () => {
    setLoadingStudents(true);
    setStudentListError("");
    try {
      const headers = await buildHeaders();
      const resp = await fetch(STORED_PROC_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ procedureName: "GetAllStudents" }),
      });
      const json = await resp.json();

      if (json?.statusCode !== 200) {
        setStudentsRaw([]);
        setStudentListError(json?.message || "Failed to load students");
        return;
      }
      setStudentsRaw(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      console.error("fetchStudents error:", e);
      setStudentsRaw([]);
      setStudentListError("Network/API error while loading students");
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchTeachers = async () => {
    setLoadingTeachers(true);
    setTeacherListError("");
    try {
      const headers = await buildHeaders();
      const resp = await fetch(STORED_PROC_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ procedureName: "GetAllTeachers" }),
      });
      const json = await resp.json();

      if (json?.statusCode !== 200) {
        setTeachersRaw([]);
        setTeacherListError(json?.message || "Failed to load teachers");
        return;
      }
      setTeachersRaw(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      console.error("fetchTeachers error:", e);
      setTeachersRaw([]);
      setTeacherListError("Network/API error while loading teachers");
    } finally {
      setLoadingTeachers(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setStudentId("");
    setTeacherId("");
    setSubjects([]);
    setSubjectId("");
    setTeacherProfileData(null);
    setTeacherProfileError("");
    setSelectedSlot(null);

    setPaymentType("direct");
    setAmount("");
    setAmountTouched(false);
    setSessionType("Online");
    setBookingType("Manual");
    setPaymentStatus("Paid");
    prevPaymentStatusRef.current = "Paid";
    lastNonFreeAmountRef.current = "";
    setCustomSlotError("");

    setBookingSubmitting(false);
    setBookingError("");
    setBookingSuccess("");

    setScrollA(0);
    setScrollB(0);

    const tz = userDetectedTzRef.current || studentTz || "UTC";
    setStudentTz(tz);
    setCustomSlotTz(tz);
    setWeekAnchorDateStr(getTodayDateStr(tz));
    setCustomSlotDate(getTodayDateStr(tz));
    setCustomSlotStart("");
    setCustomSlotEnd("");

    setBookedUtcIntervals([]);
    setBookedLoading(false);

    setBlockInfo({ hasActive: false });
    setSubInfo({ hasActive: false });
    setEntDone({ block: false, sub: false });
    studentReqRef.current = 0;

    fetchStudents();
    fetchTeachers();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const minDate = getTodayDateStr(customSlotTz || "UTC");
    setCustomSlotDate((prev) => {
      if (!prev) return minDate;
      return prev < minDate ? minDate : prev;
    });
  }, [customSlotTz]);

  useEffect(() => {
    if (selectedSlot?.kind === "custom") {
      setSelectedSlot(null);
    }
    setCustomSlotError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customSlotTz]);

  const students = useMemo(() => {
    return (studentsRaw || [])
      .map((s) => {
        const uid = String(s?.userid ?? "").trim();
        if (!uid) return null;
        const fullName =
          `${s?.firstname || ""} ${s?.lastname || ""}`.trim() ||
          String(s?.fullname || "").trim() ||
          "Student";

        const price = Number(String(s?.price ?? "").replace(/[^\d.]/g, "")) || 0;

        return {
          value: uid,
          label: fullName,
          avatar: String(s?.imagepath || "").trim() || "",
          price,
        };
      })
      .filter(Boolean);
  }, [studentsRaw]);

  const teachers = useMemo(() => {
    return (teachersRaw || [])
      .map((t) => {
        const uid = String(t?.userid ?? "").trim();
        if (!uid) return null;
        const fullName =
          `${t?.firstname || ""} ${t?.lastname || ""}`.trim() ||
          String(t?.fullname || "").trim() ||
          "Teacher";
        return {
          value: uid,
          label: fullName,
          avatar: String(t?.imagepath || "").trim() || "",
        };
      })
      .filter(Boolean);
  }, [teachersRaw]);

  const selectedStudentName = useMemo(() => {
    return (
      students.find((s) => String(s.value) === String(studentId))?.label ||
      "Student"
    );
  }, [students, studentId]);

  const selectedTeacherName = useMemo(() => {
    return (
      teachers.find((t) => String(t.value) === String(teacherId))?.label ||
      "Teacher"
    );
  }, [teachers, teacherId]);

  // ---------------- teacher_profile on teacher select ----------------
  const fetchTeacherProfile = async (tid) => {
    setTeacherProfileLoading(true);
    setTeacherProfileError("");
    setTeacherProfileData(null);
    setSubjects([]);
    setSubjectId("");
    setSelectedSlot(null);
    setCustomSlotError("");

    try {
      const headers = await buildHeaders();
      const resp = await fetch(TEACHER_PROFILE_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ teacherid: String(tid) }),
      });
      const json = await resp.json();

      if (json?.statusCode !== 200) {
        setTeacherProfileError(json?.message || "Failed to load teacher profile");
        return;
      }

      const data = json?.data || null;
      setTeacherProfileData(data);

      const subjArr = Array.isArray(data?.teachingprofile_subjects)
        ? data.teachingprofile_subjects
        : [];
      const uniq = new Map();
      for (const s of subjArr) {
        const sid = String(s?.subjectid ?? "").trim();
        if (!sid) continue;
        if (!uniq.has(sid)) {
          uniq.set(
            sid,
            String(s?.subjectname || "").trim() || `Subject ${sid}`
          );
        }
      }
      const opts = Array.from(uniq.entries()).map(([value, label]) => ({
        value,
        label,
      }));
      setSubjects(opts);
      if (opts.length) setSubjectId(String(opts[0].value));
    } catch (e) {
      console.error("fetchTeacherProfile error:", e);
      setTeacherProfileError("Network/API error while loading teacher profile");
    } finally {
      setTeacherProfileLoading(false);
    }
  };

  useEffect(() => {
    if (!teacherId) {
      setTeacherProfileData(null);
      setSubjects([]);
      setSubjectId("");
      setSelectedSlot(null);
      setCustomSlotError("");
      setTeacherProfileError("");
      setBookedUtcIntervals([]);
      return;
    }
    fetchTeacherProfile(teacherId);
  }, [teacherId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------- entitlement fetch (block + subscription) ----------------
  const parseDT = (s) =>
    moment(
      String(s || "").trim(),
      ["YYYY-MM-DD HH:mm:ss", moment.ISO_8601],
      true
    );

  const isBlockActiveFromRow = (row) => {
    const pkg = Number(row?.package ?? 0) || 0;
    const used = Number(row?.credits ?? 0) || 0;
    const remaining = Math.max(pkg - used, 0);

    const createdAt = parseDT(row?.createdAt);
    if (!createdAt.isValid()) return false;

    const daysOld = moment().diff(createdAt, "days");
    const within60 = daysOld <= 60;

    return within60 && remaining > 0;
  };

  const fetchBlockEntitlement = async (sid, reqId) => {
    try {
      const headers = await buildHeaders();
      const sidNum = Number(String(sid || "").trim());
      if (!sidNum) {
        if (studentReqRef.current !== reqId) return;
        setBlockInfo({ hasActive: false });
        return;
      }

      const resp = await fetch(FUTURE_BOOKING_COUNT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          tablename: "bookteacher",
          conditions: [{ studentid: sidNum, bookdate: "CURDATE()" }],
          studentid: sidNum,
        }),
      });
      const json = await resp.json();
      if (studentReqRef.current !== reqId) return;

      const rows = Array.isArray(json?.data) ? json.data : [];
      const sorted = [...rows].sort((a, b) => {
        const ta = parseDT(a?.createdAt).isValid()
          ? parseDT(a?.createdAt).valueOf()
          : 0;
        const tb = parseDT(b?.createdAt).isValid()
          ? parseDT(b?.createdAt).valueOf()
          : 0;
        return tb - ta;
      });
      const r = sorted[0] || null;

      if (!r) {
        setBlockInfo({ hasActive: false });
        return;
      }

      const pkg = Number(r?.package ?? 0) || 0;
      const used = Number(r?.credits ?? 0) || 0;
      const remaining = Math.max(pkg - used, 0);
      const createdAtStr = String(r?.createdAt || "");
      const createdAt = parseDT(createdAtStr);
      const daysOld = createdAt.isValid()
        ? moment().diff(createdAt, "days")
        : null;

      const hasActive = isBlockActiveFromRow(r);

      setBlockInfo({
        hasActive,
        package: pkg,
        used,
        remaining,
        createdAt: createdAtStr,
        daysOld,
      });
    } catch (e) {
      console.error("fetchBlockEntitlement error:", e);
      if (studentReqRef.current !== reqId) return;
      setBlockInfo({ hasActive: false });
    } finally {
      if (studentReqRef.current === reqId) {
        setEntDone((p) => ({ ...(p || {}), block: true }));
      }
    }
  };

  // FIXED: subscription-level end first, then item-level fallback
  const computeSubscriptionExpiry = (rec) => {
    const stripeEnd =
      rec?.stripe_subscription?.current_period_end ??
      rec?.stripe_subscription?.items?.data?.[0]?.current_period_end ??
      null;

    if (stripeEnd && Number(stripeEnd) > 0) {
      const exp = moment.unix(Number(stripeEnd));
      return exp.isValid() ? exp : null;
    }

    const purchase = parseDT(rec?.purchase_date);
    if (!purchase.isValid()) return null;
    return purchase.clone().add(30, "days");
  };

  // FIXED: Stripe status priority, canceled-at-period-end still valid till expiry
  const isSubscriptionActiveFromRow = (r) => {
    const remaining = Number(r?.remaining_bookings ?? 0) || 0;
    if (remaining <= 0) return false;

    const isDeleted = Number(r?.is_deleted ?? 0) || 0;
    const isExpiredFlag = Number(r?.is_expired ?? 0) || 0;
    if (isDeleted !== 0 || isExpiredFlag !== 0) return false;

    const stripeStatus = String(
      r?.stripe_subscription?.status || ""
    ).toLowerCase();
    const localStatus = String(r?.status || "").toLowerCase();

    const exp = computeSubscriptionExpiry(r);
    const validTime = exp ? moment().isBefore(exp) : false;
    if (!validTime) return false;

    if (stripeStatus === "active" || stripeStatus === "trialing") {
      return true;
    }

    if (!stripeStatus && (localStatus === "active" || localStatus === "trialing")) {
      return true;
    }

    return false;
  };

  const fetchSubscriptionEntitlement = async (sid, reqId) => {
    try {
      const headers = await buildHeaders();
      const sidNum = Number(String(sid || "").trim());
      if (!sidNum) {
        if (studentReqRef.current !== reqId) return;
        setSubInfo({ hasActive: false });
        return;
      }

      const resp = await fetch(SUBSCRIPTION_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ userid: sidNum }),
      });
      const json = await resp.json();
      if (studentReqRef.current !== reqId) return;

      const rows = Array.isArray(json?.data) ? json.data : [];
      const sorted = [...rows].sort((a, b) => {
        const ta = parseDT(a?.purchase_date).isValid()
          ? parseDT(a?.purchase_date).valueOf()
          : 0;
        const tb = parseDT(b?.purchase_date).isValid()
          ? parseDT(b?.purchase_date).valueOf()
          : 0;
        return tb - ta;
      });
      const r = sorted[0] || null;

      if (!r) {
        setSubInfo({ hasActive: false });
        return;
      }

      const remaining = Number(r?.remaining_bookings ?? 0) || 0;
      const purchaseDate = String(r?.purchase_date || "");
      const exp = computeSubscriptionExpiry(r);
      const expiresAt = exp ? exp.format("YYYY-MM-DD HH:mm:ss") : "";
      const daysLeft = exp ? Math.max(exp.diff(moment(), "days"), 0) : null;

      const hasActive = isSubscriptionActiveFromRow(r);

      setSubInfo({
        hasActive,
        remaining,
        purchaseDate,
        expiresAt,
        daysLeft,
        packageName: String(r?.package_name || ""),
        rawStatus: String(r?.status || ""),
        stripeStatus: String(r?.stripe_subscription?.status || ""),
      });
    } catch (e) {
      console.error("fetchSubscriptionEntitlement error:", e);
      if (studentReqRef.current !== reqId) return;
      setSubInfo({ hasActive: false });
    } finally {
      if (studentReqRef.current === reqId) {
        setEntDone((p) => ({ ...(p || {}), sub: true }));
      }
    }
  };

  const handleStudentSelect = (v) => {
    const nextId = String(v || "");
    setStudentId(nextId);

    setAmountTouched(false);
    setBookingError("");
    setBookingSuccess("");
    setSelectedSlot(null);
    setCustomSlotError("");

    setBlockInfo({ hasActive: false });
    setSubInfo({ hasActive: false });
    setEntDone({ block: false, sub: false });

    if (!nextId) {
      if (paymentStatus === "Free") {
        setAmount("0");
      } else {
        setAmount("");
      }
      lastNonFreeAmountRef.current = "";
      setPaymentType("direct");
      return;
    }

    const st = students.find((s) => String(s.value) === String(nextId)) || null;
    const price = Number(st?.price ?? 0) || 0;
    const nextAmount = price > 0 ? String(price) : "";

    if (paymentStatus === "Free") {
      lastNonFreeAmountRef.current = nextAmount;
      setAmount("0");
    } else {
      lastNonFreeAmountRef.current = nextAmount;
      setAmount(nextAmount);
    }

    setPaymentType("direct");

    const reqId = ++studentReqRef.current;
    fetchBlockEntitlement(nextId, reqId);
    fetchSubscriptionEntitlement(nextId, reqId);
  };

  const effectiveLock = useMemo(() => {
    if (!studentId) return "";
    if (!(entDone.block && entDone.sub)) return "";
    if (blockInfo?.hasActive) return "block";
    if (subInfo?.hasActive) return "subscription";
    return "direct";
  }, [
    studentId,
    entDone.block,
    entDone.sub,
    blockInfo?.hasActive,
    subInfo?.hasActive,
  ]);

  useEffect(() => {
    if (!studentId) return;
    if (!effectiveLock) return;
    setPaymentType(effectiveLock);
  }, [studentId, effectiveLock]);

  const isPaymentOptionDisabled = (val) => {
    if (!studentId) return false;
    if (!effectiveLock) return false;
    return String(val) !== String(effectiveLock);
  };

  const isFreePayment = paymentStatus === "Free";

  useEffect(() => {
    const prev = prevPaymentStatusRef.current;

    if (paymentStatus === "Free") {
      const currentAmount = String(amount ?? "").trim();
      if (currentAmount && currentAmount !== "0") {
        lastNonFreeAmountRef.current = currentAmount;
      }
      if (currentAmount !== "0") {
        setAmount("0");
      }
    } else if (prev === "Free") {
      const restoreAmount =
        lastNonFreeAmountRef.current ||
        (() => {
          const st =
            students.find((s) => String(s.value) === String(studentId)) || null;
          const price = Number(st?.price ?? 0) || 0;
          return price > 0 ? String(price) : "";
        })();
      setAmount(restoreAmount);
    }

    prevPaymentStatusRef.current = paymentStatus;
  }, [paymentStatus, amount, students, studentId]);

  const buildSelectedSlotUtcInterval = (slot) => {
    if (!slot?.dateStr || !slot?.start || !slot?.end) return null;

    const slotTz =
      String(slot?.bookingTz || studentTz || "UTC").trim() || "UTC";

    const startUtc = zonedLocalToUtcDate(slot.dateStr, slot.start, slotTz);
    let endDateStr = slot.dateStr;

    if (moment(slot.end, "HH:mm").isSameOrBefore(moment(slot.start, "HH:mm"))) {
      endDateStr = addDaysDateStr(slot.dateStr, 1);
    }

    const endUtc = zonedLocalToUtcDate(endDateStr, slot.end, slotTz);
    if (endUtc.getTime() <= startUtc.getTime()) return null;

    return { startUtc, endUtc, endDateStr };
  };

  const buildCustomSlotCandidate = () => {
    const dateStr = String(customSlotDate || "").trim();
    const start = toHHMM(customSlotStart);
    const end = toHHMM(customSlotEnd);
    const bookingTz = String(customSlotTz || "").trim() || "UTC";

    if (!dateStr || !start || !end) {
      return { error: "Please select custom date, start time and end time." };
    }

    if (!bookingTz) {
      return { error: "Please select custom slot timezone." };
    }

    if (start === end) {
      return { error: "Start and end time cannot be same." };
    }

    const todayStr = getTodayDateStr(bookingTz);
    if (dateStr < todayStr) {
      return { error: "Past date is not allowed for custom slot." };
    }

    const slot = {
      id: `custom-${dateStr}-${start}-${end}-${bookingTz}`,
      availId: "",
      dayKey: dayKeyFromName(moment(dateStr, "YYYY-MM-DD").format("ddd")) || "",
      dateStr,
      start,
      end,
      isGroup: false,
      noofParticipants: "1",
      teacherTz: bookingTz,
      bookingTz,
      booked: false,
    };

    const utcInterval = buildSelectedSlotUtcInterval(slot);
    if (!utcInterval) {
      return { error: "Invalid custom slot time range." };
    }

    const hasConflict = (bookedUtcIntervals || []).some((b) =>
      overlaps(
        utcInterval.startUtc.getTime(),
        utcInterval.endUtc.getTime(),
        b.start.getTime(),
        b.end.getTime()
      )
    );

    if (hasConflict) {
      return {
        error: "This custom slot overlaps with an already booked slot.",
      };
    }

    return { slot };
  };

  const applyCustomSlot = async () => {
    setBookingError("");
    setBookingSuccess("");

    if (!teacherId) {
      setCustomSlotError("Please select teacher first.");
      await Swal.fire({
        icon: "warning",
        title: "Required",
        text: "Please select teacher first.",
      });
      return;
    }

    if (bookedLoading) {
      setCustomSlotError("Teacher bookings are still loading. Please try again.");
      await Swal.fire({
        icon: "info",
        title: "Please wait",
        text: "Teacher bookings are still loading. Please try again.",
      });
      return;
    }

    const { slot, error } = buildCustomSlotCandidate();

    if (error) {
      setCustomSlotError(error);
      await Swal.fire({
        icon: "warning",
        title: "Invalid Custom Slot",
        text: error,
      });
      return;
    }

    setCustomSlotError("");
    setSelectedSlot({ kind: "custom", ...slot });
  };

  // ---------------- week helpers ----------------
  const weekStartDateStr = useMemo(
    () => isoWeekStartDateStr(weekAnchorDateStr, studentTz),
    [weekAnchorDateStr, studentTz]
  );
  const weekEndDateStr = useMemo(
    () => addDaysDateStr(weekStartDateStr, 6),
    [weekStartDateStr]
  );

  const weekLabel = useMemo(() => {
    const a = moment(weekStartDateStr, "YYYY-MM-DD").format("MMM D");
    const b = moment(weekEndDateStr, "YYYY-MM-DD").format("MMM D, YYYY");
    return `${a} - ${b}`;
  }, [weekStartDateStr, weekEndDateStr]);

  const dayKeys = useMemo(
    () => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    []
  );

  const handlePrevWeek = () =>
    setWeekAnchorDateStr((d) => addDaysDateStr(d, -7));
  const handleNextWeek = () =>
    setWeekAnchorDateStr((d) => addDaysDateStr(d, 7));
  const handleDatePick = (e) => {
    const v = e.target.value;
    if (!v) return;
    setWeekAnchorDateStr(v);
  };

  useEffect(() => {
    if (!isOpen) return;

    if (!teacherId) {
      setBookedUtcIntervals([]);
      return;
    }

    (async () => {
      setBookedLoading(true);
      try {
        const headers = await buildHeaders();
        const resp = await fetch(STORED_PROC_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            procedureName: BOOKED_SLOTS_PROC,
            parameters: [String(teacherId)],
          }),
        });

        const json = await resp.json();
        if (json?.statusCode !== 200) {
          setBookedUtcIntervals([]);
          return;
        }

        const rows = Array.isArray(json?.data) ? json.data : [];
        const intervals = [];

        for (const r of rows) {
          const dateStr = String(r?.bookdate || "").trim();
          const start = toHHMM(r?.slot_start);
          const end = toHHMM(r?.slot_end);
          const tz = String(r?.timezone || "UTC").trim() || "UTC";
          if (!dateStr || !start || !end) continue;

          const utcStart = zonedLocalToUtcDate(dateStr, start, tz);

          let endDateStr = dateStr;
          if (moment(end, "HH:mm").isSameOrBefore(moment(start, "HH:mm"))) {
            endDateStr = addDaysDateStr(dateStr, 1);
          }
          const utcEnd = zonedLocalToUtcDate(endDateStr, end, tz);

          if (utcEnd.getTime() > utcStart.getTime()) {
            intervals.push({ start: utcStart, end: utcEnd });
          }
        }

        setBookedUtcIntervals(intervals);
      } catch (e) {
        console.error("get_teacher_bookings error:", e);
        setBookedUtcIntervals([]);
      } finally {
        setBookedLoading(false);
      }
    })();
  }, [isOpen, teacherId]); // eslint-disable-line react-hooks/exhaustive-deps

  const bookedForWeek = useMemo(() => {
    if (!bookedUtcIntervals?.length) return [];
    const rangeStartUtc = zonedLocalToUtcDate(
      weekStartDateStr,
      "00:00",
      studentTz
    );
    const rangeEndUtc = zonedLocalToUtcDate(
      addDaysDateStr(weekEndDateStr, 1),
      "00:00",
      studentTz
    );
    return bookedUtcIntervals.filter(
      (b) =>
        b.end.getTime() > rangeStartUtc.getTime() &&
        b.start.getTime() < rangeEndUtc.getTime()
    );
  }, [bookedUtcIntervals, weekStartDateStr, weekEndDateStr, studentTz]);

  useEffect(() => {
    setSelectedSlot(null);
    setCustomSlotError("");
    setBookingError("");
    setBookingSuccess("");
  }, [studentId, teacherId, studentTz, weekAnchorDateStr]);

  // ---------------- horizontal slider/scroll ----------------
  const applyScroll = (ref, pct) => {
    const el = ref?.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    el.scrollLeft = Math.round((pct / 100) * max);
  };

  const bindScrollSync = (ref, setPct) => {
    const el = ref.current;
    if (!el) return () => {};
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return setPct(0);
      const pct = Math.round((el.scrollLeft / max) * 100);
      setPct(pct);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  };

  useEffect(() => bindScrollSync(schedRefA, setScrollA), []);
  useEffect(() => bindScrollSync(schedRefB, setScrollB), []);

  // ---------------- build slots ----------------
  const { oneToOneByDay, groupByDay } = useMemo(() => {
    const base1 = {
      Mon: [],
      Tue: [],
      Wed: [],
      Thu: [],
      Fri: [],
      Sat: [],
      Sun: [],
    };
    const baseG = {
      Mon: [],
      Tue: [],
      Wed: [],
      Thu: [],
      Fri: [],
      Sat: [],
      Sun: [],
    };

    const nowUtc = new Date();
    const todayStr = formatDateInTZ(nowUtc, studentTz);

    const arr = Array.isArray(teacherProfileData?.teacheravailability)
      ? teacherProfileData.teacheravailability
      : [];

    const profileTzId = String(
      teacherProfileData?.profile?.[0]?.timezoneid ?? ""
    ).trim();
    const fallbackTeacherTz = resolveTz(profileTzId, studentTz);

    const defaultStepMin =
      Number(
        teacherProfileData?.profile?.[0]?.slotduration ||
          teacherProfileData?.profile?.[0]?.sessionduration ||
          60
      ) || 60;

    const seen = new Set();

    for (const a of arr) {
      const dayKey = dayKeyFromName(a?.day);
      if (!dayKey) continue;

      const dayIdx = dayKeys.indexOf(dayKey);
      if (dayIdx < 0) continue;

      const baseDateStr = addDaysDateStr(weekStartDateStr, dayIdx);

      if (baseDateStr < todayStr) continue;

      const startRaw = toHHMM(a?.timefrom);
      const endRaw = toHHMM(a?.timeto);
      if (!startRaw || !endRaw) continue;

      const isGroup = String(a?.isGroup ?? "0") === "1";
      const noofParticipants = String(a?.noofParticipants ?? "");

      const tzId = String(a?.timezoneid ?? "").trim();
      const teacherTz = resolveTz(tzId, fallbackTeacherTz);

      const stepMin =
        Number(a?.slotduration || a?.duration || defaultStepMin) || 60;
      const pieces = buildSteppedSlots(startRaw, endRaw, stepMin);

      for (const hp of pieces) {
        const startDateStr = addDaysDateStr(baseDateStr, hp.startDayOffset);
        const endDateStr = addDaysDateStr(baseDateStr, hp.endDayOffset);

        const utcStart = zonedLocalToUtcDate(startDateStr, hp.start, teacherTz);
        const utcEnd = zonedLocalToUtcDate(endDateStr, hp.end, teacherTz);

        const showStart = formatInTZ(utcStart, studentTz);
        const showEnd = formatInTZ(utcEnd, studentTz);

        const isBooked = (bookedForWeek || []).some((b) =>
          overlaps(
            utcStart.getTime(),
            utcEnd.getTime(),
            b.start.getTime(),
            b.end.getTime()
          )
        );

        const dedupeKey = `${a?.id || "av"}|${dayKey}|${baseDateStr}|${showStart}|${showEnd}|${
          isGroup ? "G" : "O"
        }|${isBooked ? "B" : "A"}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const slot = {
          id: `${a?.id || "av"}-${dayKey}-${baseDateStr}-${hp.start}-${hp.end}-${showStart}`,
          availId: String(a?.id ?? ""),
          dayKey,
          dateStr: baseDateStr,
          start: showStart,
          end: showEnd,
          isGroup,
          noofParticipants,
          teacherTz,
          booked: isBooked,
        };

        if (isGroup) baseG[dayKey].push(slot);
        else base1[dayKey].push(slot);
      }
    }

    const sortFn = (x, y) => {
      if (x.start !== y.start) return x.start > y.start ? 1 : -1;
      return x.end > y.end ? 1 : x.end < y.end ? -1 : 0;
    };

    for (const k of Object.keys(base1)) base1[k].sort(sortFn);
    for (const k of Object.keys(baseG)) baseG[k].sort(sortFn);

    return { oneToOneByDay: base1, groupByDay: baseG };
  }, [
    teacherProfileData,
    weekStartDateStr,
    dayKeys,
    studentTz,
    timezoneOptions,
    bookedForWeek,
  ]);

  const paymentTypes = useMemo(
    () => [
      { value: "direct", label: "Direct Booking" },
      { value: "subscription", label: "Subscription Booking" },
      { value: "block", label: "Block Booking" },
    ],
    []
  );

  useEffect(() => {
    if (!isOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev || "";
    };
  }, [isOpen, onClose]);

  const toHHMMSS = (hhmm) => {
    const v = String(hhmm || "").trim();
    if (!v) return "";
    if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return v;
    if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
    const m = moment(v, ["HH:mm:ss", "HH:mm"], true);
    return m.isValid() ? m.format("HH:mm:ss") : "";
  };

  const normalizeSessionType = (v) => {
    const s = String(v || "").toLowerCase().trim();
    if (s.includes("person")) return "In-Person";
    return "Online";
  };

  const normalizeBookingType = () => "Manual";

  const normalizePaymentStatus = (v) => {
    const s = String(v || "").toLowerCase().trim();
    if (s === "free") return "Free";
    return s === "paid" ? "Paid" : "Unpaid";
  };

  const createBooking = async () => {
    setBookingError("");
    setBookingSuccess("");

    if (!studentId) {
      Swal.fire({
        icon: "warning",
        title: "Required",
        text: "Please select student.",
      });
      return;
    }
    if (!teacherId) {
      Swal.fire({
        icon: "warning",
        title: "Required",
        text: "Please select teacher.",
      });
      return;
    }
    if (!subjectId) {
      Swal.fire({
        icon: "warning",
        title: "Required",
        text: "Please select subject.",
      });
      return;
    }
    if (!selectedSlot) {
      Swal.fire({
        icon: "warning",
        title: "Required",
        text: "Please select slot.",
      });
      return;
    }

    const bookingTz =
      String(
        selectedSlot?.kind === "custom"
          ? selectedSlot?.bookingTz || customSlotTz || studentTz
          : selectedSlot?.bookingTz || studentTz
      ).trim() || "UTC";

    const tzId = getTimezoneIdByValue(bookingTz);
    if (!tzId) {
      Swal.fire({
        icon: "warning",
        title: "Timezone Missing",
        text: "Timezone ID not found for selected timezone. Please select a valid timezone.",
      });
      return;
    }

    const normalizedPaymentStatus = normalizePaymentStatus(paymentStatus);
    const feesNum =
      normalizedPaymentStatus === "Free"
        ? 0
        : Number(String(amount || "").replace(/[^\d.]/g, ""));

    if (normalizedPaymentStatus !== "Free" && (!feesNum || feesNum <= 0)) {
      Swal.fire({
        icon: "warning",
        title: "Invalid Amount",
        text: "Please enter a valid Amount.",
      });
      return;
    }

    const bookdate = String(selectedSlot.dateStr || "").trim();
    const slot_start = toHHMMSS(selectedSlot.start);
    const slot_end = toHHMMSS(selectedSlot.end);

    if (!bookdate || !slot_start || !slot_end) {
      Swal.fire({
        icon: "error",
        title: "Invalid Slot",
        text: "Invalid slot date/time. Please re-select a slot.",
      });
      return;
    }

    const selectedUtcInterval = buildSelectedSlotUtcInterval(selectedSlot);
    if (!selectedUtcInterval) {
      Swal.fire({
        icon: "error",
        title: "Invalid Slot",
        text: "Selected slot timing is invalid. Please re-select a slot.",
      });
      return;
    }

    const hasBookingConflict = (bookedUtcIntervals || []).some((b) =>
      overlaps(
        selectedUtcInterval.startUtc.getTime(),
        selectedUtcInterval.endUtc.getTime(),
        b.start.getTime(),
        b.end.getTime()
      )
    );

    if (hasBookingConflict) {
      Swal.fire({
        icon: "warning",
        title: "Slot Already Booked",
        text: "This slot overlaps with an already booked slot. Please choose another slot.",
      });
      return;
    }

    const confirmText = `Are you sure you want to book this session of ${selectedStudentName} with ${selectedTeacherName}?\n\nDate: ${bookdate}\nTime: ${selectedSlot.start} - ${selectedSlot.end}\nTimezone: ${bookingTz}`;
    const confirmRes = await Swal.fire({
      icon: "question",
      title: "Confirm Booking",
      text: confirmText,
      showCancelButton: true,
      confirmButtonText: "Yes, Book",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!confirmRes.isConfirmed) return;

    const isGroup = selectedSlot.kind === "group" ? 1 : 0;

    const noofParticipants = String(
      selectedSlot.kind === "group"
        ? selectedSlot.noofParticipants || "2"
        : "1"
    );

    const finalPaymentType = effectiveLock || String(paymentType || "direct");

    const body = {
      tablename: "bookteacher",
      studentid: Number(studentId),
      userid: Number(studentId),
      createdby: Number(studentId),
      teacherid: String(teacherId),
      timezoneid: String(tzId),
      bookdate: String(bookdate),
      slot_start: String(slot_start),
      slot_end: String(slot_end),
      payment_status: normalizedPaymentStatus,
      isGroup: Number(isGroup),
      noofParticipants: String(noofParticipants),
      trail_done: "",
      paymentmethod: "card",
      fees: Number(feesNum),
      subjectid: Number(subjectId),
      promoCode: "",
      paymentType: String(finalPaymentType),
      sessionType: normalizeSessionType(sessionType),
      bookingType: normalizeBookingType(bookingType),
    };

    setBookingSubmitting(true);
    try {
      const headers = await buildHeaders();
      const resp = await fetch(BOOK_TEACHER_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const json = await resp.json();

      if (json?.statusCode !== 200) {
        setBookingError(json?.message || "Booking failed");
        Swal.fire({
          icon: "error",
          title: "Booking Failed",
          text: json?.message || "Booking failed",
        });
        return;
      }

      const okMsg = `Booking Successful (ID: ${json?.data?.id || "-"}) - ${
        json?.data?.teachername || selectedTeacherName
      }`;

      setBookingSuccess(okMsg);

      Swal.fire({
        icon: "success",
        title: "Booking Created",
        text: okMsg,
      });

      try {
        const headers2 = await buildHeaders();
        const resp2 = await fetch(STORED_PROC_URL, {
          method: "POST",
          headers: headers2,
          body: JSON.stringify({
            procedureName: BOOKED_SLOTS_PROC,
            parameters: [String(teacherId)],
          }),
        });
        const json2 = await resp2.json();
        if (json2?.statusCode === 200) {
          const rows = Array.isArray(json2?.data) ? json2.data : [];
          const intervals = [];
          for (const r of rows) {
            const dateStr = String(r?.bookdate || "").trim();
            const start = toHHMM(r?.slot_start);
            const end = toHHMM(r?.slot_end);
            const tz = String(r?.timezone || "UTC").trim() || "UTC";
            if (!dateStr || !start || !end) continue;

            const utcStart = zonedLocalToUtcDate(dateStr, start, tz);
            let endDateStr = dateStr;
            if (moment(end, "HH:mm").isSameOrBefore(moment(start, "HH:mm"))) {
              endDateStr = addDaysDateStr(dateStr, 1);
            }
            const utcEnd = zonedLocalToUtcDate(endDateStr, end, tz);
            if (utcEnd.getTime() > utcStart.getTime()) {
              intervals.push({ start: utcStart, end: utcEnd });
            }
          }
          setBookedUtcIntervals(intervals);
        }
      } catch {
        // ignore refresh errors
      }
    } catch (e) {
      console.error("book_teacher error:", e);
      setBookingError("Network/API error while creating booking");
      Swal.fire({
        icon: "error",
        title: "Network Error",
        text: "Network/API error while creating booking",
      });
    } finally {
      setBookingSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const renderSchedule = ({
    titleText,
    kind,
    dataByDay,
    emptyText,
    sliderValue,
    setSliderValue,
    scrollRef,
  }) => {
    return (
      <div style={{ marginTop: 18 }}>
        <div className="mbmScheduleTitle">{titleText}</div>

        <div className="mbmScheduleBar">
          <div className="mbmWeekLeft">
            <button
              className="btn btn-sm mbmBtnIcon"
              onClick={handlePrevWeek}
              type="button"
            >
              ‹
            </button>
            <div className="mbmWeekLabel">{weekLabel}</div>
            <button
              className="btn btn-sm mbmBtnIcon"
              onClick={handleNextWeek}
              type="button"
            >
              ›
            </button>

            <input
              type="date"
              className="form-control mbmControl"
              style={{ maxWidth: 210 }}
              value={weekAnchorDateStr}
              onChange={handleDatePick}
            />
          </div>

          <div className="mbmTzBox">
            <div className="mbmTzLabel">
              Set Your Time Zone {bookedLoading ? " (loading bookings...)" : ""}
            </div>
            <select
              className="form-select mbmControl"
              value={studentTz}
              onChange={(e) => setStudentTz(e.target.value)}
            >
              {timezoneOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mbmSliderRow">
          <input
            type="range"
            min={0}
            max={100}
            value={sliderValue}
            onChange={(e) => {
              const v = Number(e.target.value || 0);
              setSliderValue(v);
              applyScroll(scrollRef, v);
            }}
            className="mbmSlider"
          />
        </div>

        <div ref={scrollRef} className="mbmSchedScroll">
          <div className="mbmSchedGrid">
            {dayKeys.map((dayKey, idx) => {
              const dayDateStr = addDaysDateStr(weekStartDateStr, idx);
              const dayDate = moment(dayDateStr, "YYYY-MM-DD");
              const slots = dataByDay[dayKey] || [];

              return (
                <div className="mbmSchedDay" key={`${kind}-${dayKey}`}>
                  <div className="mbmSchedTopLine" />
                  <div className="mbmSchedDayName">{dayKey}</div>
                  <div className="mbmSchedDayNum">{dayDate.format("D")}</div>

                  <div className="mbmSchedBody">
                    {slots.length === 0 ? (
                      <div className="mbmSchedEmpty">{emptyText}</div>
                    ) : (
                      slots.map((s) => {
                        if (s.booked) {
                          return (
                            <div key={s.id} className="mbmSchedBooked">
                              Slot Booked
                            </div>
                          );
                        }

                        const isSelected =
                          selectedSlot?.kind === kind &&
                          String(selectedSlot?.id) === String(s.id);

                        return (
                          <button
                            type="button"
                            key={s.id}
                            className={`mbmSchedSlot ${
                              isSelected ? "mbmSchedSlotActive" : ""
                            }`}
                            onClick={() => {
                              setCustomSlotError("");
                              setSelectedSlot({ kind, ...s, bookingTz: studentTz });
                            }}
                          >
                            {s.start} - {s.end}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{
        background: isDark ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.55)",
        padding: "24px 12px",
      }}
      onMouseDown={(e) => {
        if (e.target?.classList?.contains("modal")) onClose?.();
      }}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div
          className="modal-content"
          style={{ background: "transparent", border: 0, boxShadow: "none" }}
        >
          <style>{`
            .mbmWrap * { box-sizing: border-box; }
            .mbmWrap{
              --mbm-bg: ${isDark ? "#0b1220" : "#ffffff"};
              --mbm-text: ${isDark ? "#e5e7eb" : "#101828"};
              --mbm-muted: ${isDark ? "rgba(229,231,235,0.78)" : "#667085"};
              --mbm-border: ${isDark ? "rgba(148,163,184,0.22)" : "rgba(16,24,40,0.10)"};
              --mbm-soft: ${isDark ? "rgba(148,163,184,0.10)" : "rgba(16,24,40,0.04)"};
              --mbm-primary: ${isDark ? "#3b82f6" : "#0d6efd"};
            }

            .mbmCard{
              background: var(--mbm-bg);
              color: var(--mbm-text);
              border: 1px solid var(--mbm-border);
              border-radius: 18px;
              overflow: hidden;
              box-shadow: ${
                isDark
                  ? "0 30px 90px rgba(0,0,0,0.60)"
                  : "0 25px 70px rgba(0,0,0,0.35)"
              };
              display:flex;
              flex-direction:column;
              max-height: calc(100vh - 80px);
            }

            .mbmHeader{
              flex: 0 0 auto;
              display:flex;
              align-items:center;
              justify-content:space-between;
              padding: 14px 16px;
              border-bottom: 1px solid var(--mbm-border);
              background: ${
                isDark
                  ? "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(148,163,184,0.06))"
                  : "linear-gradient(135deg, rgba(13,110,253,0.18), rgba(13,110,253,0.04))"
              };
            }
            .mbmHeaderLeft{ display:flex; align-items:center; gap:12px; }
            .mbmIcon{
              width: 36px; height: 36px; border-radius: 12px;
              display:flex; align-items:center; justify-content:center;
              font-weight: 900; font-size: 18px;
              background: ${isDark ? "rgba(59,130,246,0.22)" : "rgba(13,110,253,0.14)"};
              color: var(--mbm-primary);
              border: 1px solid var(--mbm-border);
            }
            .mbmTitle{ font-weight: 900; line-height: 1.1; }

            .mbmBody{
              flex: 1 1 auto;
              overflow-y: auto;
              padding: 16px;
            }

            .mbmLabel{ font-weight: 800; font-size: 13px; margin-bottom: 6px; }

            .mbmControl{
              border-radius: 14px !important;
              border: 1px solid var(--mbm-border) !important;
              background: var(--mbm-bg) !important;
              color: var(--mbm-text) !important;
              box-shadow: ${
                isDark
                  ? "0 10px 24px rgba(0,0,0,0.25)"
                  : "0 6px 18px rgba(15,23,42,0.06)"
              };
              font-weight: 800;
            }

            .mbmSS{ position: relative; width: 100%; }
            .mbmSSBtn{
              width:100%;
              display:flex; align-items:center; justify-content:space-between;
              padding: 10px 12px;
              border-radius: 14px;
              border: 1px solid var(--mbm-border);
              background: var(--mbm-bg);
              color: var(--mbm-text);
              box-shadow: ${
                isDark
                  ? "0 10px 24px rgba(0,0,0,0.25)"
                  : "0 6px 18px rgba(15,23,42,0.06)"
              };
              font-weight: 800;
            }
            .mbmSSPlaceholder{ color: var(--mbm-muted); font-weight: 800; }
            .mbmSSMenu{
              position:absolute;
              top: calc(100% + 8px);
              left: 0;
              right: 0;
              z-index: 9999;
              border-radius: 14px;
              border: 1px solid var(--mbm-border);
              background: var(--mbm-bg);
              box-shadow: ${
                isDark
                  ? "0 18px 40px rgba(0,0,0,0.55)"
                  : "0 18px 45px rgba(15,23,42,0.20)"
              };
              overflow:hidden;
            }
            .mbmSSSearchWrap{ padding: 10px; border-bottom: 1px solid var(--mbm-border); background: var(--mbm-soft); }
            .mbmSSSearch{
              width:100%;
              border-radius: 12px;
              border: 1px solid var(--mbm-border);
              background: var(--mbm-bg);
              color: var(--mbm-text);
              padding: 10px 12px;
              font-weight: 800;
              outline: none;
            }
            .mbmSSList{ max-height: 220px; overflow: auto; padding: 6px; }
            .mbmSSItem{
              width:100%;
              text-align:left;
              border: 1px solid transparent;
              background: transparent;
              color: var(--mbm-text);
              padding: 9px 10px;
              border-radius: 12px;
              font-weight: 800;
            }
            .mbmSSItem:hover{ background: var(--mbm-soft); border-color: var(--mbm-border); }
            .mbmSSItemActive{
              background: ${isDark ? "rgba(59,130,246,0.18)" : "rgba(13,110,253,0.10)"};
              border-color: ${isDark ? "rgba(59,130,246,0.30)" : "rgba(13,110,253,0.22)"};
              color: var(--mbm-primary);
            }
            .mbmSSEmpty{ padding: 12px 10px; color: var(--mbm-muted); text-align:center; font-weight: 900; }

            .mbmOptRow{ display:flex; align-items:center; gap:10px; }
            .mbmAvatar{
              width: 26px; height: 26px;
              border-radius: 999px;
              object-fit: cover;
              border: 1px solid var(--mbm-border);
              background: var(--mbm-soft);
              flex: 0 0 auto;
            }

            .mbmBtnIcon{
              width: 36px; height: 34px;
              border-radius: 999px !important;
              border: 1px solid var(--mbm-border) !important;
              background: rgba(148,163,184,0.18) !important;
              color: var(--mbm-text) !important;
              font-weight: 900;
              display:flex;
              align-items:center;
              justify-content:center;
            }

            .mbmScheduleTitle{
              font-weight: 900;
              font-size: 18px;
              margin: 10px 0 10px;
            }

            .mbmScheduleBar{
              display:flex;
              align-items:flex-start;
              justify-content:space-between;
              gap: 14px;
              flex-wrap: wrap;
              padding: 6px 0 8px;
            }

            .mbmWeekLeft{
              display:flex;
              align-items:center;
              gap: 10px;
              flex-wrap: wrap;
            }

            .mbmWeekLabel{
              font-weight: 900;
              color: var(--mbm-text);
            }

            .mbmTzBox{
              min-width: 320px;
              display:flex;
              flex-direction:column;
              gap: 6px;
            }
            .mbmTzLabel{
              font-weight: 900;
              color: var(--mbm-text);
              font-size: 14px;
              text-align:right;
            }

            .mbmSliderRow{
              display:flex;
              justify-content:flex-end;
              padding: 4px 0 8px;
            }
            .mbmSlider{ width: 320px; }

            .mbmSchedScroll{
              overflow-x: auto;
              overflow-y: hidden;
              padding-bottom: 10px;
            }

            .mbmSchedGrid{
              display:grid;
              grid-template-columns: repeat(7, minmax(160px, 1fr));
              gap: 16px;
              min-width: 1200px;
            }

            .mbmSchedDay{ text-align:center; padding-top: 6px; }
            .mbmSchedTopLine{
              height: 3px; width: 32px; margin: 0 auto 10px;
              background: var(--mbm-primary);
              border-radius: 999px; opacity: 0.9;
            }
            .mbmSchedDayName{ font-weight: 900; margin-bottom: 6px; }
            .mbmSchedDayNum{
              width: 34px; height: 34px; margin: 0 auto 12px;
              border-radius: 8px; border: 1px solid rgba(60, 90, 160, 0.55);
              display:flex; align-items:center; justify-content:center;
              font-weight: 900; background: var(--mbm-bg);
            }
            .mbmSchedBody{
              min-height: 46px;
              display:flex;
              flex-direction:column;
              gap: 10px;
              align-items:center;
            }

            .mbmSchedEmpty{
              width: 100%;
              max-width: 210px;
              padding: 8px 10px;
              border-radius: 10px;
              background: rgba(148,163,184,0.18);
              color: rgba(102,112,133,0.95);
              font-weight: 800;
              font-size: 12px;
            }

            .mbmSchedBooked{
              width: 100%;
              max-width: 210px;
              padding: 8px 10px;
              border-radius: 10px;
              background: rgba(148,163,184,0.18);
              color: rgba(102,112,133,0.95);
              font-weight: 900;
              font-size: 12px;
            }

            .mbmSchedSlot{
              border: 0; background: transparent;
              color: var(--mbm-text);
              font-weight: 900; font-size: 13px;
              cursor: pointer; padding: 0;
              line-height: 1.1;
            }
            .mbmSchedSlotActive{
              color: var(--mbm-primary);
              text-decoration: underline;
              text-underline-offset: 4px;
            }

            .mbmErr{
              margin-top: 6px;
              font-size: 12px;
              font-weight: 900;
              color: ${isDark ? "#fca5a5" : "#b42318"};
            }
            .mbmOk{
              margin-top: 6px;
              font-size: 12px;
              font-weight: 900;
              color: ${isDark ? "#86efac" : "#067647"};
            }

            .mbmSeg{
              width: 100%;
              display:flex;
              align-items:center;
              gap: 6px;
              padding: 6px;
              border-radius: 16px;
              border: 1px solid var(--mbm-border);
              background: var(--mbm-bg);
              box-shadow: ${
                isDark
                  ? "0 10px 24px rgba(0,0,0,0.25)"
                  : "0 6px 18px rgba(15,23,42,0.06)"
              };
            }
            .mbmSegBtn{
              flex:1;
              border: 1px solid transparent;
              background: transparent;
              color: var(--mbm-text);
              border-radius: 14px;
              padding: 10px 10px;
              font-weight: 900;
              line-height: 1;
              cursor: pointer;
            }
            .mbmSegBtnActivePrimary{
              background: ${isDark ? "rgba(59,130,246,0.18)" : "rgba(13,110,253,0.10)"};
              border-color: ${isDark ? "rgba(59,130,246,0.30)" : "rgba(13,110,253,0.22)"};
              color: var(--mbm-primary);
            }

            .mbmFooter{
              flex: 0 0 auto;
              padding: 14px 16px;
              border-top: 1px solid var(--mbm-border);
              background: var(--mbm-bg);
              display:flex;
              justify-content:flex-end;
              gap: 10px;
            }

            .mbmBtnGhost{
              border-radius: 14px !important;
              border: 1px solid var(--mbm-border) !important;
              background: transparent !important;
              color: var(--mbm-text) !important;
              font-weight: 800 !important;
            }
            .mbmBtnPrimary{
              border-radius: 14px !important;
              background: var(--mbm-primary) !important;
              border-color: var(--mbm-primary) !important;
              font-weight: 900 !important;
            }
          `}</style>

          <div className="mbmWrap mbmCard">
            <div className="mbmHeader">
              <div className="mbmHeaderLeft">
                <div className="mbmIcon">+</div>
                <div>
                  <div className="mbmTitle">{title}</div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm mbmBtnGhost"
                onClick={onClose}
              >
                ✕ Close
              </button>
            </div>

            <div className="mbmBody">
              <div className="row g-3">
                <div className="col-lg-3 col-md-6">
                  <div className="mbmLabel">Student</div>
                  <SearchableSelect
                    theme={isDark ? "dark" : "light"}
                    value={studentId}
                    onChange={handleStudentSelect}
                    options={students}
                    placeholder={loadingStudents ? "Loading..." : "Select..."}
                    searchPlaceholder="Search..."
                    disabled={loadingStudents}
                    withAvatar={true}
                  />
                  {studentListError ? (
                    <div className="mbmErr">{studentListError}</div>
                  ) : null}
                </div>

                <div className="col-lg-3 col-md-6">
                  <div className="mbmLabel">Teacher</div>
                  <SearchableSelect
                    theme={isDark ? "dark" : "light"}
                    value={teacherId}
                    onChange={(v) => setTeacherId(v)}
                    options={teachers}
                    placeholder={loadingTeachers ? "Loading..." : "Select..."}
                    searchPlaceholder="Search..."
                    disabled={loadingTeachers}
                    withAvatar={true}
                  />
                  {teacherListError ? (
                    <div className="mbmErr">{teacherListError}</div>
                  ) : null}
                  {teacherProfileError ? (
                    <div className="mbmErr">{teacherProfileError}</div>
                  ) : null}
                </div>

                <div className="col-lg-3 col-md-6">
                  <div className="mbmLabel">Subject</div>
                  <select
                    className="form-select mbmControl"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    disabled={!subjects.length || teacherProfileLoading}
                  >
                    {!subjects.length ? (
                      <option value="">
                        {teacherId ? "Loading..." : "Select teacher first"}
                      </option>
                    ) : (
                      <option value="">Select Subject</option>
                    )}
                    {subjects.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-lg-3 col-md-6">
                  <div className="mbmLabel">Payment Type</div>
                  <select
                    className="form-select mbmControl"
                    value={paymentType}
                    onChange={async (e) => {
                      const next = e.target.value;

                      if (isPaymentOptionDisabled(next)) {
                        await Swal.fire({
                          icon: "warning",
                          title: "Not Allowed",
                          text:
                            effectiveLock === "block"
                              ? "Block Booking is active. Only Block Booking is allowed."
                              : effectiveLock === "subscription"
                              ? "Subscription is active. Only Subscription Booking is allowed."
                              : "Direct Booking is the only allowed option for this student.",
                        });
                        setPaymentType(effectiveLock || "direct");
                        return;
                      }

                      setPaymentType(next);
                    }}
                  >
                    {paymentTypes.map((p) => (
                      <option
                        key={p.value}
                        value={p.value}
                        disabled={isPaymentOptionDisabled(p.value)}
                      >
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-lg-3 col-md-6">
                  <div className="mbmLabel">Amount</div>
                  <input
                    type="text"
                    className="form-control mbmControl"
                    placeholder="Type amount..."
                    value={amount}
                    disabled={isFreePayment}
                    title={
                      isFreePayment
                        ? "Amount is auto set to 0 for Free payment status"
                        : "Type amount..."
                    }
                    onChange={(e) => {
                      setAmountTouched(true);
                      lastNonFreeAmountRef.current = e.target.value;
                      setAmount(e.target.value);
                    }}
                  />
                </div>

                <div className="col-lg-3 col-md-6">
                  <div className="mbmLabel">Session Type</div>
                  <select
                    className="form-select mbmControl"
                    value={sessionType}
                    onChange={(e) => setSessionType(e.target.value)}
                  >
                    <option value="Online">Online</option>
                    <option value="In-Person">In-Person</option>
                  </select>
                </div>

                <div className="col-lg-3 col-md-6">
                  <div className="mbmLabel">Booking Type</div>
                  <select
                    className="form-select mbmControl"
                    value={bookingType}
                    onChange={(e) => setBookingType(e.target.value)}
                    disabled
                  >
                    <option value="Manual">Manual</option>
                  </select>
                </div>

                <div className="col-lg-3 col-md-6">
                  <div className="mbmLabel">Payment Status</div>
                  <div
                    className="mbmSeg"
                    role="radiogroup"
                    aria-label="Payment Status"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paymentStatus === "Paid"}
                      className={`mbmSegBtn ${
                        paymentStatus === "Paid" ? "mbmSegBtnActivePrimary" : ""
                      }`}
                      onClick={() => setPaymentStatus("Paid")}
                    >
                      Paid
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paymentStatus === "Unpaid"}
                      className={`mbmSegBtn ${
                        paymentStatus === "Unpaid" ? "mbmSegBtnActivePrimary" : ""
                      }`}
                      onClick={() => setPaymentStatus("Unpaid")}
                    >
                      Unpaid
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paymentStatus === "Free"}
                      className={`mbmSegBtn ${
                        paymentStatus === "Free" ? "mbmSegBtnActivePrimary" : ""
                      }`}
                      onClick={() => setPaymentStatus("Free")}
                    >
                      Free
                    </button>
                  </div>
                </div>
              </div>

              {renderSchedule({
                titleText: "Schedule",
                kind: "oneToOne",
                dataByDay: oneToOneByDay,
                emptyText: "No Slots Available",
                sliderValue: scrollA,
                setSliderValue: setScrollA,
                scrollRef: schedRefA,
              })}

              {renderSchedule({
                titleText: "Schedule Group Session",
                kind: "group",
                dataByDay: groupByDay,
                emptyText: "No Slots Available",
                sliderValue: scrollB,
                setSliderValue: setScrollB,
                scrollRef: schedRefB,
              })}

              <div style={{ marginTop: 18 }}>
                <div className="mbmScheduleTitle">Custom Slot</div>

                <div className="row g-3">
                  <div className="col-lg-3 col-md-6">
                    <div className="mbmLabel">Custom Slot Time Zone</div>
                    <select
                      className="form-select mbmControl"
                      value={customSlotTz}
                      onChange={(e) => setCustomSlotTz(e.target.value)}
                    >
                      {timezoneOptions.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-lg-3 col-md-6">
                    <div className="mbmLabel">Custom Date</div>
                    <input
                      type="date"
                      className="form-control mbmControl"
                      value={customSlotDate}
                      min={getTodayDateStr(customSlotTz)}
                      onChange={(e) => {
                        setCustomSlotError("");
                        setCustomSlotDate(e.target.value);
                      }}
                    />
                  </div>

                  <div className="col-lg-2 col-md-6">
                    <div className="mbmLabel">Start Time</div>
                    <input
                      type="time"
                      className="form-control mbmControl"
                      value={customSlotStart}
                      onChange={(e) => {
                        setCustomSlotError("");
                        setCustomSlotStart(e.target.value);
                      }}
                    />
                  </div>

                  <div className="col-lg-2 col-md-6">
                    <div className="mbmLabel">End Time</div>
                    <input
                      type="time"
                      className="form-control mbmControl"
                      value={customSlotEnd}
                      onChange={(e) => {
                        setCustomSlotError("");
                        setCustomSlotEnd(e.target.value);
                      }}
                    />
                  </div>

                  <div className="col-lg-2 col-md-6 d-flex align-items-end">
                    <button
                      type="button"
                      className="btn btn-sm mbmBtnPrimary w-100"
                      onClick={applyCustomSlot}
                    >
                      Use Custom Slot
                    </button>
                  </div>
                </div>

                {/* <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    color: "var(--mbm-muted)",
                  }}
                >
                  Custom slot selected timezone ({customSlotTz}) ke mutabiq save
                  hoga.
                </div> */}

                {customSlotError ? (
                  <div className="mbmErr">{customSlotError}</div>
                ) : null}
              </div>

              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontWeight: 900 }}>
                  Selected Slot:{" "}
                  {selectedSlot ? (
                    <span style={{ color: "var(--mbm-primary)" }}>
                      {selectedSlot.start}-{selectedSlot.end} ({selectedSlot.dateStr}){" "}
                      {selectedSlot.kind === "group"
                        ? "[Group]"
                        : selectedSlot.kind === "custom"
                        ? `[Custom - ${selectedSlot.bookingTz}]`
                        : "[One to One]"}
                    </span>
                  ) : (
                    <span style={{ color: "var(--mbm-muted)" }}>None</span>
                  )}

                  {bookingError ? <div className="mbmErr">{bookingError}</div> : null}
                  {bookingSuccess ? (
                    <div className="mbmOk">{bookingSuccess}</div>
                  ) : null}
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm mbmBtnGhost"
                    onClick={() => {
                      setSelectedSlot(null);
                      setCustomSlotError("");
                      setBookingError("");
                      setBookingSuccess("");
                    }}
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm mbmBtnPrimary"
                    onClick={createBooking}
                    disabled={!studentId || !teacherId || bookingSubmitting}
                    title={bookingSubmitting ? "Creating booking..." : "Create Booking"}
                  >
                    {bookingSubmitting ? "Creating..." : "Create Booking"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mbmFooter">
              <button type="button" className="btn mbmBtnGhost" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualBookingModal;