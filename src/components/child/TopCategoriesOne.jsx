import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { Link } from 'react-router-dom';
import { getSubjectwiseBooking } from '../../api/getSubjectwiseBooking'; // Adjust path if needed

const icons = [
  "category-icon1.png",
  "category-icon2.png",
  "category-icon3.png",
  "category-icon4.png",
  "category-icon5.png",
  "category-icon6.png",
];

const bgClasses = [
  "bg-info-50",
  "bg-success-50",
  "bg-purple-50",
  "bg-warning-50",
  "bg-danger-50",
  "bg-primary-50",
];

const TopCategoriesOne = () => {
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    const fetchSubjects = async () => {
      const data = await getSubjectwiseBooking();
      setSubjects(data);
    };
    fetchSubjects();
  }, []);

  return (
    <div className="col-xxl-4 col-md-6">
      <div className="card">
        <div className="card-header">
          <div className="d-flex align-items-center flex-wrap gap-2 justify-content-between">
            <h6 className="mb-2 fw-bold text-lg mb-0">Top Courses</h6>
          </div>
        </div>
        <div className="card-body">
         {subjects.length === 0 ? (
  <div
    className="d-flex justify-content-center align-items-center"
    style={{ height: '200px' }}
  >
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

  
    // 👇 keep rest of your mapping code as is

            subjects.map((subject, index) => (
              <div
                key={index}
                className="d-flex align-items-center justify-content-between gap-3 mb-24"
              >
                <div className="d-flex align-items-center gap-12">
                  <div
                    className={`w-40-px h-40-px radius-8 flex-shrink-0 ${
                      bgClasses[index % bgClasses.length]
                    } d-flex justify-content-center align-items-center`}
                  >
                    <img
                      src={`assets/images/home-six/${icons[index % icons.length]}`}
                      alt=""
                    />
                  </div>
                  <div className="flex-grow-1">
                    <h6 className="text-md mb-0 fw-normal">{subject.subjectname}</h6>
                    <span className="text-sm text-secondary-light fw-normal">
                      {subject.total}+ Bookings
                    </span>
                  </div>
                </div>
                {/* <Link
                  to="#"
                  className="w-24-px h-24-px bg-primary-50 text-primary-600 d-flex justify-content-center align-items-center text-lg bg-hover-primary-100 radius-4"
                >
                  <i className="ri-arrow-right-s-line" />
                </Link> */}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TopCategoriesOne;
