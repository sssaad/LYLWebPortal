import React, { useEffect, useMemo, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import axios from 'axios';

import { getDashboardCounts } from '../../api/getDashboardCounts';
import { getToken } from '../../api/getToken';

const API_URL =
  'https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=get_portal_lists';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ROLE_CONFIG = [
  { roleId: '2', key: 'teacher', label: 'Teacher', color: '#45B369' },
  { roleId: '3', key: 'student', label: 'Student', color: '#487FFF' },
  { roleId: '4', key: 'parent', label: 'Parent', color: '#F98C08' },
];

const ROLE_META_BY_KEY = ROLE_CONFIG.reduce((acc, role) => {
  acc[role.key] = role;
  return acc;
}, {});

const ROLE_ID_TO_KEY = ROLE_CONFIG.reduce((acc, role) => {
  acc[role.roleId] = role.key;
  return acc;
}, {});

const ROLE_FILTERS = [
  { key: 'all', label: 'All Roles', color: '#6B7280' },
  ...ROLE_CONFIG.map(({ key, label, color }) => ({ key, label, color })),
];

const toNumber = (value) => Number(value) || 0;

const createEmptyBucket = (extra = {}) => {
  const bucket = { ...extra };
  ROLE_CONFIG.forEach(({ key }) => {
    bucket[key] = 0;
  });
  return bucket;
};

const getHeaders = () => ({
  projectid: '1',
  userid: 'test',
  password: 'test',
  'x-api-key': 'abc123456789',
  'Content-Type': 'application/json',
});

const fetchPortalList = async (token, listName, responseKey) => {
  const response = await axios.post(
    API_URL,
    {
      token,
      lists: listName,
    },
    {
      headers: getHeaders(),
    }
  );

  return response?.data?.[responseKey] || [];
};

const normalizeMonthlyUsers = (rawData = []) => {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];

  const validMonths = rawData
    .map((item) => toNumber(item.month))
    .filter((month) => month >= 1 && month <= 12);

  const maxMonth = Math.max(...validMonths, 0);
  if (!maxMonth) return [];

  const months = Array.from({ length: maxMonth }, (_, index) =>
    createEmptyBucket({ month: String(index + 1) })
  );

  rawData.forEach((item) => {
    const monthIndex = toNumber(item.month) - 1;
    const roleKey = ROLE_ID_TO_KEY[item.roleid];

    if (monthIndex >= 0 && monthIndex < months.length && roleKey) {
      months[monthIndex][roleKey] += toNumber(item.total_users);
    }
  });

  return months;
};

const normalizeWeeklyUsers = (rawData = []) => {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];

  const latestYear = Math.max(
    ...rawData.map((item) => toNumber(item.year)).filter(Boolean),
    0
  );

  if (!latestYear) return [];

  const yearData = rawData.filter((item) => toNumber(item.year) === latestYear);

  const validWeeks = yearData
    .map((item) => toNumber(item.week_number))
    .filter((week) => week > 0);

  const maxWeek = Math.max(...validWeeks, 0);
  if (!maxWeek) return [];

  const weeks = Array.from({ length: maxWeek }, (_, index) =>
    createEmptyBucket({
      year: String(latestYear),
      week_number: String(index + 1),
    })
  );

  yearData.forEach((item) => {
    const weekIndex = toNumber(item.week_number) - 1;
    const roleKey = ROLE_ID_TO_KEY[item.roleid];

    if (weekIndex >= 0 && weekIndex < weeks.length && roleKey) {
      weeks[weekIndex][roleKey] += toNumber(item.total_users);
    }
  });

  return weeks;
};

const buildAreaChart = ({ categories = [], series = [], colors = [] }) => {
  const options = {
    chart: {
      type: 'area',
      height: 300,
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    legend: { show: false },
    colors,
    dataLabels: { enabled: false },
    stroke: {
      curve: 'smooth',
      width: series.length === 1 ? 4 : 3,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'vertical',
        shadeIntensity: 0.15,
        inverseColors: false,
        opacityFrom: 0.25,
        opacityTo: 0.03,
        stops: [0, 100],
      },
    },
    grid: {
      show: true,
      borderColor: '#D1D5DB',
      strokeDashArray: 1,
    },
    markers: {
      size: series.length === 1 ? 3 : 0,
      hover: { size: 7 },
    },
    xaxis: {
      categories,
      labels: {
        style: { fontSize: '14px' },
      },
    },
    yaxis: {
      labels: {
        style: { fontSize: '14px' },
        formatter: (val) => Math.round(val),
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val) => `${Math.round(val)} users`,
      },
    },
    noData: {
      text: 'No enrollment data available',
    },
  };

  return (
    <ReactApexChart
      options={options}
      series={series}
      type="area"
      height={300}
    />
  );
};

const UnitCountFive = () => {
  const [dashboardData, setDashboardData] = useState({});
  const [monthlyUsers, setMonthlyUsers] = useState([]);
  const [weeklyUsers, setWeeklyUsers] = useState([]);
  const [mode, setMode] = useState('monthly');
  const [selectedRole, setSelectedRole] = useState('all');
  const [loading, setLoading] = useState(true);

  const aed = (v) =>
    Number(v || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  useEffect(() => {
    let alive = true;

    const fetchAllData = async () => {
      try {
        setLoading(true);

        const token = await getToken();

        const [countsResult, monthlyResult, weeklyResult] = await Promise.allSettled([
          getDashboardCounts(),
          fetchPortalList(token, 'get_monthwise_users_role', 'get_monthwise_users_role'),
          fetchPortalList(token, 'get_weekwise_users_role', 'get_weekwise_users_role'),
        ]);

        if (!alive) return;

        if (countsResult.status === 'fulfilled') {
          setDashboardData(countsResult.value?.get_dashboardcounts || countsResult.value || {});
        } else {
          console.error('Dashboard counts error:', countsResult.reason);
          setDashboardData({});
        }

        if (monthlyResult.status === 'fulfilled') {
          setMonthlyUsers(normalizeMonthlyUsers(monthlyResult.value));
        } else {
          console.error('Monthly role data error:', monthlyResult.reason);
          setMonthlyUsers([]);
        }

        if (weeklyResult.status === 'fulfilled') {
          setWeeklyUsers(normalizeWeeklyUsers(weeklyResult.value));
        } else {
          console.error('Weekly role data error:', weeklyResult.reason);
          setWeeklyUsers([]);
        }
      } catch (error) {
        console.error('Dashboard fetch error:', error);

        if (alive) {
          setDashboardData({});
          setMonthlyUsers([]);
          setWeeklyUsers([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchAllData();

    return () => {
      alive = false;
    };
  }, []);

  const activeRows = useMemo(() => {
    return mode === 'weekly' ? weeklyUsers : monthlyUsers;
  }, [mode, weeklyUsers, monthlyUsers]);

  const visibleRoleKeys = useMemo(() => {
    if (selectedRole === 'all') {
      return ROLE_CONFIG.map((role) => role.key);
    }
    return [selectedRole];
  }, [selectedRole]);

  const chartCategories = useMemo(() => {
    return activeRows.map((item) => {
      if (mode === 'weekly') {
        return `W${item.week_number}`;
      }

      return MONTH_LABELS[toNumber(item.month) - 1] || `M${item.month}`;
    });
  }, [activeRows, mode]);

  const chartSeries = useMemo(() => {
    return visibleRoleKeys.map((roleKey) => ({
      name: ROLE_META_BY_KEY[roleKey].label,
      data: activeRows.map((item) => toNumber(item[roleKey])),
    }));
  }, [visibleRoleKeys, activeRows]);

  const chartColors = useMemo(() => {
    return visibleRoleKeys.map((roleKey) => ROLE_META_BY_KEY[roleKey].color);
  }, [visibleRoleKeys]);

  const totalsByRole = useMemo(() => {
    const totals = createEmptyBucket();

    activeRows.forEach((item) => {
      ROLE_CONFIG.forEach(({ key }) => {
        totals[key] += toNumber(item[key]);
      });
    });

    return totals;
  }, [activeRows]);

  const summaryRoles = useMemo(() => {
    return visibleRoleKeys.map((roleKey) => ({
      ...ROLE_META_BY_KEY[roleKey],
      total: totalsByRole[roleKey] || 0,
    }));
  }, [visibleRoleKeys, totalsByRole]);

  const selectedTotal = useMemo(() => {
    return visibleRoleKeys.reduce((sum, roleKey) => {
      return sum + toNumber(totalsByRole[roleKey]);
    }, 0);
  }, [visibleRoleKeys, totalsByRole]);

  const chartTitle = useMemo(() => {
    const prefix = mode === 'weekly' ? 'Weekly' : 'Monthly';

    if (selectedRole === 'all') return `${prefix} Enrollment Rate`;

    return `${prefix} ${ROLE_META_BY_KEY[selectedRole].label} Enrollment Rate`;
  }, [mode, selectedRole]);

  const totalLabel = useMemo(() => {
    if (selectedRole === 'all') return 'Total Enrollments';
    return `${ROLE_META_BY_KEY[selectedRole].label} Total`;
  }, [selectedRole]);

  const shouldShowGrandTotal = useMemo(() => {
    return selectedRole === 'all';
  }, [selectedRole]);

  const getToggleButtonClass = (isActive) =>
    `px-3 py-1 border rounded-pill text-sm fw-medium ${
      isActive
        ? 'text-white'
        : 'border-secondary-light text-secondary-light bg-transparent'
    }`;

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: '200px' }}
      >
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
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg) }
              100% { transform: rotate(360deg) }
            }
          `}
        </style>
      </div>
    );
  }

  return (
    <div className="col-xxl-8">
      <div className="card radius-8 border-0 p-20">
        <div className="row gy-4">
          <div className="col-xxl-4">
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
                  <h5 className="fw-semibold mb-0">{dashboardData?.total_students ?? 0}</h5>
                  <p className="text-sm mb-0 d-flex align-items-center gap-8">
                    <span className="text-white px-1 rounded-2 fw-medium bg-success-main text-sm">
                      +{dashboardData?.currentmonth_users_students ?? 0}
                    </span>
                    This Month
                  </p>
                </div>
              </div>
            </div>

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
                  <h5 className="fw-semibold mb-0">{dashboardData?.total_booking ?? 0}</h5>
                  <p className="text-sm mb-0 d-flex align-items-center gap-8">
                    <span className="text-white px-1 rounded-2 fw-medium bg-success-main text-sm">
                      +{dashboardData?.currentmonth_booking ?? 0}
                    </span>
                    This Month
                  </p>
                </div>
              </div>
            </div>

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
                  <h5 className="fw-semibold mb-0">AED {aed(dashboardData?.totalpayments)}</h5>
                  <p className="text-sm mb-0 d-flex align-items-center gap-8">
                    <span className="text-white px-1 rounded-2 fw-medium bg-success-main text-sm">
                      +AED {aed(dashboardData?.currentmonth_payments)}
                    </span>
                    This Month
                  </p>
                </div>
              </div>
            </div>

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
                  <h5 className="fw-semibold mb-0">AED {aed(dashboardData?.profit)}</h5>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xxl-8">
            <div className="card-body p-0">
              <div className="row g-3 align-items-start mb-3">
                <div className="col-12 col-xl-5">
                  <div
                    style={{
                      minHeight: '52px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <h6
                      className="mb-1 fw-bold text-lg"
                      style={{
                        lineHeight: '1.35',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                      }}
                    >
                      {chartTitle}
                    </h6>
                  </div>
                </div>

                <div className="col-12 col-xl-7">
                  <div className="d-flex flex-column align-items-xl-end align-items-start gap-2 w-100">
                    <div className="d-flex gap-2 flex-wrap justify-content-xl-end justify-content-start w-100">
                      <button
                        type="button"
                        onClick={() => setMode('monthly')}
                        className={getToggleButtonClass(mode === 'monthly')}
                        style={
                          mode === 'monthly'
                            ? { backgroundColor: '#487FFF', borderColor: '#487FFF' }
                            : {}
                        }
                      >
                        Monthly
                      </button>

                      <button
                        type="button"
                        onClick={() => setMode('weekly')}
                        className={getToggleButtonClass(mode === 'weekly')}
                        style={
                          mode === 'weekly'
                            ? { backgroundColor: '#487FFF', borderColor: '#487FFF' }
                            : {}
                        }
                      >
                        Weekly
                      </button>
                    </div>

                    <div className="d-flex flex-wrap gap-2 justify-content-xl-end justify-content-start w-100">
                      {ROLE_FILTERS.map((role) => {
                        const isActive = selectedRole === role.key;

                        return (
                          <button
                            key={role.key}
                            type="button"
                            onClick={() => setSelectedRole(role.key)}
                            className={getToggleButtonClass(isActive)}
                            style={
                              isActive
                                ? {
                                    backgroundColor: role.color,
                                    borderColor: role.color,
                                  }
                                : {}
                            }
                          >
                            {role.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <ul className="d-flex flex-wrap align-items-center justify-content-center mt-3 gap-3 ps-0 mb-0">
                {summaryRoles.map((role) => (
                  <li
                    key={role.key}
                    className="d-flex align-items-center gap-2"
                    style={{ listStyle: 'none' }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedRole(role.key)}
                      className="border-0 bg-transparent p-0 d-flex align-items-center gap-2"
                    >
                      <span
                        className="w-12-px h-12-px rounded-circle"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="text-secondary-light text-sm fw-semibold">
                        {role.label}:{' '}
                        <span className="text-primary-light fw-bold">{role.total}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {shouldShowGrandTotal && (
                <div className="text-center mt-2">
                  <span className="text-secondary-light text-sm fw-semibold">
                    {totalLabel}:{' '}
                    <span className="text-primary-light fw-bold">{selectedTotal}</span>
                  </span>
                </div>
              )}

              <div className="mt-40">
                <div id="enrollmentChart" className="apexcharts-tooltip-style-1">
                  {chartCategories.length > 0 ? (
                    buildAreaChart({
                      categories: chartCategories,
                      series: chartSeries,
                      colors: chartColors,
                    })
                  ) : (
                    <div className="py-5 text-center text-secondary-light">
                      No enrollment data available
                    </div>
                  )}
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