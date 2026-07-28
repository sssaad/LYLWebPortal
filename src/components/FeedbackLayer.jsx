import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import { getToken } from "../api/getToken";

const BASE_HEADERS = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
};

const API_BASE =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";

const RUN_SP_URL = `${API_BASE}runStoredProcedure`;
const UPDATE_DYNAMIC_URL = `${API_BASE}update_dynamic_data`;

const SEND_ONE_TO_ONE_EMAIL_URL =
  `${API_BASE}send_progress_report_email`;

const SEND_GROUP_EMAIL_URL =
  `${API_BASE}send_group_progress_report_email`;

const REPORT_TYPES = {
  ONE_TO_ONE: "one_to_one",
  GROUP: "group",
};

const ENUM_OPTIONS = [
  "Excellent",
  "Good",
  "Satisfactory",
  "Poor",
  "Very Poor",
];

const ONE_TO_ONE_SELECT_FIELDS = [
  {
    field: "punctuality",
    label: "Punctuality",
    className: "col-md-4",
  },
  {
    field: "engagement",
    label: "Engagement",
    className: "col-md-4",
  },
  {
    field: "behaviour",
    label: "Behaviour",
    className: "col-md-4",
  },
  {
    field: "understanding",
    label: "Understanding",
    className: "col-md-6",
  },
  {
    field: "final_class_grade",
    label: "Final Class Grade",
    className: "col-md-6",
  },
];

const ONE_TO_ONE_TEXT_FIELDS = [
  {
    field: "topics_covered_today",
    label: "Topics Covered Today",
    placeholder: "Write topics covered today...",
  },
  {
    field: "what_went_well_today",
    label: "What Went Well Today",
    placeholder: "Write what went well today...",
  },
  {
    field: "areas_for_development",
    label: "Areas for Further Development",
    placeholder: "Write areas for further development...",
  },
  {
    field: "recommended_next_steps",
    label: "Recommended Next Steps",
    placeholder: "Write recommended next steps...",
  },
  {
    field: "next_lesson_plan",
    label: "What We Will Work On Next Lesson",
    placeholder: "Write the next lesson plan...",
  },
];

const GROUP_REQUIRED_FIELDS = [
  ["group_rating", "Group Rating"],
  ["topic_covered", "Topic Covered"],
  ["performance_comment", "Performance Comment"],
  ["highlights", "Highlights"],
  ["development_areas", "Development Areas"],
  ["suggested_practice", "Suggested Practice"],
  ["looking_ahead", "Looking Ahead"],
];

const formatDate = (value) => {
  if (!value) return "";

  const parsed = moment(
    value,
    [
      "YYYY-MM-DD",
      "YYYY/MM/DD",
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DDTHH:mm:ss",
      moment.ISO_8601,
    ],
    true
  );

  if (parsed.isValid()) {
    return parsed.format("DD MMM YYYY");
  }

  const loose = moment(value);

  return loose.isValid()
    ? loose.format("DD MMM YYYY")
    : String(value);
};

const formatTime = (value) => {
  if (!value) return "";

  const parsed = moment(
    value,
    ["HH:mm:ss", "HH:mm", "hh:mm A", "h:mm A"],
    true
  );

  if (parsed.isValid()) {
    return parsed.format("hh:mm A");
  }

  const loose = moment(value);

  return loose.isValid()
    ? loose.format("hh:mm A")
    : String(value);
};

const normalizeUrl = (value) =>
  String(value || "")
    .replace(/\\\//g, "/")
    .trim();

const parseBookDateTs = (value) => {
  const raw = String(value || "").trim();

  if (!raw) return 0;

  let parsed = moment(
    raw,
    [
      "YYYY-MM-DD",
      "YYYY/MM/DD",
      "YYYY-MM-DD HH:mm:ss",
      "YYYY-MM-DDTHH:mm:ss",
      "DD MMM YYYY",
      moment.ISO_8601,
    ],
    true
  );

  if (!parsed.isValid()) {
    parsed = moment(raw);
  }

  return parsed.isValid()
    ? parsed.valueOf()
    : 0;
};

const parseTimeMinutes = (value) => {
  const raw = String(value || "").trim();

  if (!raw) return -1;

  let parsed = moment(
    raw,
    ["HH:mm:ss", "HH:mm", "hh:mm A", "h:mm A"],
    true
  );

  if (!parsed.isValid()) {
    parsed = moment(raw);
  }

  return parsed.isValid()
    ? parsed.hours() * 60 + parsed.minutes()
    : -1;
};

const buildFullName = (
  firstName,
  lastName,
  fallback = ""
) => {
  const fullName = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || fallback || "";
};

const detectIsDark = () => {
  try {
    const body = document.body;

    const byAttribute =
      body?.dataset?.theme?.toLowerCase() === "dark" ||
      body?.getAttribute("data-theme")?.toLowerCase() ===
        "dark";

    const byClass =
      body?.classList?.contains("dark") ||
      body?.classList?.contains("theme-dark") ||
      body?.classList?.contains("dark-mode") ||
      body?.classList?.contains("bg-dark");

    if (byAttribute || byClass) {
      return true;
    }

    if (
      window.matchMedia?.(
        "(prefers-color-scheme: dark)"
      )?.matches
    ) {
      return true;
    }

    const background =
      window.getComputedStyle(body).backgroundColor;

    const rgb = background.match(/\d+/g);

    if (rgb?.length >= 3) {
      const red = Number(rgb[0]);
      const green = Number(rgb[1]);
      const blue = Number(rgb[2]);

      const brightness =
        (red * 299 + green * 587 + blue * 114) /
        1000;

      return brightness < 128;
    }

    return false;
  } catch {
    return false;
  }
};

const mapReportRow = (item, reportType) => {
  const isGroup =
    reportType === REPORT_TYPES.GROUP;

  const rawBookDate =
    item.booking_date ??
    item.session_date ??
    item.book_date ??
    item.bookDate ??
    "";

  const rawStart =
    item.booking_start_time ??
    item.session_start_time ??
    item.slot_start ??
    item.slot1_time ??
    item.slotStart ??
    "";

  const rawEnd =
    item.booking_end_time ??
    item.session_end_time ??
    item.slot_end ??
    item.slot2_time ??
    item.slotEnd ??
    "";

  const emailStatus = String(
    item.email_status ??
      item.emailStatus ??
      "pending"
  ).toLowerCase();

  const studentName = buildFullName(
    item.student_firstname,
    item.student_lastname,
    item.student_fullname ??
      item.student_name ??
      item.student?.name ??
      item.studentName ??
      item.username ??
      ""
  );

  const teacherName = buildFullName(
    item.teacher_firstname,
    item.teacher_lastname,
    item.teacher_fullname ??
      item.teacher_name ??
      item.teacher?.name ??
      item.teacherName ??
      ""
  );

  const feedbackId = Number(
    item.feedback_id ??
      (isGroup ? item.id : 0)
  );

  const sessionId = Number(
    item.sessionid ??
      item.booking_id ??
      item.bookingid ??
      0
  );

  return {
    id: item.id,

    reportType,

    feedbackId,

    sessionid: sessionId,

    bookingId: Number(
      item.booking_id ??
        item.bookingid ??
        sessionId ??
        0
    ),

    groupLiveSessionId: Number(
      item.group_live_session_id ?? 0
    ),

    recordingUrl: normalizeUrl(
      item.s3Url ??
        item.s3_url ??
        item.recording_s3_url ??
        item.recordingUrl ??
        ""
    ),

    bookDate: formatDate(rawBookDate),

    slotStart: formatTime(rawStart),

    slotEnd: formatTime(rawEnd),

    bookDateRaw: rawBookDate,

    bookDateTs: parseBookDateTs(rawBookDate),

    slotStartMin: parseTimeMinutes(rawStart),

    email_status:
      emailStatus || "pending",

    student_email_status: String(
      item.student_email_status ?? "pending"
    ).toLowerCase(),

    parent_email_status: String(
      item.parent_email_status ?? "pending"
    ).toLowerCase(),

    isEmailSent:
      emailStatus === "sent",

    studentName,

    teacherName,

    programmeName:
      item.programme_name ??
      item.group_programme_name ??
      "",

    sessionTitle:
      item.session_title ??
      item.group_session_title ??
      "",

    subjectName:
      item.subject_name ??
      item.subjectname ??
      "",

    groupBatchId:
      item.group_batch_id ?? "",

    punctuality:
      item.punctuality ?? "",

    engagement:
      item.engagement ?? "",

    behaviour:
      item.behaviour ?? "",

    understanding:
      item.understanding ?? "",

    final_class_grade:
      item.final_class_grade ?? "",

    topics_covered_today:
      item.topics_covered_today ?? "",

    what_went_well_today:
      item.what_went_well_today ?? "",

    areas_for_development:
      item.areas_for_development ?? "",

    recommended_next_steps:
      item.recommended_next_steps ?? "",

    next_lesson_plan:
      item.next_lesson_plan ?? "",

    topic_covered:
      item.topic_covered ?? "",

    group_rating:
      item.group_rating === null ||
      item.group_rating === undefined
        ? ""
        : String(item.group_rating),

    performance_comment:
      item.performance_comment ?? "",

    highlights:
      item.highlights ?? "",

    development_areas:
      item.development_areas ?? "",

    suggested_practice:
      item.suggested_practice ?? "",

    looking_ahead:
      item.looking_ahead ?? "",
  };
};

const getRowIdentity = (row, reportType) => {
  if (reportType === REPORT_TYPES.GROUP) {
    return `group-${row.feedbackId}`;
  }

  return `one-to-one-${row.sessionid}`;
};

const FeedbackLayer = () => {
  const [activeTab, setActiveTab] = useState(
    REPORT_TYPES.ONE_TO_ONE
  );

  const [rows, setRows] = useState([]);

  const [loading, setLoading] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);

  const [showModal, setShowModal] =
    useState(false);

  const [currentRow, setCurrentRow] =
    useState(null);

  const [
    isRecordingOpen,
    setIsRecordingOpen,
  ] = useState(false);

  const [
    activeRecordingUrl,
    setActiveRecordingUrl,
  ] = useState("");

  const [currentPage, setCurrentPage] =
    useState(1);

  const perPage = 15;

  const [
    savingFeedback,
    setSavingFeedback,
  ] = useState(false);

  const [
    sendingRowKey,
    setSendingRowKey,
  ] = useState("");

  const [isDarkTheme, setIsDarkTheme] =
    useState(false);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [dateFrom, setDateFrom] =
    useState("");

  const [dateTo, setDateTo] =
    useState("");

  const isGroupTab =
    activeTab === REPORT_TYPES.GROUP;

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  useEffect(() => {
    const updateTheme = () => {
      setIsDarkTheme(detectIsDark());
    };

    updateTheme();

    const observer =
      new MutationObserver(updateTheme);

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [
        "class",
        "data-theme",
      ],
    });

    const mediaQuery =
      window.matchMedia?.(
        "(prefers-color-scheme: dark)"
      );

    const handleMediaChange = () => {
      updateTheme();
    };

    mediaQuery?.addEventListener?.(
      "change",
      handleMediaChange
    );

    return () => {
      observer.disconnect();

      mediaQuery?.removeEventListener?.(
        "change",
        handleMediaChange
      );
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchRows = async () => {
      try {
        setLoading(true);

        const token = await getToken();

        if (!token) {
          throw new Error(
            "Token not found"
          );
        }

        const procedureName =
          isGroupTab
            ? "get_group_performance_reports"
            : "get_performance";

        const response =
          await axios.post(
            RUN_SP_URL,
            {
              procedureName,
              parameters: [],
            },
            {
              headers: {
                ...BASE_HEADERS,
                token,
              },
            }
          );

        const data =
          response?.data?.data ?? [];

        const mapped =
          Array.isArray(data)
            ? data.map((item) =>
                mapReportRow(
                  item,
                  activeTab
                )
              )
            : [];

        if (mounted) {
          setRows(mapped);
          setCurrentPage(1);
        }
      } catch (error) {
        console.error(error);

        if (mounted) {
          setRows([]);

          Swal.fire(
            "Error",
            error?.response?.data
              ?.message ||
              "Unable to load progress reports.",
            "error"
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchRows();

    return () => {
      mounted = false;
    };
  }, [
    activeTab,
    isGroupTab,
    reloadKey,
  ]);

  useEffect(() => {
    resetFilters();

    setCurrentRow(null);

    setShowModal(false);

    setSendingRowKey("");
  }, [activeTab]);

  const filteredSortedRows =
    useMemo(() => {
      const sourceRows =
        Array.isArray(rows)
          ? [...rows]
          : [];

      const fromTs = dateFrom
        ? moment(
            dateFrom,
            "YYYY-MM-DD"
          )
            .startOf("day")
            .valueOf()
        : null;

      const toTs = dateTo
        ? moment(
            dateTo,
            "YYYY-MM-DD"
          )
            .endOf("day")
            .valueOf()
        : null;

      const query = String(
        search || ""
      )
        .trim()
        .toLowerCase();

      const filtered =
        sourceRows.filter((row) => {
          const isSent =
            String(
              row.email_status || ""
            ).toLowerCase() ===
              "sent" ||
            row.isEmailSent;

          if (
            statusFilter === "sent" &&
            !isSent
          ) {
            return false;
          }

          if (
            statusFilter === "pending" &&
            isSent
          ) {
            return false;
          }

          if (
            fromTs !== null ||
            toTs !== null
          ) {
            const rowTimestamp =
              Number(
                row.bookDateTs || 0
              );

            if (!rowTimestamp) {
              return false;
            }

            if (
              fromTs !== null &&
              rowTimestamp < fromTs
            ) {
              return false;
            }

            if (
              toTs !== null &&
              rowTimestamp > toTs
            ) {
              return false;
            }
          }

          if (query) {
            const searchableText = [
              row.sessionid,
              row.feedbackId,
              row.bookingId,
              row.bookDate,
              row.studentName,
              row.teacherName,
              row.slotStart,
              row.slotEnd,
              row.programmeName,
              row.sessionTitle,
              row.subjectName,
              row.groupBatchId,
            ]
              .filter(
                (value) =>
                  value !== null &&
                  value !== undefined
              )
              .join(" ")
              .toLowerCase();

            if (
              !searchableText.includes(
                query
              )
            ) {
              return false;
            }
          }

          return true;
        });

      filtered.sort(
        (first, second) => {
          const dateDifference =
            Number(
              second.bookDateTs || 0
            ) -
            Number(
              first.bookDateTs || 0
            );

          if (dateDifference !== 0) {
            return dateDifference;
          }

          const timeDifference =
            Number(
              second.slotStartMin ?? -1
            ) -
            Number(
              first.slotStartMin ?? -1
            );

          if (timeDifference !== 0) {
            return timeDifference;
          }

          const secondId =
            isGroupTab
              ? Number(
                  second.feedbackId || 0
                )
              : Number(
                  second.sessionid || 0
                );

          const firstId =
            isGroupTab
              ? Number(
                  first.feedbackId || 0
                )
              : Number(
                  first.sessionid || 0
                );

          return secondId - firstId;
        }
      );

      return filtered;
    }, [
      rows,
      search,
      statusFilter,
      dateFrom,
      dateTo,
      isGroupTab,
    ]);

  const indexOfLast =
    currentPage * perPage;

  const indexOfFirst =
    indexOfLast - perPage;

  const currentRows =
    filteredSortedRows.slice(
      indexOfFirst,
      indexOfLast
    );

  const totalPages =
    Math.ceil(
      filteredSortedRows.length /
        perPage
    ) || 1;

  useEffect(() => {
    if (
      filteredSortedRows.length === 0
    ) {
      setCurrentPage(1);
    } else if (
      currentPage > totalPages
    ) {
      setCurrentPage(totalPages);
    }
  }, [
    filteredSortedRows.length,
    totalPages,
    currentPage,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  const openRecording = (row) => {
    const url = normalizeUrl(
      row?.recordingUrl
    );

    if (!url) return;

    setActiveRecordingUrl(url);

    setIsRecordingOpen(true);
  };

  const closeRecording = () => {
    setIsRecordingOpen(false);

    setActiveRecordingUrl("");
  };

  const openFeedbackModal = (row) => {
    setCurrentRow({
      ...row,
    });

    setShowModal(true);
  };

  const closeFeedbackModal = () => {
    if (savingFeedback) return;

    setShowModal(false);

    setCurrentRow(null);
  };

  const handleFeedbackChange = (
    field,
    value
  ) => {
    setCurrentRow((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSaveFeedback =
    async () => {
      if (!currentRow) return;

      const isSent =
        String(
          currentRow.email_status || ""
        ).toLowerCase() === "sent" ||
        currentRow.isEmailSent;

      if (isSent) {
        return Swal.fire(
          "Locked",
          "The report has already been emailed and can no longer be edited.",
          "info"
        );
      }

      if (
        isGroupTab &&
        !currentRow.feedbackId
      ) {
        return Swal.fire(
          "Error",
          "Group feedback ID is missing.",
          "error"
        );
      }

      if (
        !isGroupTab &&
        !currentRow.sessionid
      ) {
        return Swal.fire(
          "Error",
          "Session ID is missing.",
          "error"
        );
      }

      const confirmation =
        await Swal.fire({
          title:
            "Save Progress Report?",

          text:
            "The report will remain editable until its email is sent.",

          icon: "question",

          showCancelButton: true,

          confirmButtonText:
            "Yes, Save",

          cancelButtonText:
            "Cancel",
        });

      if (
        !confirmation.isConfirmed
      ) {
        return;
      }

      try {
        setSavingFeedback(true);

        const token =
          await getToken();

        if (!token) {
          throw new Error(
            "Token not found"
          );
        }

        const updatedData =
          isGroupTab
            ? {
                topic_covered:
                  currentRow
                    .topic_covered ||
                  "",

                group_rating:
                  currentRow
                    .group_rating ||
                  "",

                performance_comment:
                  currentRow
                    .performance_comment ||
                  "",

                highlights:
                  currentRow
                    .highlights ||
                  "",

                development_areas:
                  currentRow
                    .development_areas ||
                  "",

                suggested_practice:
                  currentRow
                    .suggested_practice ||
                  "",

                looking_ahead:
                  currentRow
                    .looking_ahead ||
                  "",

                modifieddate:
                  moment().format(
                    "YYYY-MM-DD HH:mm:ss"
                  ),
              }
            : {
                punctuality:
                  currentRow
                    .punctuality ||
                  "",

                engagement:
                  currentRow
                    .engagement ||
                  "",

                behaviour:
                  currentRow
                    .behaviour ||
                  "",

                understanding:
                  currentRow
                    .understanding ||
                  "",

                final_class_grade:
                  currentRow
                    .final_class_grade ||
                  "",

                topics_covered_today:
                  currentRow
                    .topics_covered_today ||
                  "",

                what_went_well_today:
                  currentRow
                    .what_went_well_today ||
                  "",

                areas_for_development:
                  currentRow
                    .areas_for_development ||
                  "",

                recommended_next_steps:
                  currentRow
                    .recommended_next_steps ||
                  "",

                next_lesson_plan:
                  currentRow
                    .next_lesson_plan ||
                  "",
              };

        const conditions =
          isGroupTab
            ? {
                id: Number(
                  currentRow.feedbackId
                ),

                deleted: 0,
              }
            : {
                sessionid: Number(
                  currentRow.sessionid
                ),
              };

        const response =
          await axios.post(
            UPDATE_DYNAMIC_URL,
            {
              token,

              tablename:
                isGroupTab
                  ? "group_session_feedback"
                  : "performance",

              conditions: [
                conditions,
              ],

              updatedata: [
                updatedData,
              ],
            },
            {
              headers: {
                ...BASE_HEADERS,
                token,
              },
            }
          );

        if (
          response?.data
            ?.statusCode !== 200
        ) {
          throw new Error(
            response?.data?.message ||
              "Unable to save the report."
          );
        }

        const currentIdentity =
          getRowIdentity(
            currentRow,
            activeTab
          );

        setRows((previousRows) =>
          previousRows.map((row) =>
            getRowIdentity(
              row,
              activeTab
            ) === currentIdentity
              ? {
                  ...row,
                  ...updatedData,
                }
              : row
          )
        );

        await Swal.fire(
          "Saved",
          "Progress report updated successfully.",
          "success"
        );

        setShowModal(false);

        setCurrentRow(null);
      } catch (error) {
        console.error(error);

        Swal.fire(
          "Error",
          error?.response?.data
            ?.message ||
            error?.message ||
            "Something went wrong while saving the report.",
          "error"
        );
      } finally {
        setSavingFeedback(false);
      }
    };

  const getMissingGroupFields = (
    row
  ) =>
    GROUP_REQUIRED_FIELDS
      .filter(([field]) => {
        const value = row?.[field];

        return (
          value === null ||
          String(value ?? "").trim() ===
            ""
        );
      })
      .map(([, label]) => label);

  const handleSendEmail =
    async (row) => {
      const isSent =
        String(
          row.email_status || ""
        ).toLowerCase() === "sent" ||
        row.isEmailSent;

      if (isSent) {
        return Swal.fire(
          "Already Sent",
          "This progress report has already been emailed.",
          "info"
        );
      }

      if (isGroupTab) {
        if (!row.feedbackId) {
          return Swal.fire(
            "Error",
            "Group feedback ID is missing.",
            "error"
          );
        }

        const missingFields =
          getMissingGroupFields(row);

        if (
          missingFields.length > 0
        ) {
          return Swal.fire({
            title:
              "Complete the Report",

            html: `
              Please complete the following fields before sending:
              <br>
              <strong>${missingFields.join(
                ", "
              )}</strong>
            `,

            icon: "warning",
          });
        }
      } else if (!row.sessionid) {
        return Swal.fire(
          "Error",
          "Session ID is missing.",
          "error"
        );
      }

      const confirmation =
        await Swal.fire({
          title:
            "Send Progress Report?",

          text: isGroupTab
            ? `Send ${row.studentName}'s group progress report to the available student and parent email addresses?`
            : `Send ${row.studentName}'s one-to-one progress report?`,

          icon: "question",

          showCancelButton: true,

          confirmButtonText:
            "Yes, Send",

          cancelButtonText:
            "Cancel",
        });

      if (
        !confirmation.isConfirmed
      ) {
        return;
      }

      const rowKey =
        getRowIdentity(
          row,
          activeTab
        );

      try {
        setSendingRowKey(rowKey);

        const token =
          await getToken();

        if (!token) {
          throw new Error(
            "Token not found"
          );
        }

        const url =
          isGroupTab
            ? SEND_GROUP_EMAIL_URL
            : SEND_ONE_TO_ONE_EMAIL_URL;

        const payload =
          isGroupTab
            ? {
                feedback_id: Number(
                  row.feedbackId
                ),
              }
            : {
                sessionid: Number(
                  row.sessionid
                ),
              };

        const response =
          await axios.post(
            url,
            payload,
            {
              headers: {
                ...BASE_HEADERS,
                token,
              },
            }
          );

        const success =
          response?.data
            ?.statusCode === 200 ||
          response?.data?.status ===
            true ||
          response?.data?.success ===
            true;

        if (!success) {
          throw new Error(
            response?.data?.message ||
              "Email delivery failed."
          );
        }

        setRows((previousRows) =>
          previousRows.map(
            (current) =>
              getRowIdentity(
                current,
                activeTab
              ) === rowKey
                ? {
                    ...current,

                    email_status:
                      "sent",

                    student_email_status:
                      response?.data
                        ?.data
                        ?.student_email_status ??
                      current
                        .student_email_status,

                    parent_email_status:
                      response?.data
                        ?.data
                        ?.parent_email_status ??
                      current
                        .parent_email_status,

                    isEmailSent:
                      true,
                  }
                : current
          )
        );

        setCurrentRow(
          (previous) =>
            previous &&
            getRowIdentity(
              previous,
              activeTab
            ) === rowKey
              ? {
                  ...previous,

                  email_status:
                    "sent",

                  isEmailSent:
                    true,
                }
              : previous
        );

        Swal.fire({
          icon: "success",

          title: "Sent",

          text: isGroupTab
            ? "The group progress report was emailed successfully."
            : "The progress report was emailed successfully.",

          timer: 1900,

          showConfirmButton:
            false,
        });
      } catch (error) {
        console.error(error);

        Swal.fire(
          "Email Not Sent",
          error?.response?.data
            ?.message ||
            error?.message ||
            "Something went wrong while sending the email.",
          "error"
        );

        if (isGroupTab) {
          setReloadKey(
            (value) => value + 1
          );
        }
      } finally {
        setSendingRowKey("");
      }
    };

  const modalThemeClass =
    isDarkTheme
      ? "pf-dark"
      : "pf-light";

  const tableColumnCount =
    isGroupTab ? 10 : 9;

  return (
    <div className="row gy-4">
      <style>{`
        .pf-tabs {
          display: inline-flex;
          gap: 6px;
          padding: 5px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.035);
        }

        .pf-tab-button {
          border: 0;
          border-radius: 9px;
          padding: 9px 18px;
          background: transparent;
          color: inherit;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .pf-tab-button.active {
          background: #45b369;
          color: #ffffff;
          box-shadow: 0 5px 16px rgba(69, 179, 105, 0.25);
        }

        .pf-tab-button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .pf-table {
          min-width: 1040px;
        }

        .pf-table th,
        .pf-table td {
          vertical-align: middle;
          white-space: nowrap;
        }

        .pf-programme-cell {
          min-width: 190px;
          white-space: normal !important;
        }

        .pf-programme-cell small {
          display: block;
          margin-top: 2px;
          opacity: 0.72;
        }

        .pf-modal-card {
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 14px 45px rgba(0, 0, 0, 0.18);
          border: 1px solid rgba(0, 0, 0, 0.06);
        }

        .pf-divider {
          border-top: 1px dashed rgba(0, 0, 0, 0.15);
          margin: 14px 0;
        }

        .pf-meta {
          border-radius: 12px;
          padding: 12px;
          border: 1px solid rgba(0, 0, 0, 0.06);
        }

        .pf-meta small {
          opacity: 0.75;
        }

        .pf-box {
          border-radius: 12px;
          padding: 12px;
          height: 100%;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: transparent;
        }

        .pf-box .form-label {
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .pf-modal-card.pf-light {
          background: #ffffff;
          color: rgba(0, 0, 0, 0.88);
          border-color: rgba(0, 0, 0, 0.08);
        }

        .pf-modal-card.pf-light .modal-header {
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }

        .pf-modal-card.pf-light .pf-meta {
          background: rgba(0, 0, 0, 0.03);
        }

        .pf-modal-card.pf-light .form-select,
        .pf-modal-card.pf-light .form-control {
          background: #ffffff;
          color: rgba(0, 0, 0, 0.88);
          border-color: rgba(0, 0, 0, 0.12);
        }

        .pf-modal-card.pf-dark {
          background: #1f2a3a;
          color: rgba(255, 255, 255, 0.92);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .pf-modal-card.pf-dark .modal-header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .pf-modal-card.pf-dark .modal-title {
          color: rgba(255, 255, 255, 0.95);
        }

        .pf-modal-card.pf-dark .btn-close {
          filter: invert(1) grayscale(100%);
          opacity: 0.85;
        }

        .pf-modal-card.pf-dark .pf-meta {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .pf-modal-card.pf-dark .pf-box {
          border-color: rgba(255, 255, 255, 0.1);
        }

        .pf-modal-card.pf-dark .form-select,
        .pf-modal-card.pf-dark .form-control {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.92);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .pf-modal-card .form-select:disabled,
        .pf-modal-card .form-control:disabled,
        .pf-modal-card textarea:disabled,
        .pf-modal-card input:disabled {
          opacity: 0.75 !important;
          cursor: not-allowed;
        }

        @media (max-width: 767.98px) {
          .pf-tabs {
            display: flex;
            width: 100%;
          }

          .pf-tab-button {
            flex: 1;
            padding: 9px 10px;
            font-size: 13px;
          }

          .pf-filter-control {
            width: 100%;
            min-width: 100% !important;
          }

          .pf-pagination {
            width: 100%;
            justify-content: space-between;
          }
        }

        @keyframes pf-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <div className="col-xxl-12">
        <div className="card h-100 p-0 email-card">
          <div className="card-body p-0">
            <div className="px-3 pt-3">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div
                  className="pf-tabs"
                  role="tablist"
                >
                  <button
                    type="button"
                    className={`pf-tab-button ${
                      !isGroupTab
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setActiveTab(
                        REPORT_TYPES.ONE_TO_ONE
                      )
                    }
                    disabled={
                      loading ||
                      Boolean(
                        sendingRowKey
                      ) ||
                      savingFeedback
                    }
                  >
                    One-to-One
                  </button>

                  <button
                    type="button"
                    className={`pf-tab-button ${
                      isGroupTab
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setActiveTab(
                        REPORT_TYPES.GROUP
                      )
                    }
                    disabled={
                      loading ||
                      Boolean(
                        sendingRowKey
                      ) ||
                      savingFeedback
                    }
                  >
                    Group
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() =>
                    setReloadKey(
                      (value) =>
                        value + 1
                    )
                  }
                  disabled={loading}
                >
                  <Icon
                    icon="solar:refresh-linear"
                    className="me-1"
                  />

                  Refresh
                </button>
              </div>

              <hr className="my-3" />

              <div className="d-flex flex-wrap gap-2 align-items-end">
                <div
                  className="pf-filter-control"
                  style={{
                    minWidth: 240,
                  }}
                >
                  <input
                    className="form-control"
                    placeholder={
                      isGroupTab
                        ? "Search student, teacher or programme"
                        : "Search student, teacher or session"
                    }
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                  />
                </div>

                <div
                  className="pf-filter-control"
                  style={{
                    minWidth: 180,
                  }}
                >
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value
                      )
                    }
                  >
                    <option value="all">
                      All Email Statuses
                    </option>

                    <option value="pending">
                      Pending
                    </option>

                    <option value="sent">
                      Sent
                    </option>
                  </select>
                </div>

                <div
                  className="pf-filter-control"
                  style={{
                    minWidth: 170,
                  }}
                >
                  <input
                    type="date"
                    className="form-control"
                    value={dateFrom}
                    onChange={(event) =>
                      setDateFrom(
                        event.target.value
                      )
                    }
                    title="From date"
                  />
                </div>

                <div
                  className="pf-filter-control"
                  style={{
                    minWidth: 170,
                  }}
                >
                  <input
                    type="date"
                    className="form-control"
                    value={dateTo}
                    onChange={(event) =>
                      setDateTo(
                        event.target.value
                      )
                    }
                    title="To date"
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-outline-secondary pf-filter-control"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>
              </div>

              <hr className="my-3" />
            </div>

            <div className="table-responsive">
              <table className="table bordered-table sm-table mb-0 pf-table">
                <thead>
                  <tr>
                    <th className="text-center">
                      S.L
                    </th>

                    <th className="text-center">
                      Recording
                    </th>

                    <th className="text-center">
                      Book Date
                    </th>

                    <th className="text-center">
                      Student Name
                    </th>

                    <th className="text-center">
                      Teacher Name
                    </th>

                    {isGroupTab && (
                      <th className="text-center">
                        Programme / Session
                      </th>
                    )}

                    <th className="text-center">
                      Slot Start
                    </th>

                    <th className="text-center">
                      Slot End
                    </th>

                    <th className="text-center">
                      Progress Report
                    </th>

                    <th className="text-center">
                      Send Email
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={
                          tableColumnCount
                        }
                        className="text-center py-5"
                      >
                        <span
                          className="d-inline-block"
                          style={{
                            width: 36,
                            height: 36,

                            border:
                              "4px solid #e0e0e0",

                            borderTopColor:
                              "#45B369",

                            borderRadius:
                              "50%",

                            animation:
                              "pf-spin 1s linear infinite",
                          }}
                        />
                      </td>
                    </tr>
                  ) : currentRows.length ===
                    0 ? (
                    <tr>
                      <td
                        className="text-center py-4"
                        colSpan={
                          tableColumnCount
                        }
                      >
                        No{" "}
                        {isGroupTab
                          ? "group"
                          : "one-to-one"}{" "}
                        progress reports
                        found.
                      </td>
                    </tr>
                  ) : (
                    currentRows.map(
                      (row, index) => {
                        const isSent =
                          String(
                            row.email_status ||
                              ""
                          ).toLowerCase() ===
                            "sent" ||
                          row.isEmailSent;

                        const rowKey =
                          getRowIdentity(
                            row,
                            activeTab
                          );

                        const isSending =
                          sendingRowKey ===
                          rowKey;

                        const recordingUrl =
                          normalizeUrl(
                            row.recordingUrl
                          );

                        return (
                          <tr key={rowKey}>
                            <td className="text-center">
                              {indexOfFirst +
                                index +
                                1}
                            </td>

                            <td className="text-center">
                              {recordingUrl ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() =>
                                    openRecording(
                                      row
                                    )
                                  }
                                >
                                  View
                                </button>
                              ) : (
                                "-"
                              )}
                            </td>

                            <td className="text-center">
                              {row.bookDate ||
                                "-"}
                            </td>

                            <td className="text-center">
                              {row.studentName ||
                                "-"}
                            </td>

                            <td className="text-center">
                              {row.teacherName ||
                                "-"}
                            </td>

                            {isGroupTab && (
                              <td className="text-center pf-programme-cell">
                                <strong>
                                  {row.programmeName ||
                                    "-"}
                                </strong>

                                <small>
                                  {row.sessionTitle ||
                                    row.subjectName ||
                                    ""}
                                </small>
                              </td>
                            )}

                            <td className="text-center">
                              {row.slotStart ||
                                "-"}
                            </td>

                            <td className="text-center">
                              {row.slotEnd ||
                                "-"}
                            </td>

                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() =>
                                  openFeedbackModal(
                                    row
                                  )
                                }
                                title={
                                  isSent
                                    ? "View report (locked)"
                                    : "View or edit report"
                                }
                              >
                                <Icon icon="majesticons:eye-line" />
                              </button>
                            </td>

                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={() =>
                                  handleSendEmail(
                                    row
                                  )
                                }
                                disabled={
                                  isSent ||
                                  isSending
                                }
                                title={
                                  isSent
                                    ? "Already sent"
                                    : "Send progress report"
                                }
                              >
                                {isSent
                                  ? "Sent"
                                  : isSending
                                  ? "Sending..."
                                  : "Send"}
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3 px-3 pb-3">
              <span>
                Showing{" "}
                {filteredSortedRows.length ===
                0
                  ? 0
                  : indexOfFirst + 1}{" "}
                to{" "}
                {Math.min(
                  indexOfLast,
                  filteredSortedRows.length
                )}{" "}
                of{" "}
                {
                  filteredSortedRows.length
                }{" "}
                entries
              </span>

              <div className="d-flex align-items-center gap-2 pf-pagination">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.max(
                          1,
                          page - 1
                        )
                    )
                  }
                  disabled={
                    currentPage <= 1
                  }
                >
                  Previous
                </button>

                <span className="small">
                  Page {currentPage} of{" "}
                  {totalPages}
                </span>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.min(
                          totalPages,
                          page + 1
                        )
                    )
                  }
                  disabled={
                    currentPage >=
                    totalPages
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isRecordingOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            background:
              "rgba(0,0,0,0.6)",
            zIndex: 1060,
          }}
          role="dialog"
          aria-modal="true"
          onClick={closeRecording}
        >
          <div
            className="bg-white radius-12 p-16"
            style={{
              width:
                "min(900px, 92vw)",
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">
                Session Recording
              </h6>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={
                  closeRecording
                }
              >
                Close
              </button>
            </div>

            {activeRecordingUrl ? (
              <video
                controls
                autoPlay
                style={{
                  width: "100%",
                  maxHeight: "70vh",
                  background: "#000",
                }}
              >
                <source
                  src={
                    activeRecordingUrl
                  }
                  type="video/mp4"
                />

                Your browser does not
                support the video tag.
              </video>
            ) : (
              <div className="text-center py-5">
                Recording not
                available.
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && currentRow && (
        <div
          className="modal fade show"
          style={{
            display: "block",
            background:
              "rgba(0,0,0,0.5)",
          }}
          onClick={
            closeFeedbackModal
          }
        >
          <div
            className="modal-dialog modal-dialog-centered modal-lg"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div
              className={`modal-content pf-modal-card ${modalThemeClass}`}
            >
              <div className="modal-header">
                <h5 className="modal-title">
                  {isGroupTab
                    ? "Group Progress Report"
                    : "One-to-One Progress Report"}
                </h5>

                <button
                  type="button"
                  className="btn-close"
                  onClick={
                    closeFeedbackModal
                  }
                />
              </div>

              <div className="modal-body">
                {(() => {
                  const isSent =
                    String(
                      currentRow.email_status ||
                        ""
                    ).toLowerCase() ===
                      "sent" ||
                    currentRow.isEmailSent;

                  return (
                    <>
                      <div className="pf-meta">
                        <div className="row g-2">
                          <div className="col-md-6">
                            <small>
                              Student
                            </small>

                            <div className="fw-semibold">
                              {currentRow.studentName ||
                                "-"}
                            </div>
                          </div>

                          <div className="col-md-6">
                            <small>
                              Teacher
                            </small>

                            <div className="fw-semibold">
                              {currentRow.teacherName ||
                                "-"}
                            </div>
                          </div>

                          {isGroupTab && (
                            <>
                              <div className="col-md-6 mt-2">
                                <small>
                                  Programme
                                </small>

                                <div className="fw-semibold">
                                  {currentRow.programmeName ||
                                    "-"}
                                </div>
                              </div>

                              <div className="col-md-6 mt-2">
                                <small>
                                  Session /
                                  Subject
                                </small>

                                <div className="fw-semibold">
                                  {currentRow.sessionTitle ||
                                    currentRow.subjectName ||
                                    "-"}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="mt-2">
                          <small>
                            Status
                          </small>{" "}

                          <span
                            className={`badge ${
                              isSent
                                ? "bg-success"
                                : "bg-warning text-dark"
                            }`}
                          >
                            {isSent
                              ? "Sent"
                              : "Pending"}
                          </span>
                        </div>
                      </div>

                      <div className="pf-divider" />

                      {isGroupTab ? (
                        <div className="row g-3">
                          <div className="col-md-4">
                            <div className="pf-box">
                              <label className="form-label">
                                Group Rating
                              </label>

                              <div className="d-flex align-items-center gap-1 mt-2">
  {[1, 2, 3, 4, 5].map(
    (rating) => {
      const isSelected =
        rating <=
        Number(
          currentRow.group_rating || 0
        );

      return (
        <button
          key={rating}
          type="button"
          className="btn border-0 bg-transparent p-0 shadow-none"
          disabled={isSent}
          onClick={() =>
            handleFeedbackChange(
              "group_rating",
              String(rating)
            )
          }
          aria-label={`${rating} out of 5 stars`}
          title={`${rating} out of 5`}
          style={{
            lineHeight: 1,
            opacity: 1,
            cursor: isSent
              ? "default"
              : "pointer",
          }}
        >
          <Icon
            icon={
              isSelected
                ? "material-symbols:star-rounded"
                : "material-symbols:star-outline-rounded"
            }
            width="35"
            height="35"
            style={{
              color: isSelected
                ? "#fbbf24"
                : "#64748b",
            }}
          />
        </button>
      );
    }
  )}
</div>
                            </div>
                          </div>

                          <div className="col-md-8">
                            <div className="pf-box">
                              <label className="form-label">
                                Topic
                                Covered
                              </label>

                              <textarea
                                className="form-control"
                                rows="2"
                                value={
                                  currentRow.topic_covered
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleFeedbackChange(
                                    "topic_covered",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="Summarise the topic covered in this group session."
                                disabled={
                                  isSent
                                }
                              />
                            </div>
                          </div>

                          <div className="col-12">
                            <div className="pf-box">
                              <label className="form-label">
                                Performance
                                Comment
                              </label>

                              <textarea
                                className="form-control"
                                rows="3"
                                value={
                                  currentRow.performance_comment
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleFeedbackChange(
                                    "performance_comment",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="Provide a clear summary of the student's individual performance."
                                disabled={
                                  isSent
                                }
                              />
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div className="pf-box">
                              <label className="form-label">
                                Highlights
                              </label>

                              <textarea
                                className="form-control"
                                rows="3"
                                value={
                                  currentRow.highlights
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleFeedbackChange(
                                    "highlights",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="What did the student do particularly well?"
                                disabled={
                                  isSent
                                }
                              />
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div className="pf-box">
                              <label className="form-label">
                                Development
                                Areas
                              </label>

                              <textarea
                                className="form-control"
                                rows="3"
                                value={
                                  currentRow.development_areas
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleFeedbackChange(
                                    "development_areas",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="Identify the areas that need more attention."
                                disabled={
                                  isSent
                                }
                              />
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div className="pf-box">
                              <label className="form-label">
                                Suggested
                                Practice
                              </label>

                              <textarea
                                className="form-control"
                                rows="3"
                                value={
                                  currentRow.suggested_practice
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleFeedbackChange(
                                    "suggested_practice",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="Recommend focused practice before the next session."
                                disabled={
                                  isSent
                                }
                              />
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div className="pf-box">
                              <label className="form-label">
                                Looking
                                Ahead
                              </label>

                              <textarea
                                className="form-control"
                                rows="3"
                                value={
                                  currentRow.looking_ahead
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleFeedbackChange(
                                    "looking_ahead",
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="Explain what will be covered or improved next."
                                disabled={
                                  isSent
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="row g-3">
                          {ONE_TO_ONE_SELECT_FIELDS.map(
                            ({
                              field,
                              label,
                              className,
                            }) => (
                              <div
                                className={
                                  className
                                }
                                key={
                                  field
                                }
                              >
                                <div className="pf-box">
                                  <label className="form-label">
                                    {
                                      label
                                    }
                                  </label>

                                  <select
                                    className="form-select"
                                    value={
                                      currentRow[
                                        field
                                      ]
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      handleFeedbackChange(
                                        field,
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    disabled={
                                      isSent
                                    }
                                  >
                                    <option value="">
                                      Select
                                    </option>

                                    {ENUM_OPTIONS.map(
                                      (
                                        option
                                      ) => (
                                        <option
                                          key={
                                            option
                                          }
                                          value={
                                            option
                                          }
                                        >
                                          {
                                            option
                                          }
                                        </option>
                                      )
                                    )}
                                  </select>
                                </div>
                              </div>
                            )
                          )}

                          {ONE_TO_ONE_TEXT_FIELDS.map(
                            ({
                              field,
                              label,
                              placeholder,
                            }) => (
                              <div
                                className="col-12"
                                key={
                                  field
                                }
                              >
                                <div className="pf-box">
                                  <label className="form-label">
                                    {
                                      label
                                    }
                                  </label>

                                  <textarea
                                    className="form-control"
                                    rows="2"
                                    value={
                                      currentRow[
                                        field
                                      ]
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      handleFeedbackChange(
                                        field,
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    placeholder={
                                      placeholder
                                    }
                                    disabled={
                                      isSent
                                    }
                                  />
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={
                    closeFeedbackModal
                  }
                >
                  Close
                </button>

                <button
                  type="button"
                  className="btn btn-success"
                  onClick={
                    handleSaveFeedback
                  }
                  disabled={
                    savingFeedback ||
                    String(
                      currentRow.email_status ||
                        ""
                    ).toLowerCase() ===
                      "sent" ||
                    currentRow.isEmailSent
                  }
                >
                  {savingFeedback
                    ? "Saving..."
                    : "Save Report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackLayer;