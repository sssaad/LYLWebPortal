import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Swal from "sweetalert2";
import { getAllTeacherProfiles } from "../api/getAllTeacherProfiles";
import { addTeacherFee } from "../api/addTeacherFee";
import { updateTeacherFee } from "../api/updateTeacherFee";

const FeeLayer = () => {
  const [teachers, setTeachers] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [newFee, setNewFee] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const perPage = 10;

  useEffect(() => {
    const fetchTeachers = async () => {
      const data = await getAllTeacherProfiles();
      const formatted = data.map((t) => {
        const fullname = `${t.firstname} ${t.lastname}`;
        localStorage.setItem(fullname, t.userid);
        return {
          teacherid: t.userid,
          fullname,
          fee: parseInt(t.fees) || 0,
        };
      });
      setTeachers(formatted);
      setInitialLoading(false);
    };

    fetchTeachers();
  }, []);

  const handleEdit = (index, currentFee) => {
    setEditIndex(index);
    setNewFee(currentFee);
  };

  const handleSave = async (index) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You are about to save this fee value.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#aaa",
      confirmButtonText: "Yes, Save it!",
    });

    if (!result.isConfirmed) return;

    const updated = [...teachers];
    const teacher = updated[index];
    const newFeeValue = parseInt(newFee) || 0;
    const isNew = teacher.fee === 0;

    updated[index].fee = newFeeValue;
    setTeachers(updated);
    setEditIndex(null);
    setNewFee("");

    if (isNew) {
      await addTeacherFee({ teacherid: teacher.teacherid, fees: newFeeValue });
    } else {
      await updateTeacherFee(teacher.teacherid, newFeeValue);
    }

    Swal.fire("Saved!", "Fee has been saved successfully.", "success");
  };

  const exportToExcel = () => {
    const data = teachers.map((t, i) => ({
      "S.L": i + 1,
      "Teacher Name": t.fullname,
      Fee: t.fee,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TeacherFees");
    XLSX.writeFile(wb, "teacher_fees.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Teacher Fee List", 14, 20);
    const columns = ["S.L", "Teacher Name", "Fee"];
    const rows = teachers.map((t, i) => [i + 1, t.fullname, t.fee]);

    autoTable(doc, {
      startY: 25,
      head: [columns],
      body: rows,
    });

    doc.save("teacher_fees.pdf");
  };

  const filtered = teachers.filter((t) =>
    t.fullname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginated = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  const totalPages = Math.ceil(filtered.length / perPage);

  if (initialLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '6px solid #e0e0e0',
          borderTop: '6px solid #45B369',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="card h-100 p-0 radius-12">
      <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between">
        <div className="d-flex align-items-center flex-wrap gap-3">
          <input
            type="text"
            className="form-control w-auto"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={exportToExcel} className="btn btn-success btn-sm">Excel Export</button>
          <button onClick={exportToPDF} className="btn btn-danger btn-sm">PDF Export</button>
        </div>
      </div>

      <div className="card-body p-24">
        <div className="table-responsive scroll-sm">
          <table className="table bordered-table sm-table mb-0">
            <thead>
              <tr>
                <th>S.L</th>
                <th className="text-center">Teacher Name</th>
                <th className="text-center">Fee ($)</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((t, i) => (
                <tr key={t.teacherid}>
                  <td>{(currentPage - 1) * perPage + i + 1}</td>
                  <td className="text-center">{t.fullname}</td>
                  <td className="text-center">
                    {editIndex === i ? (
                      <input
                        type="number"
                        className="form-control text-center"
                        value={newFee}
                        onChange={(e) => setNewFee(e.target.value)}
                      />
                    ) : (
                      `$ ${t.fee}`
                    )}
                  </td>
                  <td className="text-center">
                    {editIndex === i ? (
                      <button
                        className="btn btn-success btn-sm px-3"
                        onClick={() => handleSave(i)}
                      >
                        Save
                      </button>
                    ) : (
                      <button
                        className="btn btn-outline-primary btn-sm px-3"
                        onClick={() => handleEdit(i, t.fee)}
                      >
                        {t.fee === 0 ? "Add Fee" : "Edit"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-3">
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="d-flex justify-content-between mt-3">
          <span>
            Showing {(currentPage - 1) * perPage + 1} to {Math.min(currentPage * perPage, filtered.length)} of {filtered.length} entries
          </span>
          <ul className="pagination">
            {[...Array(totalPages)].map((_, i) => (
              <li key={i} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                <button
                  onClick={() => setCurrentPage(i + 1)}
                  className="page-link"
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FeeLayer;