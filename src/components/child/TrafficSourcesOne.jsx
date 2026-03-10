import React, { useEffect, useState, useMemo } from 'react';
import useReactApexChart from '../../hook/useReactApexChart';
import ReactApexChart from 'react-apexcharts';
import { getDashboardCounts } from '../../api/getDashboardCounts';
import { useNavigate } from 'react-router-dom';

const TrafficSourcesOne = () => {
  const [data, setData] = useState(null);
  const [chartSeries, setChartSeries] = useState([0, 0, 0]);

  const navigate = useNavigate();
  let { userOverviewDonutChartOptions } = useReactApexChart();

  useEffect(() => {
    const fetchCounts = async () => {
      const result = await getDashboardCounts();
      if (result) {
        setData(result);
        const teacher = parseInt(result.total_teachers || 0);
        const student = parseInt(result.total_students || 0);
        const parent = parseInt(result.total_parents || 0);
        setChartSeries([teacher, student, parent]);
      }
    };
    fetchCounts();
  }, []);

  const goToList = (index) => {
    if (index === 0) navigate('/teachers-list');
    if (index === 1) navigate('/students-list');
    if (index === 2) navigate('/parents-list');
  };

  // ✅ Add click event on chart (donut slice click)
  const optionsWithClick = useMemo(() => ({
  ...userOverviewDonutChartOptions,
  labels: ['Teachers', 'Students', 'Parents'],
  chart: {
    ...(userOverviewDonutChartOptions?.chart || {}),
    events: {
      ...(userOverviewDonutChartOptions?.chart?.events || {}),
      dataPointSelection: (event, chartContext, config) => {
        const index = config?.dataPointIndex;
        if (index === undefined || index === -1) return;
        setTimeout(() => goToList(index), 0);
      },
    },
  },
}), [userOverviewDonutChartOptions]);

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
    <div className="col-xxl-4 col-md-6">
      <div className="card h-100 radius-8 border-0">
        <div className="card-body p-24 d-flex flex-column justify-content-between gap-8">
          <div className="d-flex align-items-center flex-wrap gap-2 justify-content-between mb-20">
            <h6 className="mb-2 fw-bold text-lg mb-0">Total Users</h6>
          </div>

          <div id="userOverviewDonutChart" className="margin-16-minus y-value-left" />

          <ReactApexChart
            options={optionsWithClick}
            series={chartSeries}
            type="donut"
            height={270}
          />

          {/* ✅ Make these clickable too */}
          <ul className="d-flex flex-wrap align-items-center justify-content-between mt-3 gap-3">
            <li
              className="d-flex flex-column gap-8"
              role="button"
              style={{ cursor: 'pointer' }}
              onClick={() => goToList(0)}
            >
              <div className="d-flex align-items-center gap-2">
                <span className="w-12-px h-12-px rounded-circle bg-warning-600" />
                <span className="text-secondary-light text-sm fw-semibold">Teachers</span>
              </div>
              <span className="text-primary-light fw-bold">{data.total_teachers}</span>
            </li>

            <li
              className="d-flex flex-column gap-8"
              role="button"
              style={{ cursor: 'pointer' }}
              onClick={() => goToList(1)}
            >
              <div className="d-flex align-items-center gap-2">
                <span className="w-12-px h-12-px rounded-circle bg-success-600" />
                <span className="text-secondary-light text-sm fw-semibold">Students</span>
              </div>
              <span className="text-primary-light fw-bold">{data.total_students}</span>
            </li>

            <li
              className="d-flex flex-column gap-8"
              role="button"
              style={{ cursor: 'pointer' }}
              onClick={() => goToList(2)}
            >
              <div className="d-flex align-items-center gap-2">
                <span className="w-12-px h-12-px rounded-circle bg-primary-600" />
                <span className="text-secondary-light text-sm fw-semibold">Parents</span>
              </div>
              <span className="text-primary-light fw-bold">{data.total_parents}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TrafficSourcesOne;