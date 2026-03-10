import React, { useEffect, useState } from 'react';
import { getTopFiveStudents } from '../../api/getTopFiveStudents';

const StudentProgressOne = () => {
  const [students, setStudents] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getTopFiveStudents();
      setStudents(data);
    };
    fetchData();
  }, []);

  return (
    <div className="col-xxl-4 col-md-6">
      <div className="card">
        <div className="card-header">
          <div className="d-flex align-items-center flex-wrap gap-2 justify-content-between">
            <h6 className="mb-2 fw-bold text-lg mb-0">Top Students</h6>
          </div>
        </div>

        {students.length === 0 ? (
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
        ) : (
          <div className="card-body">
            {students.map((student, index) => (
              <div key={index} className="d-flex align-items-center justify-content-between gap-3 mb-24">
                <div className="d-flex align-items-center">
                  <img
                    src={student.studentimage || "https://gostudy.ae/assets/invalid-square.png"}
                    alt={student.studentname}
                    className="w-40-px h-40-px radius-8 flex-shrink-0 me-12 overflow-hidden"
                  />
                  <div className="flex-grow-1">
                    <h6 className="text-md mb-0 fw-medium">{student.studentname}</h6>
                    <span className="text-sm text-secondary-light fw-medium">
                      {student.subjectname}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-primary-light text-sm d-block text-end">
                    <svg className="radial-progress" data-percentage="100" viewBox="0 0 80 80">
                      <circle className="incomplete" cx="40" cy="40" r="35" />
                      <circle className="complete" cx="40" cy="40" r="35" style={{ strokeDashoffset: "0" }} />
                      <text className="percentage" x="50%" y="57%" transform="matrix(0, 1, -1, 0, 80, 0)">
                        100
                      </text>
                    </svg>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentProgressOne;
