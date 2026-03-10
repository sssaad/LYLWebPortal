import React, { useEffect, useMemo, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import axios from 'axios';

import { getDashboardCounts } from '../../api/getDashboardCounts';
import { getMonthwiseUsers } from '../../api/getMonthwiseUsers';
import { getToken } from '../../api/getToken';

const UnitCountFive = () => {
  const [data, setData] = useState(null);
  const [monthlyUsers, setMonthlyUsers] = useState([]);
  const [weeklyUsers, setWeeklyUsers] = useState([]);
  const [mode, setMode] = useState('monthly'); // 'monthly' | 'weekly'

  // ✅ AED formatter
  const aed = (v) =>
    Number(v || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // ✅ Month normalize till current month only
  const normalizeMonthlyUsers = (rawData) => {
    const currentMonth = new Date().getMonth() + 1;
    const allMonths = Array.from({ length: currentMonth }, (_, i) => ({
      month: (i + 1).toString(),
      total_users: 0,
    }));

    rawData?.forEach((item) => {
      const index = parseInt(item.month, 10) - 1;
      if (index >= 0 && index < currentMonth) {
        allMonths[index].total_users = parseInt(item.total_users, 10) || 0;
      }
    });

    return allMonths;
  };

  // ✅ Week normalize (fill missing weeks)
  const normalizeWeeklyUsers = (rawData) => {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const latestYear = rawData
      .map((x) => parseInt(x.year, 10))
      .filter(Boolean)
      .sort((a, b) => b - a)[0];

    const yearData = rawData.filter((x) => parseInt(x.year, 10) === latestYear);

    const maxWeek = Math.max(
      ...yearData.map((x) => parseInt(x.week_number, 10)).filter(Boolean)
    );

    const allWeeks = Array.from({ length: maxWeek }, (_, i) => ({
      year: String(latestYear),
      week_number: String(i + 1),
      total_users: 0,
    }));

    yearData.forEach((item) => {
      const idx = parseInt(item.week_number, 10) - 1;
      if (idx >= 0 && idx < allWeeks.length) {
        allWeeks[idx].total_users = parseInt(item.total_users, 10) || 0;
      }
    });

    return allWeeks;
  };

  // ✅ Chart builder
  const createAreaChart = (color1, color2, categories = [], points = []) => {
    const series = [{ name: 'Enrollments', data: points }];

    const options = {
      legend: { show: false },
      chart: { type: 'area', height: 270, toolbar: { show: false } },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3, colors: [color1, color2] },
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
      grid: { show: true, borderColor: '#D1D5DB', strokeDashArray: 1 },
      markers: { colors: [color1, color2], strokeWidth: 3, size: 0, hover: { size: 10 } },
      xaxis: { categories, labels: { style: { fontSize: '14px' } } },
      yaxis: { labels: { style: { fontSize: '14px' } } },
      tooltip: { y: { formatter: (val) => `${val} users` } },
    };

    return <ReactApexChart options={options} series={series} type="area" height={270} />;
  };

  // ✅ Weekwise API call (Axios) inside component
  const fetchWeekwiseUsers = async () => {
    const token = await getToken();

    const headers = {
      projectid: '1',
      userid: 'test',
      password: 'test',
      'x-api-key': 'abc123456789',
      'Content-Type': 'application/json',
    };

    const url =
      'https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_portal_lists';

    const payload = {
      token,
      lists: 'get_weekwise_users',
    };

    const res = await axios.post(url, payload, { headers });
    return res?.data?.get_weekwise_users || [];
  };

  useEffect(() => {
    let alive = true;

    const fetchAllData = async () => {
      try {
        const [counts, usersMonth, usersWeek] = await Promise.all([
          getDashboardCounts(),
          getMonthwiseUsers(),
          fetchWeekwiseUsers(),
        ]);

        if (!alive) return;

        setData(counts?.get_dashboardcounts || counts);
        setMonthlyUsers(normalizeMonthlyUsers(usersMonth || []));
        setWeeklyUsers(normalizeWeeklyUsers(usersWeek || []));
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      }
    };

    fetchAllData();
    return () => {
      alive = false;
    };
  }, []);

  const monthLabels = useMemo(
    () => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    []
  );

  const chartCategories = useMemo(() => {
    if (mode === 'weekly') return weeklyUsers.map((w) => `W${w.week_number}`);
    return monthLabels.slice(0, monthlyUsers.length);
  }, [mode, weeklyUsers, monthlyUsers.length, monthLabels]);

  const chartPoints = useMemo(() => {
    if (mode === 'weekly') return weeklyUsers.map((w) => Number(w.total_users || 0));
    return monthlyUsers.map((m) => Number(m.total_users || 0));
  }, [mode, weeklyUsers, monthlyUsers]);

  const totalEnrollments = useMemo(
    () => chartPoints.reduce((sum, v) => sum + (Number(v) || 0), 0),
    [chartPoints]
  );

  if (!data) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            border: '6px solid #e0e0e0',
            borderTop: '6px solid #45B369',
            borderRadius: '50%',
            animation: 'spin 1s ease-in-out infinite',
          }}
        />
        <style>{`@keyframes spin {0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
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
            <div className="card p-3 radius-8 shadow-none bg-gradient-dark-start-3 mb-12">
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
                  <h5 className="fw-semibold mb-0">AED {aed(data.totalpayments)}</h5>
                  <p className="text-sm mb-0 d-flex align-items-center gap-8">
                    <span className="text-white px-1 rounded-2 fw-medium bg-success-main text-sm">
                      +AED {aed(data.currentmonth_payments)}
                    </span>
                    This Month
                  </p>
                </div>
              </div>
            </div>

            {/* Total Profit */}
            <div className="card p-3 radius-8 shadow-none bg-gradient-dark-start-4 mb-0">
              <div className="card-body p-0">
                <div className="d-flex align-items-center gap-2 mb-12">
                  <span className="w-48-px h-48-px bg-base text-success text-2xl d-flex justify-content-center align-items-center rounded-circle">
                    <i className="ri-line-chart-fill" />
                  </span>
                  <div>
                    <span className="fw-medium text-secondary-light text-lg">Total Profit</span>
                  </div>
                </div>
                <div className="d-flex justify-content-between flex-wrap gap-8">
                  <h5 className="fw-semibold mb-0">AED {aed(data.profit)}</h5>
                  {/* <p className="text-sm mb-0 d-flex align-items-center gap-8">
                    <span className="text-white px-1 rounded-2 fw-medium bg-success-main text-sm">
                      AED {aed(data.profit)}
                    </span>
                    This Month
                  </p> */}
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="col-xxl-8">
            <div className="card-body p-0">
              <div className="d-flex align-items-center flex-wrap gap-2 justify-content-between">
                <h6 className="mb-2 fw-bold text-lg">
                  {mode === 'weekly' ? 'Weekly Enrollment Rate' : 'Monthly Enrollment Rate'}
                </h6>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('monthly')}
                    className={`px-3 py-1 border rounded-pill text-sm fw-medium ${
                      mode === 'monthly'
                        ? 'bg-primary text-white border-primary'
                        : 'border-secondary-light text-secondary-light'
                    }`}
                  >
                    Monthly
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('weekly')}
                    className={`px-3 py-1 border rounded-pill text-sm fw-medium ${
                      mode === 'weekly'
                        ? 'bg-primary text-white border-primary'
                        : 'border-secondary-light text-secondary-light'
                    }`}
                  >
                    Weekly
                  </button>
                </div>
              </div>

              <ul className="d-flex flex-wrap align-items-center justify-content-center mt-3 gap-3">
                <li className="d-flex align-items-center gap-2">
                  <span className="w-12-px h-12-px rounded-circle bg-primary-600" />
                  <span className="text-secondary-light text-sm fw-semibold">
                    Enrollments: <span className="text-primary-light fw-bold">{totalEnrollments}</span>
                  </span>
                </li>
              </ul>

              <div className="mt-40">
                <div id="enrollmentChart" className="apexcharts-tooltip-style-1">
                  {createAreaChart('#45B369', '#487fff', chartCategories, chartPoints)}
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