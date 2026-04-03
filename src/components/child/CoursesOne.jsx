import { Icon } from '@iconify/react/dist/iconify.js';
import React, { useEffect, useState } from 'react';
import { getAllTeacherEnrollments } from '../../api/getAllTeacherEnrollments';
import moment from 'moment';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CoursesOne = () => {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
  const fetchData = async () => {
    const data = await getAllTeacherEnrollments();
    if (data) {
      const sorted = data.sort((a, b) => new Date(b.teacher_registration_date) - new Date(a.teacher_registration_date));
      setEnrollments(sorted);
    }
    setLoading(false);
  };
  fetchData();
}, []);


  const filteredEnrollments = enrollments.filter(item => {
    const searchText = `${item.teachername} ${item.subjectname}`.toLowerCase();
    const matchesSearch = searchText.includes(searchTerm.toLowerCase());

    const regDate = new Date(item.teacher_registration_date);
    const afterStart = startDate ? regDate >= new Date(startDate) : true;
    const beforeEnd = endDate ? regDate <= new Date(endDate) : true;

    return matchesSearch && afterStart && beforeEnd;
  });

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredEnrollments.map(item => ({
        "Registered Date": moment(item.teacher_registration_date).format('DD MMM YYYY'),
        "Teacher": item.teachername,
        "Bookings": item.bookingcount,
        "Earning": item.totalbookingsamount ? `AED${item.totalbookingsamount}` : 'AED0.00',
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Enrollments");
    XLSX.writeFile(workbook, "Course_Enrollments.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [["Registered Date", "Teacher", "Bookings", "Earning"]],
      body: filteredEnrollments.map(item => [
        moment(item.teacher_registration_date).format('DD MMM YYYY'),
        item.teachername,
        item.bookingcount,
        item.totalbookingsamount ? `AED${item.totalbookingsamount}` : 'AED0.00',
      ]),
    });
    doc.save("Course_Enrollments.pdf");
  };

  if (loading) {
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
    <div className="col-xxl-12">
      <div className="card h-100">
        <div className="card-header">
          <div className="d-flex align-items-center flex-wrap gap-3 justify-content-between">
            <h6 className="mb-2 fw-bold text-lg mb-0">Teachers Earnings</h6>
            <div className="d-flex flex-wrap gap-2">
              <input type="text" className="form-control form-control-sm w-auto" placeholder="Search"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <input type="date" className="form-control form-control-sm w-auto"
                value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <input type="date" className="form-control form-control-sm w-auto"
                value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                setSearchTerm('');
                setStartDate('');
                setEndDate('');
              }}>
                <Icon icon="ic:round-refresh" className="me-1" /> Reset
              </button>
              <button className="btn btn-sm btn-primary" onClick={exportToExcel}>
                <Icon icon="mdi:excel" className="me-1" /> Excel
              </button>
              <button className="btn btn-sm btn-danger" onClick={exportToPDF}>
                <Icon icon="mdi:file-pdf-box" className="me-1" /> PDF
              </button>
            </div>
          </div>
        </div>

        <div className="card-body p-24">
          <div className="table-responsive" style={{ maxHeight: '320px', overflowY: 'auto' }}>
            <table className="table bordered-table mb-0">
              <thead className="table-dark" style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th>Registered Date</th>
                  <th>Teacher</th>
                  <th>Bookings</th>
                  <th>Earning</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnrollments.length > 0 ? (
                  filteredEnrollments.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <span className="text-secondary-light">
                          {moment(item.teacher_registration_date).format('DD MMM YYYY')}
                        </span>
                      </td>
                      <td>
                        <span className="text-secondary-light">{item.teachername}</span>
                      </td>
                      <td>
                        <span className="text-secondary-light">{item.bookingcount}</span>
                      </td>
                      <td>
                        <span className="text-secondary-light">
                          {item.totalbookingsamount ? `AED ${item.totalbookingsamount}` : 'AED 0.00'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center text-secondary-light">
                      No Data Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoursesOne;
