import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { getSubjectCategories } from '../api/getSubjectCategories';
import { getSubjects } from '../api/getSubjects';
import { addCategory } from '../api/addCategory';
import { addSubject } from '../api/addSubject';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import AddSubjectModal from './AddSubjectModal';
import AddCategoryModal from './AddCategoryModal';

const CoursesLayer = () => {
  const [subjectCategories, setSubjectCategories] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const [newSubject, setNewSubject] = useState('');
  const [newSubjectCategory, setNewSubjectCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      const categories = await getSubjectCategories();
      const allSubjects = await getSubjects();
      setSubjectCategories(categories);
      setSubjects(allSubjects);
      if (categories.length > 0) setSelectedCategoryId(categories[0].id);
      setInitialLoading(false);
    };
    fetchData();
  }, []);

  const filteredCategories = subjectCategories.filter(cat =>
    cat.categoryname?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredCategories.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);

  const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);

  const exportToExcel = () => {
  let data = [];

  filteredCategories.forEach((cat, i) => {
    data.push({
      "S.L": i + 1,
      "Category": cat.categoryname,
      "Subject": "", // Leave subject blank for category row
    });

    const subjectsInCategory = getSubjectsByCategory(cat.id);
    subjectsInCategory.forEach((sub, j) => {
      data.push({
        "S.L": `${i + 1}.${j + 1}`,
        "Category": "", // Leave category blank for subject row
        "Subject": sub.subjectname,
      });
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Subject Categories with Subjects");
  XLSX.writeFile(workbook, "subject_categories_with_subjects.xlsx");
};


 const exportToPDF = () => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Subject Categories with Subjects", 14, 20);

  const tableColumn = ["S.L", "Category", "Subject"];
  const tableRows = [];

  filteredCategories.forEach((cat, i) => {
    tableRows.push([i + 1, cat.categoryname, ""]);

    const subjectsInCategory = getSubjectsByCategory(cat.id);
    subjectsInCategory.forEach((sub, j) => {
      tableRows.push([`${i + 1}.${j + 1}`, "", sub.subjectname]);
    });
  });

  autoTable(doc, {
    startY: 25,
    head: [tableColumn],
    body: tableRows,
  });

  doc.save("subject_categories_with_subjects.pdf");
};


  const getSubjectsByCategory = (categoryId) =>
    subjects.filter(sub => sub.subjectcategory_id === categoryId);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setLoading(true);
    const response = await addCategory(newCategory);
    if (response.success) {
      const updatedCategories = await getSubjectCategories();
      setSubjectCategories(updatedCategories);
      setNewCategory('');
      Swal.fire("✅ Success", "Category added successfully!", "success");
    } else {
      Swal.fire("❌ Error", response.message || "Failed to add category.", "error");
    }
    setLoading(false);
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    setLoading(true);
    const categoryId = parseInt(newSubjectCategory);
    const response = await addSubject(newSubject, categoryId);
    if (response.success) {
      const updatedSubjects = await getSubjects();
      setSubjects(updatedSubjects);
      setNewSubject('');
      setNewSubjectCategory('');
      Swal.fire("✅ Success", "Subject added successfully!", "success");
    } else {
      Swal.fire("❌ Error", response.message || "Failed to add subject.", "error");
    }
    setLoading(false);
  };

  if (initialLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            border: '6px solid #e0e0e0',
            borderTop: '6px solid #45B369',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
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
    <>
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
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm d-flex align-items-center gap-2"
              data-bs-toggle="modal"
              data-bs-target="#addCategoryModal"
            >
              <Icon icon="ic:baseline-plus" className="icon text-xl" />
              Add Category
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm d-flex align-items-center gap-2"
              data-bs-toggle="modal"
              data-bs-target="#addCourseModal"
            >
              <Icon icon="ic:baseline-plus" className="icon text-xl" />
              Add Subject
            </button>
          </div>
        </div>

        <div className="card-body p-24 d-flex flex-wrap gap-4">
          <div className="flex-grow-1" style={{ minWidth: "400px" }}>
            <div className="table-responsive scroll-sm">
              <table className="table bordered-table sm-table mb-0">
                <thead>
                  <tr>
                    <th>S.L</th>
                    <th className="text-center">Category</th>
                    <th className="text-center">Show</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((cat, index) => (
                    <tr
                      key={cat.id}
                      className={`cursor-pointer ${selectedCategoryId === cat.id ? 'table-primary' : ''}`}
                    >
                      <td>{indexOfFirstItem + index + 1}</td>
                      <td className="text-center">{cat.categoryname}</td>
                      <td className="text-center">
                        <Icon
                          icon="iconamoon:arrow-down-2"
                          className={`transition-transform ${selectedCategoryId === cat.id ? 'rotate-180 text-success' : ''}`}
                          style={{ fontSize: '20px', cursor: 'pointer' }}
                          onClick={() => setSelectedCategoryId(cat.id === selectedCategoryId ? null : cat.id)}
                        />
                      </td>
                    </tr>
                  ))}
                  {currentItems.length === 0 && (
                    <tr>
                      <td colSpan="3" className="text-center text-muted">No categories found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-24">
              <span>
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredCategories.length)} of {filteredCategories.length} entries
              </span>
              <ul className="pagination d-flex flex-wrap align-items-center gap-2 justify-content-center">
                {[...Array(totalPages)].map((_, i) => (
                  <li key={i} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                    <button onClick={() => handlePageChange(i + 1)} className="page-link">
                      {i + 1}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {selectedCategoryId && (
            <div className="card body border-base shadow-sm radius-12 flex-grow-1" style={{ maxWidth: "350px" }}>
              <div className="card-header text-sm fw-semibold">
                Subjects for&nbsp;
                <span className="text-primary">
                  {subjectCategories.find(c => c.id === selectedCategoryId)?.categoryname}
                </span>
              </div>
              <div className="card-body p-16 scroll-sm" style={{ maxHeight: "320px", overflowY: "auto" }}>
                {getSubjectsByCategory(selectedCategoryId).length > 0 ? (
                  <ul className="list-unstyled mb-0">
                    {getSubjectsByCategory(selectedCategoryId).map(sub => (
                      <li
                        key={sub.id}
                        className="py-8 px-12 mb-4 radius-8 text-sm border border-dark-subtle"
                      >
                        {sub.subjectname}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm">No subjects found.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddSubjectModal
        showId="addCourseModal"
        onSubmit={handleAddSubject}
        subject={newSubject}
        setSubject={setNewSubject}
        category={newSubjectCategory}
        setCategory={setNewSubjectCategory}
        categories={subjectCategories}
        loading={loading}
      />
      <AddCategoryModal
        showId="addCategoryModal"
        onSubmit={handleAddCategory}
        category={newCategory}
        setCategory={setNewCategory}
        loading={loading}
      />

      {/* Arrow rotation CSS */}
      <style>{`
        .transition-transform {
          transition: transform 0.3s ease;
        }
        .rotate-180 {
          transform: rotate(180deg);
        }
      `}</style>
    </>
  );
};

export default CoursesLayer;
