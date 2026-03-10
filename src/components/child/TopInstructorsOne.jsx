import React, { useEffect, useState } from "react";
import { getTopFiveTeachers } from "../../api/getTopFiveTeachers";

const TopInstructorsOne = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        setLoading(true);
        const data = await getTopFiveTeachers();

        // ✅ adjust this depending on API response shape
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        setTeachers(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error("Failed to fetch teachers:", err);
        setTeachers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTeachers();
  }, []);

  // ✅ Loading spinner
  if (loading) {
    return (
      <div className="col-xxl-4 col-md-6">
        <div className="card">
          <div className="card-header">
            <div className="d-flex align-items-center flex-wrap gap-2 justify-content-between">
              <h6 className="mb-2 fw-bold text-lg mb-0">Top Teachers</h6>
            </div>
          </div>
          <div className="card-body d-flex justify-content-center align-items-center" style={{ height: "200px" }}>
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

  // ✅ Empty state (spinner nahi)
  if (!teachers.length) {
    return (
      <div className="col-xxl-4 col-md-6">
        <div className="card">
          <div className="card-header">
            <h6 className="mb-2 fw-bold text-lg mb-0">Top Teachers</h6>
          </div>
          <div className="card-body" style={{ height: "200px" }}>
            <div className="d-flex h-100 justify-content-center align-items-center text-secondary-light">
              No teachers found.
            </div>
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
          {teachers.map((teacher) => {
            const rating = Number(teacher?.average_rating ?? 0);
            const starCount = Math.max(0, Math.min(5, Math.round(rating)));

            return (
              <div
                key={teacher.teacherid ?? teacher.fullname}
                className="d-flex align-items-center justify-content-between gap-3 mb-24"
              >
                <div className="d-flex align-items-center">
                  <img
                    src={teacher.imagepath || "https://gostudy.ae/assets/invalid-square.png"}
                    onError={(e) => {
                      e.currentTarget.src = "https://gostudy.ae/assets/invalid-square.png";
                    }}
                    alt="Teacher"
                    className="w-40-px h-40-px rounded-circle flex-shrink-0 me-12 overflow-hidden"
                  />

                  <div className="flex-grow-1">
                    <h6 className="text-md mb-0 fw-medium">{teacher.fullname ?? "Unknown"}</h6>
                    <span className="text-sm text-secondary-light fw-medium">
                      Teacher ID: {teacher.teacherid ?? "-"}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="d-flex align-items-center gap-6 mb-1">
                    {[...Array(starCount)].map((_, i) => (
                      <span key={i} className="text-lg text-warning-600 d-flex line-height-1">
                        <i className="ri-star-fill" />
                      </span>
                    ))}
                  </div>
                  <span className="text-primary-light text-sm d-block text-end">
                    Rating: {Number.isFinite(rating) ? rating.toFixed(1) : "0.0"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TopInstructorsOne;
