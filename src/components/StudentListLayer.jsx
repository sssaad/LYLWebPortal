// src/components/StudentListLayer.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import Swal from "sweetalert2";

import { getAllStudents } from "../api/getAllStudents";
import { getNationalities } from "../api/getNationalities"; // ✅ NEW (lookup list)

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import moment from "moment";
import StudentDetailsModal from "../components/StudentDetailsModal";

// ✅ HARD DELETE API (same as teacher wala)
import { hardDeleteUser } from "../api/hardDeleteUser";

const FALLBACK_AVATAR =
  "https://lylassets.s3.eu-north-1.amazonaws.com/uploads/person-dummy-02.jpg";

const StudentListLayer = () => {
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null); // null => Add mode
  const [seedRow, setSeedRow] = useState(null); // seed for Add mode

  // Profile filter dropdown: all | complete | incomplete
  const [compFilter, setCompFilter] = useState("all");

  // ✅ NEW: Nationality filter (lookup) + Year(1-13) filter
  const [nationalities, setNationalities] = useState([]);
  const [nationalityFilter, setNationalityFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const studentsPerPage = 15;

  // ------- helpers -------
  const getUD = (s) => s?.userdetails ?? {};

  // ✅ For EDIT/VIEW we use userid if exists, otherwise fallback to id
  const getUID = (s) => {
    const ud = getUD(s);
    return ud.userid ?? (s?.id ? Number(s.id) : null);
  };

  // ✅ Hard delete ID: response me top-level "id" hai (string), wahi use karo
  const getHardDeleteId = (s) => {
    const raw = s?.id ?? getUD(s)?.userid ?? null;
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  };

  // ✅ Stable row key (pagination safe)
  const getRowKey = (s) =>
    String(
      s?.id ??
        getUD(s)?.userid ??
        `${s?.email ?? ""}-${s?.phonenumber ?? ""}-${s?.createddate ?? ""}`
    );

  const getFirstName = (s) => getUD(s).firstname ?? s.firstname ?? "";
  const getLastName = (s) => getUD(s).lastname ?? s.lastname ?? "";
  const getEmail = (s) => s.email ?? getUD(s).email ?? "";
  const getUsername = (s) => s?.username ?? getUD(s)?.username ?? "";
  const getStudentEmailOrUsername = (s) => {
    const u = String(getUsername(s) || "").trim();
    if (u) return u;
    const e = String(getEmail(s) || "").trim();
    return e || "-";
  };

  const getParentEmail = (s) => getUD(s).parentemail ?? s.parentemail ?? "";
  const getPhone = (s) => (getUD(s).phonenumber ?? s.phonenumber ?? "") || "-";
  const getAddress = (s) => {
    const ud = getUD(s);
    const street = ud.street ?? s.street ?? "";
    const area = ud.area ?? s.area ?? "";
    const city = ud.city ?? s.city ?? "";
    const postcode = ud.postcode ?? s.postcode ?? "";
    return `${street ? street + ", " : ""}${area ? area + ", " : ""}${
      city ? city + " " : ""
    }${postcode}`.replace(/, ,/g, ",").replace(/,\s*$/, "");
  };
  const getCountry = (s) => getUD(s).country ?? s.country ?? "-";
  const getCreated = (s) => s.createddate ?? getUD(s).createddate ?? "";
  const getImage = (s) => {
    const p = getUD(s).imagepath ?? s.imagepath ?? "";
    if (!p || String(p).trim() === "") return FALLBACK_AVATAR;
    return p;
  };

  // ✅ incomplete = userdetails.id missing/null
  const isIncomplete = (s) => !(getUD(s)?.id);

  // ✅ Nationality helpers (lookup like TeacherListLayer)
  const getNationalityId = (s) => getUD(s)?.nationalityid ?? s?.nationalityid ?? null;

  const getNationalityName = (s) => {
    const ud = getUD(s);

    // prefer response-provided name
    if (ud?.nationalityname) return String(ud.nationalityname);
    if (s?.nationalityname) return String(s.nationalityname);

    const nid = getNationalityId(s);
    if (nid === null || nid === undefined || nid === "") return "";

    const found = (nationalities || []).find((n) => String(n?.id) === String(nid));
    if (found?.nationality) return String(found.nationality);

    if (String(nid) === "0") return "Unknown";
    return `Nationality #${nid}`;
  };

  // ✅ Year(1-13) from educationdetails.degree (supports "9" or "Year 7")
  const getStudentYear = (s) => {
    const arr = Array.isArray(s?.educationdetails) ? s.educationdetails : [];
    const first = arr.find((e) => e && String(e.deleted ?? "0") !== "1") || arr[0];
    const raw = first?.degree ?? "";

    if (raw === null || raw === undefined) return null;

    const str = String(raw).trim();
    if (!str) return null;

    // extract digits from "Year 7" etc.
    const m = str.match(/(\d{1,2})/);
    if (!m) return null;

    const n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    if (n < 1 || n > 13) return null;

    return n; // 1..13
  };

  // ------- fetch & init -------
  useEffect(() => {
    const fetchStudents = async () => {
      const data = await getAllStudents();
      const list = data?.getallstudentlist ?? data ?? [];

      // ✅ keep only not-soft-deleted (active !== "2")
      const filtered = (list || []).filter((student) => student.active !== "2");

      filtered.sort(
        (a, b) =>
          new Date(getCreated(b)).getTime() - new Date(getCreated(a)).getTime()
      );

      setStudents(filtered);
    };
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ NEW: load nationalities lookup list
  useEffect(() => {
    (async () => {
      try {
        const res = await getNationalities();
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setNationalities(list || []);
      } catch (e) {
        console.error("getNationalities error:", e);
        setNationalities([]);
      }
    })();
  }, []);

  // ✅ Nationality dropdown options (lookup list + fallback from students)
  const nationalityOptions = useMemo(() => {
    const map = new Map();

    // 1) from lookup list
    (nationalities || []).forEach((n) => {
      if (n?.id == null) return;
      map.set(String(n.id), String(n.nationality || `Nationality #${n.id}`));
    });

    // 2) fallback from students (if lookup missing)
    (students || []).forEach((s) => {
      const id = getNationalityId(s);
      if (id === null || id === undefined || id === "") return;

      const key = String(id);
      if (map.has(key)) return;

      const label =
        getUD(s)?.nationalityname ||
        s?.nationalityname ||
        (String(id) === "0" ? "Unknown" : `Nationality #${id}`);
      map.set(key, String(label));
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [nationalities, students]);

  // ------- HARD delete (pagination safe, object pass) -------
  const handleHardDelete = async (student) => {
    const hardId = getHardDeleteId(student);

    const name =
      `${getFirstName(student)} ${getLastName(student)}`.trim() ||
      student.fullname ||
      "this student";

    if (!hardId) {
      console.log("Student object:", student);
      Swal.fire("Error", "Student ID missing.", "error");
      return;
    }

    const confirm = await Swal.fire({
      title: "Hard Delete Student?",
      text: `This will permanently delete ${name}. Continue?`,
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

    // ✅ call hard delete API with student "id"
    const result = await hardDeleteUser(hardId);

    if (result?.statusCode === 200) {
      // ✅ remove by id (hard delete id)
      setStudents((prev) => prev.filter((s) => getHardDeleteId(s) !== hardId));
      Swal.fire("Deleted!", "Student hard deleted successfully.", "success");
    } else {
      Swal.fire("Error", result?.message || "Hard delete failed.", "error");
    }
  };

  // ------- filter (search + date + profile + nationality + year) -------
  const filteredStudents = students.filter((student) => {
    const incomplete = isIncomplete(student);
    if (compFilter === "complete" && incomplete) return false;
    if (compFilter === "incomplete" && !incomplete) return false;

    const fullName = `${getFirstName(student)} ${getLastName(student)}`
      .trim()
      .toLowerCase();

    const address = getAddress(student).toLowerCase();

    // ✅ search includes username/email + parentemail + nationality + year
    const yearVal = getStudentYear(student);
    const fullText =
      `${fullName} ${getEmail(student)} ${getUsername(student)} ${getParentEmail(student) || ""} ${address} ${getNationalityName(student)} ${yearVal ? `year ${yearVal}` : ""}`.toLowerCase();

    const matchesSearch = fullText.includes((searchTerm || "").toLowerCase());

    const cdate = new Date(getCreated(student));
    const afterStart = startDate ? cdate >= new Date(startDate) : true;
    const beforeEnd = endDate ? cdate <= new Date(endDate) : true;

    // ✅ nationality filter
    const matchesNationality =
      nationalityFilter === "" ||
      String(getNationalityId(student) ?? "") === String(nationalityFilter);

    // ✅ year filter (1..13)
    const matchesYear =
      yearFilter === "" || String(getStudentYear(student) ?? "") === String(yearFilter);

    return matchesSearch && afterStart && beforeEnd && matchesNationality && matchesYear;
  });

  // ------- paging -------
  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  const currentStudents = filteredStudents.slice(
    indexOfFirstStudent,
    indexOfLastStudent
  );
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage) || 1;

  // ------- export: Excel -------
  const exportToExcel = () => {
    const heading = [["Student List"]];
    const data = filteredStudents.map((s, i) => ({
      "S.L": i + 1,
      "Join Date": getCreated(s)
        ? moment(getCreated(s)).format("DD MMM YYYY")
        : "-",
      Name: `${getFirstName(s)} ${getLastName(s)}`.trim() || s.fullname || "-",
      "Student Email/Username": getStudentEmailOrUsername(s),
      "Parent Email": getParentEmail(s) || "-",
      "Phone Number": getPhone(s),
      Address: getAddress(s) || "-",
      Country: getCountry(s) || "-",
      Status: isIncomplete(s) ? "Incomplete" : "Complete",
    }));
    const ws = XLSX.utils.json_to_sheet(data, { origin: -1 });
    XLSX.utils.sheet_add_aoa(ws, heading, { origin: "A1" });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `students_${moment().format("YYYY-MM-DD_HHmm")}.xlsx`);
  };

  // ------- export: PDF -------
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Student List", 14, 18);

    const head = [[
      "S.L","Join Date","Name","Student Email/Username","Parent Email",
      "Phone","Address","Country","Status"
    ]];

    const body = filteredStudents.map((s, i) => ([
      i + 1,
      getCreated(s) ? moment(getCreated(s)).format("DD MMM YYYY") : "-",
      `${getFirstName(s)} ${getLastName(s)}`.trim() || s.fullname || "-",
      getStudentEmailOrUsername(s),
      getParentEmail(s) || "-",
      getPhone(s),
      getAddress(s) || "-",
      getCountry(s) || "-",
      isIncomplete(s) ? "Incomplete" : "Complete",
    ]));

    autoTable(doc, {
      startY: 24,
      head,
      body,
      styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [69, 179, 105] },
      columnStyles: { 2: { cellWidth: 32 }, 3: { cellWidth: 38 }, 6: { cellWidth: 50 } },
    });

    doc.save(`students_${moment().format("YYYY-MM-DD_HHmm")}.pdf`);
  };

  const openStudent = (row) => {
    const incomplete = isIncomplete(row);
    const uid = getUID(row);

    if (incomplete) {
      const fullname =
        `${getFirstName(row)} ${getLastName(row)}`.trim() || row.fullname || "";
      setSeedRow({
        id: uid,
        email: getEmail(row) || "",
        parentemail: getParentEmail(row) || "",
        phonenumber: getPhone(row).replace("-", ""),
        fullname,
      });
      setSelectedStudentId(null);
    } else {
      setSelectedStudentId(uid);
      setSeedRow(null);
    }
    setShowStudentModal(true);
  };

  if (!students || students.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "300px" }}>
        <div style={{ width: 48, height: 48, border: "6px solid #e0e0e0", borderTop: "6px solid #45B369", borderRadius: "50%", animation: "spin 1s ease-in-out infinite" }} />
        <style>{`@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div className="card h-100 p-0 radius-12">
      <style>{`
        .avatar-ring-danger { box-shadow: 0 0 0 2px #ffe3e6, 0 0 0 4px #dc3545; }
      `}</style>

      {/* Header */}
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between">
        <div className="d-flex align-items-center flex-wrap gap-3">
          <input
            type="text"
            className="form-control w-auto"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />

          <input
            type="date"
            className="form-control w-auto"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
          />
          <input
            type="date"
            className="form-control w-auto"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
          />

          <select
            className="form-select w-auto"
            value={compFilter}
            onChange={(e) => { setCompFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">Profile: All</option>
            <option value="complete">Completed Profiles</option>
            <option value="incomplete">Incomplete Profiles</option>
          </select>

          {/* ✅ Nationality filter */}
          <select
            className="form-select w-auto"
            value={nationalityFilter}
            onChange={(e) => { setNationalityFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Nationality: All</option>
            {nationalityOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>

          {/* ✅ Year filter (1..13) */}
          <select
            className="form-select w-auto"
            value={yearFilter}
            onChange={(e) => { setYearFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Year: All</option>
            {Array.from({ length: 13 }).map((_, i) => {
              const v = String(i + 1);
              return (
                <option key={v} value={v}>
                  Year {v}
                </option>
              );
            })}
          </select>

          <button
            onClick={() => {
              setSearchTerm("");
              setStartDate("");
              setEndDate("");
              setCompFilter("all");
              setNationalityFilter("");
              setYearFilter("");
              setCurrentPage(1);
            }}
            className="btn btn-outline-secondary btn-sm"
          >
            Reset
          </button>

          <button onClick={exportToExcel} className="btn btn-success btn-sm">Excel Export</button>
          <button onClick={exportToPDF} className="btn btn-danger btn-sm">PDF Export</button>
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
                <th>Student Name</th>
                <th>Student Email/Username</th>
                <th>Parent Email</th>
                <th>Phone Number</th>
                <th>Address</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>

            <tbody>
              {currentStudents.map((s, idx) => {
                const incomplete = isIncomplete(s);
                const name =
                  `${getFirstName(s)} ${getLastName(s)}`.trim() || s.fullname || "-";
                const img = getImage(s);
                const created = getCreated(s);

                return (
                  <tr key={getRowKey(s)}>
                    <td>{indexOfFirstStudent + idx + 1}</td>
                    <td>{created ? moment(created).format("DD MMM YYYY") : "-"}</td>

                    <td>
                      <div className="d-flex align-items-center">
                        <img
                          src={img}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = FALLBACK_AVATAR;
                          }}
                          alt="User"
                          className={`w-40-px h-40-px rounded-circle me-12 ${incomplete ? "avatar-ring-danger" : ""}`}
                          style={{ objectFit: "cover" }}
                        />
                        <span>{name}</span>
                      </div>
                    </td>

                    {/* ✅ Username priority, else email */}
                    <td>{getStudentEmailOrUsername(s)}</td>
                    <td>{getParentEmail(s) || "-"}</td>
                    <td>{getPhone(s)}</td>
                    <td>{getAddress(s) || "-"}</td>

                    <td className="text-center">
                      <div className="d-flex justify-content-center gap-2">
                        <button
                          className={`btn btn-sm ${incomplete ? "btn-outline-danger" : "btn-primary"}`}
                          onClick={() => openStudent(s)}
                          title={incomplete ? "Add Details" : "View / Edit"}
                        >
                          <Icon icon="majesticons:eye-line" />
                        </button>

                        {/* ✅ HARD DELETE (pagination safe) */}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleHardDelete(s)}
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
            Showing {filteredStudents.length === 0 ? 0 : indexOfFirstStudent + 1} to{" "}
            {Math.min(indexOfLastStudent, filteredStudents.length)} of {filteredStudents.length} entries
          </span>
          <ul className="pagination">
            {Array.from({ length: totalPages }).map((_, i) => (
              <li key={i} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                <button onClick={() => setCurrentPage(i + 1)} className="page-link">
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Modal */}
      {showStudentModal && (
        <StudentDetailsModal
          show={showStudentModal}
          onClose={() => { setShowStudentModal(false); setSelectedStudentId(null); setSeedRow(null); }}
          userid={selectedStudentId}   // null => Add mode
          seed={seedRow}               // { id, email, parentemail, phonenumber, fullname }
          onSave={() => {}}
        />
      )}
    </div>
  );
};

export default StudentListLayer;
