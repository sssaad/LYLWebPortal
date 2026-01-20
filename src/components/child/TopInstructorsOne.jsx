import React, { useEffect, useState } from 'react';
import { getTopFiveTeachers } from '../../api/getTopFiveTeachers';

const TopInstructorsOne = () => {
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    const fetchTeachers = async () => {
      const data = await getTopFiveTeachers();
      setTeachers(data);
    };
    fetchTeachers();
  }, []);

  // ✅ Loading spinner like "Top Courses"
  if (teachers.length === 0) {
    return (
      <div className="col-xxl-4 col-md-6">
        <div className="card">
          <div className="card-header">
            <div className="d-flex align-items-center flex-wrap gap-2 justify-content-between">
              <h6 className="mb-2 fw-bold text-lg mb-0">Top Teachers</h6>
            </div>
          </div>
          <div className="card-body d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '6px solid #e0e0e0',
              borderTop: '6px solid #45B369',
              borderRadius: '50%',
              animation: 'spin 1s ease-in-out infinite'
            }} />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="col-xxl-4 col-md-6">
      <div className="card">
        <div className="card-header">
          <div className="d-flex align-items-center flex-wrap gap-2 justify-content-between">
            <h6 className="mb-2 fw-bold text-lg mb-0">Top Teachers</h6>
          </div>
        </div>
        <div className="card-body">
          {teachers.map((teacher, index) => (
            <div
              key={index}
              className="d-flex align-items-center justify-content-between gap-3 mb-24"
            >
              <div className="d-flex align-items-center">
                <img
                  src={teacher.imagepath || "/assets/images/default-user.png"}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/assets/images/default-user.png";
                  }}
                  alt="Teacher"
                  className="w-40-px h-40-px rounded-circle flex-shrink-0 me-12 overflow-hidden"
                />
                <div className="flex-grow-1">
                  <h6 className="text-md mb-0 fw-medium">{teacher.fullname}</h6>
                  <span className="text-sm text-secondary-light fw-medium">
                    Teacher ID: {teacher.teacherid}
                  </span>
                </div>
              </div>
              <div>
                <div className="d-flex align-items-center gap-6 mb-1">
                  {[...Array(Math.round(teacher.average_rating))].map((_, i) => (
                    <span key={i} className="text-lg text-warning-600 d-flex line-height-1">
                      <i className="ri-star-fill" />
                    </span>
                  ))}
                </div>
                <span className="text-primary-light text-sm d-block text-end">
                  Rating: {teacher.average_rating?.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TopInstructorsOne;
