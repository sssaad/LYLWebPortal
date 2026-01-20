import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import moment from 'moment';
import { getAllBookings } from '../api/getAllBookings';

const RoleAccessLayer = () => {
  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // ✅ now Payment Type filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      const data = await getAllBookings();
      setBookings(
        (data || []).sort((a, b) => new Date(b.bookdate) - new Date(a.bookdate))
      );
      setInitialLoading(false);
    };
    fetchData();
  }, []);

  // ✅ Payment Type badge color mapping
  const getPaymentTypeBadgeClass = (type) => {
    const t = String(type || '').trim().toLowerCase();
    if (t === 'direct') return 'bg-success';      // Green
    if (t === 'block') return 'bg-primary';       // Blue
    if (t === 'subscription') return 'bg-warning';// Yellow
    return 'bg-secondary';
  };

  const filteredData = bookings.filter((item) => {
    // ✅ search includes payment_type too
    const fullText = `${item.studentname} ${item.teachername} ${item.payment_type}`.toLowerCase();
    const matchesSearch = fullText.includes((searchTerm || '').toLowerCase());

    // ✅ filter is now payment_type (instead of payment_status)
    const matchesStatus =
      statusFilter === '' ||
      String(item.payment_type || '').toLowerCase() === String(statusFilter || '').toLowerCase();

    const itemDate = new Date(item.bookdate);
    const fromDateMatch = startDate ? itemDate >= new Date(startDate) : true;
    const toDateMatch = endDate ? itemDate <= new Date(endDate) : true;

    return matchesSearch && matchesStatus && fromDateMatch && toDateMatch;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

  const exportToExcel = () => {
    const heading = [['Booking List']];
    const data = filteredData.map((item, i) => ({
      'S.L': i + 1,
      'Book Date': item.bookdate ? moment(item.bookdate).format('DD MMM YYYY') : '-',
      'Student Name': item.studentname || '-',
      'Booked Teacher': item.teachername || '-',
      'Slot Start': item.slot_start ? moment(item.slot_start, 'HH:mm:ss').format('hh:mm A') : '-',
      'Slot End': item.slot_end ? moment(item.slot_end, 'HH:mm:ss').format('hh:mm A') : '-',
      'Payment Type': item.payment_type || '-',
    }));
    const worksheet = XLSX.utils.json_to_sheet(data, { origin: -1 });
    XLSX.utils.sheet_add_aoa(worksheet, heading, { origin: 'A1' });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');
    XLSX.writeFile(workbook, 'bookings.xlsx');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Booking List', 14, 20);

    const columns = [
      'S.L',
      'Book Date',
      'Student Name',
      'Booked Teacher',
      'Slot Start',
      'Slot End',
      'Payment Type',
    ];

    const rows = filteredData.map((item, i) => ([
      i + 1,
      item.bookdate ? moment(item.bookdate).format('DD MMM YYYY') : '-',
      item.studentname || '-',
      item.teachername || '-',
      item.slot_start ? moment(item.slot_start, 'HH:mm:ss').format('hh:mm A') : '-',
      item.slot_end ? moment(item.slot_end, 'HH:mm:ss').format('hh:mm A') : '-',
      item.payment_type || '-',
    ]));

    autoTable(doc, {
      startY: 25,
      head: [columns],
      body: rows,
    });

    doc.save('bookings.pdf');
  };

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

          {/* ✅ Payment Type filter (Direct/Block/Subscription) */}
          <select
            className="form-select form-select-sm w-auto"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All</option>
            <option value="Direct">Direct</option>
            <option value="Block">Block</option>
            <option value="Subscription">Subscription</option>
          </select>

          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
              setStartDate('');
              setEndDate('');
              setCurrentPage(1);
            }}
            className="btn btn-outline-secondary btn-sm"
          >
            Reset Filters
          </button>

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
                <th>Book Date</th>
                <th>Student Name</th>
                <th>Teacher Name</th>
                <th>Slot Start</th>
                <th>Slot End</th>
                <th>Payment Type</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item, index) => (
                <tr key={item?.bookingid ?? `${indexOfFirstItem}-${index}`}>
                  <td>{indexOfFirstItem + index + 1}</td>
                  <td>{item.bookdate ? moment(item.bookdate).format('DD MMM YYYY') : '-'}</td>
                  <td>{item.studentname || '-'}</td>
                  <td>{item.teachername || '-'}</td>
                  <td>{item.slot_start ? moment(item.slot_start, 'HH:mm:ss').format('hh:mm A') : '-'}</td>
                  <td>{item.slot_end ? moment(item.slot_end, 'HH:mm:ss').format('hh:mm A') : '-'}</td>

                  {/* ✅ Payment Type badge with required colors */}
                  <td>
                    <span className={`badge ${getPaymentTypeBadgeClass(item.payment_type)}`}>
                      {item.payment_type || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex justify-content-between mt-3">
          <span>
            Showing {filteredData.length === 0 ? 0 : indexOfFirstItem + 1} to{' '}
            {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
          </span>
          <ul className="pagination">
            {Array.from({ length: totalPages }).map((_, i) => (
              <li key={i} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                <button onClick={() => setCurrentPage(i + 1)} className="page-link">
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

export default RoleAccessLayer;
