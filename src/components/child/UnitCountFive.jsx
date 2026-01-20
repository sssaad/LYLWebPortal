import React, { useEffect, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import { getDashboardCounts } from '../../api/getDashboardCounts';
import { getMonthwiseUsers } from '../../api/getMonthwiseUsers';

const UnitCountFive = () => {
  const [data, setData] = useState(null);
  const [monthlyUsers, setMonthlyUsers] = useState([]);

  // ✅ Normalize data till current month only
  const normalizeMonthlyUsers = (rawData) => {
    const currentMonth = new Date().getMonth() + 1;
    const allMonths = Array.from({ length: currentMonth }, (_, i) => ({
      month: (i + 1).toString(),
      total_users: 0,
    }));

    rawData?.forEach((item) => {
      const index = parseInt(item.month) - 1;
      if (index >= 0 && index < currentMonth) {
        allMonths[index].total_users = parseInt(item.total_users);
      }
    });

    return allMonths;
  };

  const createChartSix = (color1, color2, userData = []) => {
    const monthLabels = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const series = [
      {
        name: 'Enrollments',
        data: userData.map((item) => item.total_users),
      },
    ];

    const options = {
      legend: { show: false },
      chart: {
        type: 'area',
        height: 270,
        toolbar: { show: false },
      },
      dataLabels: { enabled: false },
      stroke: {
        curve: 'smooth',
        width: 3,
        colors: [color1, color2],
      },
      fill: {
        type: 'gradient',
        colors: [color1, color2],
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0.5,
          gradientToColors: [undefined, `${color2}00`],
          inverseColors: false,
          opacityFrom: 0.4,
          opacityTo: 0.3,
          stops: [0, 100],
        },
      },
      grid: {
        show: true,
        borderColor: '#D1D5DB',
        strokeDashArray: 1,
      },
      markers: {
        colors: [color1, color2],
        strokeWidth: 3,
        size: 0,
        hover: { size: 10 },
      },
      xaxis: {
        categories: monthLabels.slice(0, userData.length),
        labels: { style: { fontSize: '14px' } },
      },
      yaxis: {
        labels: { style: { fontSize: '14px' } },
      },
      tooltip: {
        y: {
          formatter: (val) => `${val} users`,
        },
      },
    };

    return (
      <ReactApexChart
        options={options}
        series={series}
        type="area"
        height={270}
      />
    );
  };

  useEffect(() => {
    const fetchAllData = async () => {
      const counts = await getDashboardCounts();
      const users = await getMonthwiseUsers();
      setData(counts);
      setMonthlyUsers(normalizeMonthlyUsers(users || []));
    };
    fetchAllData();
  }, []);

  if (!data) {
  return (
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
  );
}


  return (
    <div className="col-xxl-8">
      <div className="card radius-8 border-0 p-20">
        <div className="row gy-4">
          <div className="col-xxl-4">
            {/* Total Students */}
            <div className="card p-3 radius-8 shadow-none bg-gradient-dark-start-1 mb-12">
              <div className="card-body p-0">
                <div className="d-flex align-items-center gap-2 mb-12">
                  <span className="w-48-px h-48-px bg-base text-pink text-2xl d-flex justify-content-center align-items-center rounded-circle">
                    <i className="ri-group-fill" />
                  </span>
                  <div>
                    <span className="fw-medium text-secondary-light text-lg">Total Students</span>
                  </div>
                </div>
                <div className="d-flex justify-content-between flex-wrap gap-8">
                  <h5 className="fw-semibold mb-0">{data.total_students}</h5>
                  <p className="text-sm mb-0 d-flex align-items-center gap-8">
                    <span className="text-white px-1 rounded-2 fw-medium bg-success-main text-sm">
                      +{data.currentmonth_users_students}
                    </span>
                    This Month
                  </p>
                </div>
              </div>
            </div>

            {/* Total Bookings */}
            <div className="card p-3 radius-8 shadow-none bg-gradient-dark-start-2 mb-12">
              <div className="card-body p-0">
                <div className="d-flex align-items-center gap-2 mb-12">
                  <span className="w-48-px h-48-px bg-base text-purple text-2xl d-flex justify-content-center align-items-center rounded-circle">
                    <i className="ri-youtube-fill" />
                  </span>
                  <div>
                    <span className="fw-medium text-secondary-light text-lg">Total Bookings</span>
                  </div>
                </div>
                <div className="d-flex justify-content-between flex-wrap gap-8">
                  <h5 className="fw-semibold mb-0">{data.total_booking}</h5>
                  <p className="text-sm mb-0 d-flex align-items-center gap-8">
                    <span className="text-white px-1 rounded-2 fw-medium bg-success-main text-sm">
                      +{data.currentmonth_booking}
                    </span>
                    This Month
                  </p>
                </div>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="card p-3 radius-8 shadow-none bg-gradient-dark-start-3 mb-0">
              <div className="card-body p-0">
                <div className="d-flex align-items-center gap-2 mb-12">
                  <span className="w-48-px h-48-px bg-base text-info text-2xl d-flex justify-content-center align-items-center rounded-circle">
                    <i className="ri-money-dollar-circle-fill" />
                  </span>
                  <div>
                    <span className="fw-medium text-secondary-light text-lg">Total Revenue</span>
                  </div>
                </div>
                <div className="d-flex justify-content-between flex-wrap gap-8">
                  <h5 className="fw-semibold mb-0">AED {data.totalpayments}</h5>
                  <p className="text-sm mb-0 d-flex align-items-center gap-8">
                    <span className="text-white px-1 rounded-2 fw-medium bg-success-main text-sm">
                      +AED {data.currentmonth_payments}
                    </span>
                    This Month
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="col-xxl-8">
            <div className="card-body p-0">
              <div className="d-flex align-items-center flex-wrap gap-2 justify-content-between">
                <h6 className="mb-2 fw-bold text-lg">Monthly Enrollment Rate</h6>
                <span className="px-3 py-1 border border-secondary-light rounded-pill text-sm fw-medium text-secondary-light">Monthly</span>
              </div>
              <ul className="d-flex flex-wrap align-items-center justify-content-center mt-3 gap-3">
                <li className="d-flex align-items-center gap-2">
                  <span className="w-12-px h-12-px rounded-circle bg-primary-600" />
                  <span className="text-secondary-light text-sm fw-semibold">
                    Enrollments:
                    <span className="text-primary-light fw-bold">
                      {monthlyUsers.reduce((sum, user) => sum + user.total_users, 0)}
                    </span>
                  </span>
                </li>
              </ul>
              <div className="mt-40">
                <div id="enrollmentChart" className="apexcharts-tooltip-style-1">
                  {createChartSix('#45B369', '#487fff', monthlyUsers)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnitCountFive;
