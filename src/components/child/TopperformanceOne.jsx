import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { getPendingBookings } from "../../api/getPendingBookings";
import moment from "moment";
import { useNavigate } from "react-router-dom";

const TopPerformanceOne = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ✅ slot time range formatter (start - end)
  const formatSlotRange = (b) => {
    const start = b?.slot_start;
    const end = b?.slot_end;

    if (!start) return "—";

    const s = moment(start, "HH:mm:ss", true).isValid()
      ? moment(start, "HH:mm:ss").format("hh:mm A")
      : String(start);

    const e =
      end && moment(end, "HH:mm:ss", true).isValid()
        ? moment(end, "HH:mm:ss").format("hh:mm A")
        : end
        ? String(end)
        : "";

    return e ? `${s} - ${e}` : s;
  };

  useEffect(() => {
    const fetchBookings = async () => {
      const data = await getPendingBookings();

      // ✅ handle both shapes:
      // 1) direct array
      // 2) { getall_pending_bookings: [...] }
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.getall_pending_bookings)
        ? data.getall_pending_bookings
        : [];

      setBookings(rows);
      setLoading(false);
    };

    fetchBookings();
  }, []);

  if (loading) {
    return (
      <div className="col-xxl-4">
        <div className="card h-100 d-flex justify-content-center align-items-center">
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "6px solid #e0e0e0",
              borderTop: "6px solid #45B369",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
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
    );
  }

  return (
    <div className="col-xxl-4">
      <div className="card">
        <div className="card-body">
          <div className="d-flex align-items-center flex-wrap gap-2 justify-content-between">
            <h6 className="fw-bold text-lg mb-0">Recent Bookings</h6>
          </div>

          {/* Scrollable List */}
          <div
            className="mt-32 scroll-dark"
            style={{ maxHeight: "420px", overflowY: "auto" }}
          >
            {bookings.slice(0, 50).map((booking) => (
              <div key={booking.bookingid} className="booking-row">
                {/* Left */}
                <div className="booking-left">
                  {booking?.studentimage ? (
                    <img
                      src={booking.studentimage}
                      alt={booking.studentname || "student"}
                      className="w-40-px h-40-px rounded-circle flex-shrink-0 me-12 overflow-hidden"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="w-40-px h-40-px rounded-circle flex-shrink-0 me-12"
                      style={{ background: "rgba(0,0,0,0.12)" }}
                    />
                  )}

                  <div className="flex-grow-1">
                    <h6 className="text-md mb-0">{booking.studentname}</h6>
                    <span className="text-sm text-secondary-light fw-medium d-block">
                      Subject: {booking.subjectname}
                    </span>
                  </div>
                </div>

                {/* Right (Date + Time) */}
                <div className="booking-right">
                  <span className="booking-date text-primary-light text-md fw-medium d-block">
                    {moment(booking.bookdate).format("DD MMM, YYYY")}
                  </span>

                  <span className="booking-time text-sm text-secondary-light fw-medium d-flex align-items-center gap-1">
                    <Icon icon="solar:clock-circle-linear" style={{ fontSize: 14 }} />
                    {formatSlotRange(booking)}
                  </span>
                </div>
              </div>
            ))}

            {bookings.length === 0 && (
              <p className="text-center text-sm text-secondary">
                No pending bookings
              </p>
            )}
          </div>

          {/* ✅ View All button */}
          <div className="mt-3 d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => navigate("/bookings")}
            >
              View All
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Responsive + Scrollbar Styles */}
      <style>{`
        .booking-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin-bottom:24px;
        }
        .booking-left{
          display:flex;
          align-items:center;
          min-width:0;
          flex: 1 1 auto;
        }
        .booking-right{
          flex: 0 0 auto;
          text-align:right;
          white-space:nowrap;
        }

        @media (max-width: 575.98px){
          .booking-row{
            flex-direction:column;
            align-items:flex-start;
            gap:8px;
          }
          .booking-right{
            text-align:left;
            white-space:normal;
          }
          .booking-time{
            margin-top:2px;
          }
        }

        .scroll-dark::-webkit-scrollbar { width: 6px; }
        .scroll-dark::-webkit-scrollbar-track { background: transparent; }
        .scroll-dark::-webkit-scrollbar-thumb { background-color: #555; border-radius: 10px; }
        .scroll-dark::-webkit-scrollbar-thumb:hover { background-color: #777; }
      `}</style>
    </div>
  );
};

export default TopPerformanceOne;
