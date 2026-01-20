// src/components/ParentListLayer.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import Swal from "sweetalert2";
import moment from 'moment';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ParentDetailsModal from './ParentDetailsModal';
import { getNationalities } from '../api/getNationalities';

// ✅ HARD DELETE API (same as teacher/student)
import { hardDeleteUser } from '../api/hardDeleteUser';

const API_URL = 'https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_profiles';
const API_HEADERS = {
  'x-api-key': 'abc123456789',
  userid: 'test',
  password: 'test',
  projectid: '1',
};

const DEFAULT_AVATAR =
  'https://lylassets.s3.eu-north-1.amazonaws.com/uploads/person-dummy-02.jpg';

// ---------- helpers ----------
function safeStr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t || t === 'null' || t === 'NULL' || t === 'undefined') return '';
    return t;
  }
  return String(v);
}
function cleanDate(v) {
  const s = safeStr(v);
  if (!s || s.startsWith('0000-00-00')) return '';
  const d = new Date(s.replace('.000000', ''));
  return isNaN(d.getTime()) ? '' : moment(d).format('DD MMM YYYY');
}
// force -> id string or ""
const getNatId = (val) => {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (s === '') return '';
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? String(n) : '';
};
const addr = (p) =>
  `${p.street || ''}, ${p.area || ''}, ${p.city || ''} - ${p.postcode || ''}`
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/(^,\s*)|(\s*,-?$)/g, '');
const fileStamp = () => moment().format('YYYY-MM-DD_HHmm');

// ✅ Stable key (pagination safe)
const getRowKey = (p) =>
  String(p?.id ?? `${p?.email ?? ''}-${p?.phonenumber ?? ''}-${p?.createddate ?? ''}`);

// ✅ Hard delete id resolver
const getHardDeleteId = (row) => {
  const raw = row?.id ?? row?.userdetails?.userid ?? null;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
};

// ✅ children helpers (bachy)
const getChildrenArr = (row) => (Array.isArray(row?.bachy) ? row.bachy : []);
const getChildrenCount = (row) => getChildrenArr(row).length;

// ---------- mapping ----------
function mapRow(apiRow) {
  const ud = apiRow.userdetails || null;
  const isProfileComplete = Number(apiRow.detail_status) === 1;

  const name = ud
    ? `${safeStr(ud.firstname)} ${safeStr(ud.lastname)}`.trim() || safeStr(apiRow.fullname)
    : safeStr(apiRow.fullname);

  // use nationalityid (NOT country)
  const natIdRaw = ud ? (ud.nationalityid ?? ud.nationality ?? '') : '';
  const nationalityid = getNatId(natIdRaw);

  const dob = ud ? cleanDate(ud.dob) : '';
  const gender = ud ? safeStr(ud.gender) : '';
  const street = ud ? safeStr(ud.street) : '';
  const area = ud ? safeStr(ud.area) : '';
  const city = ud ? safeStr(ud.city) : '';
  const postcode = ud ? safeStr(ud.postcode) : '';
  const address = [street, area, city, postcode].filter(Boolean).join(', ');

  const imagepathRaw = ud ? safeStr(ud.imagepath) : '';
  const avatar = isProfileComplete && imagepathRaw ? imagepathRaw : DEFAULT_AVATAR;

  return {
    id: apiRow.id,
    createddate: apiRow.createddate,
    parentName: name || '-',
    email: safeStr(apiRow.email) || '-',
    phonenumber: safeStr(apiRow.phonenumber) || '-',

    nationalityid,
    nationalityName: '-',

    dob: dob || '-',
    gender: gender || '-',
    street,
    area,
    city,
    postcode,
    address: address || '-',
    avatar,
    isProfileComplete,
    seed: {
      id: apiRow.id,
      email: apiRow.email,
      phonenumber: apiRow.phonenumber,
      fullname: apiRow.fullname,
    },

    // ✅ keep full userdetails and bachy array (needed for child modal)
    userdetails: apiRow.userdetails || null,
    bachy: Array.isArray(apiRow?.bachy) ? apiRow.bachy : [],
  };
}

const ParentListLayer = ({ useApi = true }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 15;

  const [showModal, setShowModal] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [seedRow, setSeedRow] = useState(null);

  // ✅ Nationality filter
  const [nationalityFilter, setNationalityFilter] = useState('');

  // ✅ Children modal state
  const [showChildrenModal, setShowChildrenModal] = useState(false);
  const [childrenModalData, setChildrenModalData] = useState(null);

  // nationalities lookup
  const [natMap, setNatMap] = useState({});
  const [natLoaded, setNatLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getNationalities();
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        const m = {};
        (list || []).forEach((n) => { m[String(n.id)] = n.nationality; });
        setNatMap(m);
      } catch (e) {
        console.error('getNationalities failed', e);
      } finally {
        setNatLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!useApi) return;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(API_URL, { method: 'GET', headers: API_HEADERS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.statusCode !== 200 || !Array.isArray(json.data)) {
          throw new Error(json.message || 'Unexpected API response');
        }
        const mapped = json.data.map(mapRow).sort(
          (a, b) => new Date(b.createddate) - new Date(a.createddate)
        );
        setRows(mapped);
      } catch (e) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [useApi]);

  // resolve nationality name via lookup
  const rowsWithNationality = useMemo(() => {
    if (!natLoaded) return rows;
    return rows.map(r => ({
      ...r,
      nationalityName: r.nationalityid ? (natMap[r.nationalityid] || '-') : '-',
    }));
  }, [rows, natMap, natLoaded]);

  // nationality dropdown options (lookup + fallback)
  const nationalityOptions = useMemo(() => {
    const map = new Map();

    // 1) from lookup map
    Object.entries(natMap || {}).forEach(([id, name]) => {
      if (!id) return;
      map.set(String(id), String(name || `Nationality #${id}`));
    });

    // 2) add ids from rows not found in lookup
    (rowsWithNationality || []).forEach((r) => {
      const id = r?.nationalityid;
      if (!id) return;
      const key = String(id);
      if (map.has(key)) return;

      const label =
        r?.userdetails?.nationalityname ||
        (String(id) === '0' ? 'Unknown' : `Nationality #${id}`);
      map.set(key, String(label));
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [natMap, rowsWithNationality]);

  const filteredParents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rowsWithNationality.filter((p) => {
      const hay = `${p.parentName} ${p.email} ${p.nationalityName}`.toLowerCase();
      const okSearch = term ? hay.includes(term) : true;

      const profileText = p.isProfileComplete ? 'Complete' : 'Incomplete';
      const okProfile = profileFilter ? profileText === profileFilter : true;

      const joined = p.createddate ? new Date(p.createddate) : null;
      const okStart = startDate && joined ? joined >= new Date(startDate) : !startDate;
      const okEnd = endDate && joined ? joined <= new Date(endDate) : !endDate;

      const okNat =
        nationalityFilter === '' ||
        String(p?.nationalityid ?? '') === String(nationalityFilter);

      return okSearch && okProfile && okStart && okEnd && okNat;
    });
  }, [rowsWithNationality, searchTerm, profileFilter, startDate, endDate, nationalityFilter]);

  const indexOfLast = currentPage * perPage;
  const indexOfFirst = indexOfLast - perPage;
  const currentParents = filteredParents.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredParents.length / perPage) || 1;

  const handlePageChange = (n) => setCurrentPage(n);
  const resetFilters = () => {
    setSearchTerm('');
    setProfileFilter('');
    setStartDate('');
    setEndDate('');
    setNationalityFilter('');
    setCurrentPage(1);
  };

  const openView = (row) => {
    setSelectedParentId(row.isProfileComplete ? row.id : null);
    setSeedRow(row.seed);
    setShowModal(true);
  };

  // ✅ children modal open/close
  const openChildrenModal = (row) => {
    const kids = getChildrenArr(row);
    setChildrenModalData({
      parentName: row?.parentName || '-',
      count: kids.length,
      children: kids.map((c) => ({
        id: safeStr(c?.id || c?.userid) || '-',
        name:
          safeStr(c?.fullname) ||
          `${safeStr(c?.firstname)} ${safeStr(c?.lastname)}`.trim() ||
          '-',
      })),
    });
    setShowChildrenModal(true);
  };
  const closeChildrenModal = () => {
    setShowChildrenModal(false);
    setChildrenModalData(null);
  };

  // ✅ HARD DELETE (pagination safe, row object pass)
  const handleHardDelete = async (row) => {
    const parentId = getHardDeleteId(row);
    if (!parentId) {
      console.log('Parent row:', row);
      Swal.fire('Error', 'Parent ID missing.', 'error');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Hard Delete Parent?',
      text: `This will permanently delete ${row.parentName || 'this parent'}. Continue?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Hard Delete',
    });
    if (!confirm.isConfirmed) return;

    Swal.fire({
      title: 'Deleting...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const result = await hardDeleteUser(parentId);

    if (result?.statusCode === 200) {
      setRows((prev) => prev.filter((r) => getHardDeleteId(r) !== parentId));
      Swal.fire('Deleted!', 'Parent hard deleted successfully.', 'success');
    } else {
      Swal.fire('Error', result?.message || 'Hard delete failed.', 'error');
    }
  };

  const handleSaved = (updated) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === updated.userid || r.id === updated.id
          ? {
              ...r,
              parentName: `${updated.firstname || ''} ${updated.lastname || ''}`.trim() || r.parentName,
              email: updated.email || r.email,
              phonenumber: updated.phonenumber || r.phonenumber,
              nationalityid: updated.nationalityid ? String(updated.nationalityid) : r.nationalityid,
              nationalityName: updated.nationality_name || r.nationalityName,
              dob: updated.dob || r.dob,
              street: updated.street ?? r.street,
              area: updated.area ?? r.area,
              city: updated.city ?? r.city,
              postcode: updated.postcode ?? r.postcode,
              address: [updated.street, updated.area, updated.city, updated.postcode].filter(Boolean).join(', ') || r.address,
              avatar: updated.imagepath ? updated.imagepath : r.avatar,
              isProfileComplete: true,
            }
          : r
      )
    );
  };

  // ---------- EXPORTS ----------
  const exportParentsToExcel = () => {
    const heading = [['Parent List']];
    const data = filteredParents.map((p, i) => ({
      'S.L': i + 1,
      'Joined Date': p.createddate ? moment(p.createddate).format('DD MMM YYYY') : '-',
      'Parent Name': p.parentName || '-',
      Email: p.email || '-',
      'Phone Number': p.phonenumber || '-',
      Nationality: p.nationalityName || '-',
      'Date of Birth': p.dob || '-',
      Gender: p.gender || '-',
      Address: addr(p) || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data, { origin: -1 });
    XLSX.utils.sheet_add_aoa(ws, heading, { origin: 'A1' });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parents');
    XLSX.writeFile(wb, `parents_${fileStamp()}.xlsx`);
  };

  const exportParentsToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Parent List', 14, 18);

    const head = [[
      'S.L', 'Joined Date', 'Parent Name', 'Email', 'Phone',
      'Nationality', 'DOB', 'Gender', 'Address'
    ]];

    const body = filteredParents.map((p, i) => ([
      i + 1,
      p.createddate ? moment(p.createddate).format('DD MMM YYYY') : '-',
      p.parentName || '-',
      p.email || '-',
      p.phonenumber || '-',
      p.nationalityName || '-',
      p.dob || '-',
      p.gender || '-',
      addr(p) || '-',
    ]));

    autoTable(doc, {
      startY: 24,
      head,
      body,
      styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [69, 179, 105] },
      columnStyles: {
        2: { cellWidth: 32 },
        3: { cellWidth: 38 },
        8: { cellWidth: 50 },
      },
    });

    doc.save(`parents_${fileStamp()}.pdf`);
  };

  return (
    <div className="card h-100 p-0 radius-12">
      <style>{`
        .avatar-ring-danger {
          box-shadow: 0 0 0 2px #ffe3e6, 0 0 0 4px #dc3545;
        }

        /* ===== Theme-aware helpers (works with data-bs-theme, data-theme, or .dark) ===== */
        /* ===== Theme-aware helpers (works with data-bs-theme, data-theme, or .dark) ===== */
:root {
  --child-muted: rgba(33, 37, 41, 0.65);

  --child-modal-bg: #ffffff;
  --child-modal-text: #212529;
  --child-modal-border: rgba(0,0,0,0.12);

  --child-modal-head-bg: #f8f9fa;

  /* ✅ table colors (light) */
  --child-table-head-bg: #f1f3f5;
  --child-table-row-bg: #ffffff;
  --child-table-hover-bg: #f6f7f9;

  --child-close-filter: none;
}

[data-bs-theme="dark"],
[data-theme="dark"],
.dark {
  --child-muted: rgba(255,255,255,0.75);

  --child-modal-bg: #0f172a;        /* slate/dark */
  --child-modal-text: #e5e7eb;
  --child-modal-border: rgba(255,255,255,0.12);

  --child-modal-head-bg: #111827;

  /* ✅ table colors (dark) */
  --child-table-head-bg: #111827;
  --child-table-row-bg: #0f172a;
  --child-table-hover-bg: #162033;

  --child-close-filter: invert(1) grayscale(100%);
}

.child-empty-text{
  color: var(--child-muted) !important;
  font-weight: 500;
}

/* ✅ Modal theming */
.child-modal .modal-content{
  background: var(--child-modal-bg) !important;
  color: var(--child-modal-text) !important;
  border: 1px solid var(--child-modal-border) !important;
}
.child-modal .modal-header{
  background: var(--child-modal-head-bg) !important;
  border-bottom: 1px solid var(--child-modal-border) !important;
}
.child-modal .modal-body{
  background: var(--child-modal-bg) !important;
}
.child-modal .btn-close{
  filter: var(--child-close-filter);
}

/* ✅ IMPORTANT: Fix white table rows in dark theme */
.child-modal .table-responsive{
  background: var(--child-modal-bg) !important;
}

/* Bootstrap table variables override (best fix) */
.child-modal .table{
  --bs-table-bg: var(--child-table-row-bg) !important;
  --bs-table-color: var(--child-modal-text) !important;
  --bs-table-border-color: var(--child-modal-border) !important;
  background: var(--child-table-row-bg) !important;
  color: var(--child-modal-text) !important;
}

/* Force all cells to use modal bg instead of white */
.child-modal .table > :not(caption) > * > *{
  background-color: var(--child-table-row-bg) !important;
  color: var(--child-modal-text) !important;
  border-color: var(--child-modal-border) !important;
}

/* Thead background */
.child-modal .table thead th{
  background-color: var(--child-table-head-bg) !important;
  color: var(--child-modal-text) !important;
}

/* Hover (optional but nice) */
.child-modal .table tbody tr:hover > *{
  background-color: var(--child-table-hover-bg) !important;
}

      `}</style>

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
            className="form-select form-select-sm w-auto"
            value={profileFilter}
            onChange={(e) => { setProfileFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Profile: All</option>
            <option value="Complete">Completed Profiles</option>
            <option value="Incomplete">Incomplete Profiles</option>
          </select>

          {/* ✅ Nationality filter */}
          <select
            className="form-select form-select-sm w-auto"
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

          <button onClick={resetFilters} className="btn btn-outline-secondary btn-sm">
            Reset Filters
          </button>

          <button onClick={exportParentsToExcel} className="btn btn-success btn-sm">
            Excel Export
          </button>
          <button onClick={exportParentsToPDF} className="btn btn-danger btn-sm">
            PDF Export
          </button>
        </div>
      </div>

      <div className="card-body p-24">
        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        {loading ? (
          <div className="d-flex justify-content-center align-items-center" style={{ height: '220px' }}>
            <div style={{ width: 48, height: 48, border: '6px solid #e0e0e0', borderTop: '6px solid #45B369', borderRadius: '50%', animation: 'spin 1s ease-in-out infinite' }} />
            <style>{`@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <>
            <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 360px)' }}>
              <table className="table bordered-table sm-table mb-0" style={{ borderCollapse: 'separate' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 5 }}>
                    <th>S.L</th>
                    <th>Joined Date</th>
                    <th>Parent Name</th>
                    <th>Email</th>
                    <th>Phone Number</th>
                    <th>Nationality</th>
                    <th>Date of Birth</th>
                    <th>Gender</th>
                    <th>Address</th>
                    <th className="text-center">Child</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {currentParents.length === 0 ? (
                    <tr>
                      <td className="text-center" colSpan={11}>No records found.</td>
                    </tr>
                  ) : currentParents.map((p, idx) => (
                    <tr key={getRowKey(p)}>
                      <td>{indexOfFirst + idx + 1}</td>
                      <td>{cleanDate(p.createddate) || '-'}</td>

                      <td>
                        <div className="d-flex align-items-center">
                          <img
                            src={p.avatar}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = DEFAULT_AVATAR;
                            }}
                            alt="User"
                            className={`w-40-px h-40-px rounded-circle me-12 ${!p.isProfileComplete ? 'avatar-ring-danger' : ''}`}
                            style={{ objectFit: 'cover' }}
                          />
                          <span>{p.parentName}</span>
                        </div>
                      </td>

                      <td>{p.email}</td>
                      <td>{p.phonenumber}</td>
                      <td>{p.nationalityName}</td>
                      <td>{p.dob}</td>
                      <td>{p.gender}</td>
                      <td>{p.address}</td>

                      {/* Child column */}
                      <td className="text-center">
                        {getChildrenCount(p) > 0 ? (
                          <button
                            className="btn btn-outline-info btn-sm"
                            onClick={() => openChildrenModal(p)}
                            title="View Children"
                          >
                            <Icon icon="majesticons:eye-line" />
                            <span className="ms-1">{getChildrenCount(p)}</span>
                          </button>
                        ) : (
                          <span className="child-empty-text">No Child Added Yet</span>
                        )}
                      </td>

                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-2">
                          <button
                            className={`btn btn-sm me-1 ${p.isProfileComplete ? 'btn-primary' : 'btn-outline-danger'}`}
                            onClick={() => openView(p)}
                            title={p.isProfileComplete ? 'View / Edit Profile' : 'Add Details'}
                          >
                            <Icon icon="majesticons:eye-line" />
                          </button>

                          {/* ✅ HARD DELETE */}
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleHardDelete(p)}
                            title="Hard Delete"
                          >
                            <Icon icon="fluent:delete-24-regular" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between mt-3">
              <span>
                Showing {filteredParents.length === 0 ? 0 : indexOfFirst + 1} to {Math.min(indexOfLast, filteredParents.length)} of {filteredParents.length} entries
              </span>
              <ul className="pagination">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <li key={i} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                    <button onClick={() => handlePageChange(i + 1)} className="page-link">
                      {i + 1}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <ParentDetailsModal
          show={showModal}
          userid={selectedParentId}
          seed={seedRow}
          onClose={() => { setShowModal(false); setSelectedParentId(null); setSeedRow(null); }}
          onSave={(updated) => {
            handleSaved(updated);
            setShowModal(false);
            setSelectedParentId(null);
            setSeedRow(null);
          }}
        />
      )}

      {/* ✅ Children Modal (theme-aware) */}
      {showChildrenModal && childrenModalData && (
        <div className="modal fade show d-block child-modal" tabIndex="-1" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Child{childrenModalData?.parentName ? ` - ${childrenModalData.parentName}` : ""}
                  {typeof childrenModalData?.count === "number" ? ` (${childrenModalData.count})` : ""}
                </h5>
                <button type="button" className="btn-close" onClick={closeChildrenModal}></button>
              </div>

              <div className="modal-body">
                {childrenModalData?.children?.length ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: "80px" }}>S.L</th>
                          <th style={{ width: "120px" }}>Child ID</th>
                          <th>Child Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {childrenModalData.children.map((c, i) => (
                          <tr key={`${c?.id ?? i}`}>
                            <td>{i + 1}</td>
                            <td>{c?.id || "-"}</td>
                            <td>{c?.name || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="child-empty-text">No Child Added Yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentListLayer;
