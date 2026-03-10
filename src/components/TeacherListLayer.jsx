// src/layers/TeacherListLayer.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment";

import { getAllTeacherProfiles } from "../api/getAllTeacherProfiles";
import { updateTeacherStatus } from "../api/updateTeacherStatus";
import { hardDeleteUser } from "../api/hardDeleteUser";
import { getNationalities } from "../api/getNationalities"; // ✅ NEW (lookup list)

import TeacherDetailsModal from "../components/TeacherDetailsModal";
import BankDetailModal from "../components/BankDetailModal";

const FALLBACK_AVATAR =
  "https://gostudy.ae/assets/invalid-square.png";

const TeacherListLayer = () => {
  const [teachers, setTeachers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [compFilter, setCompFilter] = useState("all"); // all | complete | incomplete
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // ✅ NEW: Nationality + Subject filters
  const [nationalityFilter, setNationalityFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  // ✅ NEW: Nationalities lookup list (same as TeacherDetailsModal)
  const [nationalities, setNationalities] = useState([]);

  // ✅ NEW: Subjects modal
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [subjectsModalTeacher, setSubjectsModalTeacher] = useState(null);

  // ✅ Teacher Add/Edit modal state
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null); // null => Add mode
  const [seedTeacher, setSeedTeacher] = useState(null); // seed for Add mode

  // Bank + Preview
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const teachersPerPage = 15;

  // ---------- helpers ----------
  const isIncomplete = (t) => !t?.userid; // userid missing/null => incomplete
  const getJoinDate = (t) => t?.user_createddate || t?.createddate || "";

  const displayName = (t) => {
    const name = `${t?.firstname || ""} ${t?.lastname || ""}`.trim();
    return name || t?.fullname || "-";
  };

  const getEmail = (t) =>
    isIncomplete(t) ? t?.user_email || t?.email || "-" : t?.email || "-";

  const getPhone = (t) =>
    isIncomplete(t)
      ? t?.user_phonenumber || t?.phonenumber || "-"
      : t?.phonenumber || "-";

  // ✅ Subjects array helper (prefer teacherSubjects_array, else parse teacherSubjects string, else fallback)
  const getTeacherSubjectsArray = (t) => {
    if (Array.isArray(t?.teacherSubjects_array)) return t.teacherSubjects_array;

    if (typeof t?.teacherSubjects === "string" && t.teacherSubjects.trim()) {
      try {
        const parsed = JSON.parse(t.teacherSubjects);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // ignore
      }
    }

    if (t?.subjectid || t?.subjectname) {
      return [
        {
          subjectid: t?.subjectid ?? null,
          subjectname: t?.subjectname ?? null,
        },
      ];
    }

    return [];
  };

  // ✅ for SEARCH only (subject names)
  const getTeacherSubjectsText = (t) => {
    const arr = getTeacherSubjectsArray(t);
    if (arr?.length) {
      return arr
        .map((s) => s?.subjectname || (s?.subjectid ? `Subject #${s.subjectid}` : ""))
        .filter(Boolean)
        .join(", ");
    }
    return t?.subjectname || "";
  };

  // ✅ Nationality lookup (id -> name) using getNationalities list
  const getNationalityName = (t) => {
    // prefer API provided name
    if (t?.nationalityname) return String(t.nationalityname);

    const nid = t?.nationalityid;
    if (nid === null || nid === undefined || nid === "") return "";

    const found = (nationalities || []).find((n) => String(n?.id) === String(nid));
    if (found?.nationality) return String(found.nationality);

    // fallback
    if (String(nid) === "0") return "Unknown";
    return `Nationality #${nid}`;
  };

  // ✅ Unique stable key (pagination/filters safe)
  const getRowKey = (t) =>
    String(
      t?.uid ??
        t?.id ??
        t?.userid ??
        `${t?.email ?? t?.user_email ?? ""}-${t?.phonenumber ?? t?.user_phonenumber ?? ""}-${getJoinDate(t) ?? ""}`
    );

  // ✅ Add-mode seed userid: prefer userid, else uid/id
  const getSeedUserId = (t) => {
    const raw = t?.userid ?? t?.uid ?? t?.id ?? null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  // ✅ Subjects modal open/close
  const openSubjectsModal = (teacher) => {
    const subjects = getTeacherSubjectsArray(teacher);
    setSubjectsModalTeacher({
      teacherName: displayName(teacher),
      subjects: subjects || [],
    });
    setShowSubjectsModal(true);
  };

  const closeSubjectsModal = () => {
    setShowSubjectsModal(false);
    setSubjectsModalTeacher(null);
  };

  // ---------- mount fetch ----------
  useEffect(() => {
    fetchTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ NEW: load nationalities list (same pattern as TeacherDetailsModal)
  useEffect(() => {
    (async () => {
      try {
        const res = await getNationalities();
        // your modal uses: setNationalities(res || [])
        // keep compatible but safer:
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setNationalities(list || []);
      } catch (e) {
        console.error("getNationalities error:", e);
        setNationalities([]);
      }
    })();
  }, []);

  const fetchTeachers = async () => {
    const data = await getAllTeacherProfiles();

    // soft delete hidden (is_active === 2)
    const activeOrInactive = (data || []).filter((t) => t.is_active !== 2);

    const formatted = activeOrInactive.map((t) => ({
      ...t,
      fees: parseFloat(t.fees) || 0, // keep existing field (no UI usage now)
    }));

    setTeachers(
      formatted.sort((a, b) => new Date(getJoinDate(b)) - new Date(getJoinDate(a)))
    );
  };

  // ✅ Open modal (Student jaisa): incomplete => Add mode, complete => Edit mode
  const openTeacher = (t) => {
    const incomplete = isIncomplete(t);

    if (incomplete) {
      const seedId = getSeedUserId(t);

      setSeedTeacher({
        id: seedId,
        email: t?.user_email || t?.email || "",
        phonenumber: String(t?.user_phonenumber || t?.phonenumber || "").replace("-", ""),
        fullname: displayName(t),
      });

      setSelectedTeacherId(null); // Add mode
    } else {
      setSelectedTeacherId(Number(t.userid)); // Edit mode
      setSeedTeacher(null);
    }

    setShowTeacherModal(true);
  };

  const closeTeacherModal = () => {
    setShowTeacherModal(false);
    setSelectedTeacherId(null);
    setSeedTeacher(null);
  };

  // ✅ STATUS TOGGLE (pagination safe)
  const handleStatusToggle = async (teacher) => {
    if (!teacher?.userid) {
      Swal.fire("Error", "Incomplete teacher (userid missing). Status change nahi ho sakta.", "error");
      return;
    }

    const newStatus = teacher.is_active === 1 ? 0 : 1;

    const confirm = await Swal.fire({
      title: "Change Status?",
      text: `Are you sure you want to ${newStatus === 1 ? "activate" : "deactivate"} this teacher?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Change it!",
    });
    if (!confirm.isConfirmed) return;

    const result = await updateTeacherStatus(teacher.userid, newStatus);

    if (result?.statusCode === 200) {
      setTeachers((prev) =>
        prev.map((t) =>
          t.userid === teacher.userid ? { ...t, is_active: newStatus } : t
        )
      );
      Swal.fire("Success", "Status updated successfully", "success");
    } else {
      Swal.fire("Error", result?.message || "Status update failed.", "error");
    }
  };

  // ----- HARD delete -----
  const handleDeleteTeacher = async (teacher) => {
    const teacherId = teacher?.uid;

    if (teacherId === null || teacherId === undefined || teacherId === "") {
      console.log("Teacher object:", teacher);
      Swal.fire("Error", "Teacher ID missing.", "error");
      return;
    }

    const confirm = await Swal.fire({
      title: "Hard Delete Teacher?",
      text: `This will permanently delete ${displayName(teacher)}. Continue?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Hard Delete",
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({
      title: "Deleting...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const result = await hardDeleteUser(teacherId);

    if (result?.statusCode === 200) {
      const updated = teachers.filter((t) => t?.uid !== teacherId);
      setTeachers(updated);
      Swal.fire("Deleted!", "Teacher hard deleted successfully.", "success");
    } else {
      Swal.fire("Error", result?.message || "Hard delete failed.", "error");
    }
  };

  // ✅ Dropdown options (Nationality + Subject)
  const nationalityOptions = useMemo(() => {
    const map = new Map();

    // 1) from lookup list (best)
    (nationalities || []).forEach((n) => {
      if (n?.id == null) return;
      map.set(String(n.id), String(n.nationality || `Nationality #${n.id}`));
    });

    // 2) add any ids from teachers not found in lookup (fallback)
    (teachers || []).forEach((t) => {
      const id = t?.nationalityid;
      if (id === null || id === undefined || id === "") return;

      const key = String(id);
      if (map.has(key)) return;

      const label = t?.nationalityname || (String(id) === "0" ? "Unknown" : `Nationality #${id}`);
      map.set(key, label);
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [nationalities, teachers]);

  const subjectOptions = useMemo(() => {
    const map = new Map();

    (teachers || []).forEach((t) => {
      const arr = getTeacherSubjectsArray(t);
      (arr || []).forEach((s) => {
        const sid = s?.subjectid;
        if (sid === null || sid === undefined || sid === "") return;

        const key = String(sid);
        const name = s?.subjectname || `Subject #${sid}`;
        if (!map.has(key)) map.set(key, name);
      });
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teachers]);

  // ----- filters -----
  const filteredTeachers = teachers.filter((teacher) => {
    if (compFilter === "complete" && isIncomplete(teacher)) return false;
    if (compFilter === "incomplete" && !isIncomplete(teacher)) return false;

    const matchesStatus =
      statusFilter === "" ||
      (teacher.is_active === 1 ? "Active" : "Inactive") === statusFilter;

    // ✅ FIX: search now includes nationality + subjects text
    const fullText = `${displayName(teacher)} ${getEmail(teacher)} ${getPhone(teacher)} ${getNationalityName(teacher)} ${getTeacherSubjectsText(teacher)}`.toLowerCase();
    const matchesSearch = fullText.includes((searchTerm || "").toLowerCase());

    const jd = getJoinDate(teacher);
    const joinDate = jd ? new Date(jd) : null;
    const afterStart = startDate ? joinDate && joinDate >= new Date(startDate) : true;
    const beforeEnd = endDate ? joinDate && joinDate <= new Date(endDate) : true;

    // ✅ nationality + subject filters
    const matchesNationality =
      nationalityFilter === "" ||
      String(teacher?.nationalityid ?? "") === String(nationalityFilter);

    const matchesSubject =
      subjectFilter === "" ||
      getTeacherSubjectsArray(teacher).some(
        (s) => String(s?.subjectid ?? "") === String(subjectFilter)
      );

    return (
      matchesSearch &&
      matchesStatus &&
      afterStart &&
      beforeEnd &&
      matchesNationality &&
      matchesSubject
    );
  });

  // ----- paging -----
  const indexOfLastTeacher = currentPage * teachersPerPage;
  const indexOfFirstTeacher = indexOfLastTeacher - teachersPerPage;
  const currentTeachers = filteredTeachers.slice(indexOfFirstTeacher, indexOfLastTeacher);
  const totalPages = Math.ceil(filteredTeachers.length / teachersPerPage) || 1;

  const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);

  // ----- exports ----- (unchanged behavior)
  const exportToExcel = () => {
    const heading = [["Teacher List"]];
    const data = filteredTeachers.map((t, i) => ({
      "S.L": i + 1,
      "Join Date": getJoinDate(t) ? moment(getJoinDate(t)).format("DD MMM YYYY") : "-",
      "Teacher Name": displayName(t),
      Email: getEmail(t),
      "Phone Number": getPhone(t),
      Country: t.country || "-",
      Subject: t.subjectname || "-",
      Profile: isIncomplete(t) ? "Incomplete" : "Complete",
      Status: t.is_active === 1 ? "Active" : "Inactive",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data, { origin: -1 });
    XLSX.utils.sheet_add_aoa(worksheet, heading, { origin: "A1" });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Teachers");
    XLSX.writeFile(workbook, "teachers.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Teacher List", 14, 20);

    const tableColumn = [
      "S.L",
      "Join Date",
      "Teacher Name",
      "Email",
      "Phone",
      "Country",
      "Subject",
      "Profile",
      "Status",
    ];

    const tableRows = filteredTeachers.map((t, i) => [
      i + 1,
      getJoinDate(t) ? moment(getJoinDate(t)).format("DD MMM YYYY") : "-",
      displayName(t),
      getEmail(t),
      getPhone(t),
      t.country || "-",
      t.subjectname || "-",
      isIncomplete(t) ? "Incomplete" : "Complete",
      t.is_active === 1 ? "Active" : "Inactive",
    ]);

    autoTable(doc, { startY: 25, head: [tableColumn], body: tableRows });
    doc.save("teachers.pdf");
  };

  if (!teachers || teachers.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "300px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "6px solid #e0e0e0",
            borderTop: "6px solid #45B369",
            borderRadius: "50%",
            animation: "spin 1s ease-in-out infinite",
          }}
        />
        <style>{`@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div className="card h-100 p-0 radius-12">
      <style>{`
        .avatar-ring-danger {
          box-shadow: 0 0 0 2px #ffffff, 0 0 0 5px #dc3545;
        }
      `}</style>

      {/* Header */}
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between">
        <div className="d-flex align-items-center flex-wrap gap-3">
          <input
            type="text"
            className="form-control w-auto"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          <input
            type="date"
            className="form-control w-auto"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
          />
          <input
            type="date"
            className="form-control w-auto"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
          />

          {/* Profile filter */}
          <select
            className="form-select form-select-sm w-auto"
            value={compFilter}
            onChange={(e) => {
              setCompFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Profile: All</option>
            <option value="complete">Completed Profiles</option>
            <option value="incomplete">Incomplete Profiles</option>
          </select>

          {/* Status filter */}
          <select
            className="form-select form-select-sm w-auto"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Status:All</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          {/* ✅ Nationality filter (lookup list) */}
          <select
            className="form-select form-select-sm w-auto"
            value={nationalityFilter}
            onChange={(e) => {
              setNationalityFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Nationality: All</option>
            {nationalityOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>

          {/* ✅ Subject filter */}
          <select
            className="form-select form-select-sm w-auto"
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Subject: All</option>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("");
              setCompFilter("all");
              setStartDate("");
              setEndDate("");
              setNationalityFilter("");
              setSubjectFilter("");
              setCurrentPage(1);
            }}
            className="btn btn-outline-secondary btn-sm"
          >
            Reset Filters
          </button>

          <button onClick={exportToExcel} className="btn btn-success btn-sm">
            Excel Export
          </button>
          <button onClick={exportToPDF} className="btn btn-danger btn-sm">
            PDF Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card-body p-24">
        <div className="table-responsive" style={{ maxHeight: "calc(100vh - 360px)" }}>
          <table className="table bordered-table sm-table mb-0" style={{ borderCollapse: "separate" }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "#f8f9fa", zIndex: 5 }}>
                <th>S.L</th>
                <th>Join Date</th>
                <th>Teacher Name</th>
                <th>Email</th>
                <th>Phone Number</th>
                <th>Passport ID</th>
                <th>Driving License</th>
                <th>Subject</th>
                <th>Bank Detail</th>
                <th className="text-center">Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>

            <tbody>
              {currentTeachers.map((teacher, index) => {
                const incomplete = isIncomplete(teacher);
                const imgSrc = teacher.imagepath?.startsWith("http") ? teacher.imagepath : FALLBACK_AVATAR;
                const rowKey = getRowKey(teacher);

                const subjectsArr = getTeacherSubjectsArray(teacher);

                return (
                  <tr key={rowKey}>
                    <td>{indexOfFirstTeacher + index + 1}</td>
                    <td>{getJoinDate(teacher) ? moment(getJoinDate(teacher)).format("DD MMM YYYY") : "-"}</td>

                    <td>
                      <div className="d-flex align-items-center">
                        <img
                          src={imgSrc}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = FALLBACK_AVATAR;
                          }}
                          alt="User"
                          className={`w-40-px h-40-px rounded-circle me-12 ${incomplete ? "avatar-ring-danger" : ""}`}
                          style={{ objectFit: "cover" }}
                        />
                        <span>{displayName(teacher)}</span>
                      </div>
                    </td>

                    <td>{getEmail(teacher)}</td>
                    <td>{getPhone(teacher)}</td>

                    <td className="text-center">
                      {teacher.passportid ? (
                        <button className="btn btn-outline-info btn-sm" onClick={() => setPreviewUrl(teacher.passportid)}>
                          <Icon icon="majesticons:eye-line" />
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="text-center">
                      {teacher.drivinglicense ? (
                        <button className="btn btn-outline-info btn-sm" onClick={() => setPreviewUrl(teacher.drivinglicense)}>
                          <Icon icon="majesticons:eye-line" />
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>

                    {/* ✅ Subject eye (opens subjects array) */}
                    <td className="text-center">
                      {subjectsArr?.length ? (
                        <button
                          className="btn btn-outline-info btn-sm"
                          onClick={() => openSubjectsModal(teacher)}
                          title="View Subjects"
                        >
                          <Icon icon="majesticons:eye-line" />
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>

                    {/* Bank Detail */}
                    <td className="text-center">
                      <button
                        className="btn btn-info btn-sm"
                        onClick={() => {
                          if (!teacher?.userid) {
                            Swal.fire("Error", "Incomplete teacher (userid missing).", "error");
                            return;
                          }
                          setSelectedTeacher({
                            userid: teacher.userid,
                            firstname: teacher.firstname,
                            lastname: teacher.lastname,
                            payment_info: teacher.payment_info,
                          });
                          setShowBankModal(true);
                        }}
                      >
                        <Icon icon="majesticons:eye-line" />
                      </button>
                    </td>

                    {/* Status */}
                    <td className="text-center">
                      <button
                        className={`btn btn-sm ${teacher.is_active === 1 ? "btn-outline-danger" : "btn-outline-success"}`}
                        onClick={() => handleStatusToggle(teacher)}
                        disabled={!teacher?.userid}
                        title={!teacher?.userid ? "Incomplete teacher (userid missing) - status change disabled" : ""}
                      >
                        {teacher.is_active === 1 ? "Deactivate" : "Activate"}
                      </button>
                    </td>

                    {/* Action */}
                    <td className="text-center">
                      <div className="d-flex justify-content-center gap-2">
                        <button
                          className={`btn btn-sm ${incomplete ? "btn-outline-danger" : "btn-primary"}`}
                          onClick={() => openTeacher(teacher)}
                          title={incomplete ? "Add Details" : "View / Edit"}
                        >
                          <Icon icon="majesticons:eye-line" />
                        </button>

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteTeacher(teacher)}
                          title="Hard Delete"
                        >
                          <Icon icon="fluent:delete-24-regular" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="d-flex justify-content-between mt-3">
          <span>
            Showing {filteredTeachers.length === 0 ? 0 : indexOfFirstTeacher + 1} to{" "}
            {Math.min(indexOfLastTeacher, filteredTeachers.length)} of {filteredTeachers.length} entries
          </span>

          <ul className="pagination">
            {Array.from({ length: totalPages }).map((_, i) => (
              <li key={i} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                <button onClick={() => handlePageChange(i + 1)} className="page-link">
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Teacher Add/Edit Modal */}
      {showTeacherModal && (
        <TeacherDetailsModal
          show={showTeacherModal}
          onClose={closeTeacherModal}
          userid={selectedTeacherId}
          seed={seedTeacher}
          onSave={() => fetchTeachers()}
        />
      )}

      {showBankModal && selectedTeacher && (
        <BankDetailModal
          teacherId={selectedTeacher.userid}
          teacherName={`${selectedTeacher.firstname || ""} ${selectedTeacher.lastname || ""}`.trim()}
          paymentInfo={selectedTeacher.payment_info}
          onClose={() => setShowBankModal(false)}
          onSaved={() => fetchTeachers()}
        />
      )}

      {/* ✅ Subjects Modal */}
      {showSubjectsModal && subjectsModalTeacher && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Subjects{subjectsModalTeacher?.teacherName ? ` - ${subjectsModalTeacher.teacherName}` : ""}
                </h5>
                <button type="button" className="btn-close" onClick={closeSubjectsModal}></button>
              </div>

              <div className="modal-body">
                {subjectsModalTeacher?.subjects?.length ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: "80px" }}>S.L</th>
                          <th>Subject</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjectsModalTeacher.subjects.map((s, idx) => (
                          <tr key={`${s?.subjectid ?? idx}`}>
                            <td>{idx + 1}</td>
                            <td>{s?.subjectname || (s?.subjectid ? `Subject #${s.subjectid}` : "-")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted">No subjects found.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {previewUrl && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Document Preview</h5>
                <button type="button" className="btn-close" onClick={() => setPreviewUrl(null)}></button>
              </div>

              <div className="modal-body text-center">
                {String(previewUrl).toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                    title="PDF Preview"
                    width="100%"
                    height="600px"
                    frameBorder="0"
                  />
                ) : (
                  <img src={previewUrl} alt="Preview" style={{ maxWidth: "100%", maxHeight: "600px" }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherListLayer;
