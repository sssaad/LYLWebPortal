import React, { useEffect, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import { Icon } from '@iconify/react/dist/iconify.js';
import { getMonthwiseRevenue } from '../../api/getMonthwiseRevenue';

const EarningStaticOne = () => {
    const [loading, setLoading] = useState(true);
    const [totalRevenue, setTotalRevenue] = useState(0);

    const [chartData, setChartData] = useState({
        series: [{ name: 'Revenue', data: [] }],
        options: {
            chart: {
                type: 'bar',
                height: 310,
                toolbar: { show: false },
            },
            plotOptions: {
                bar: { borderRadius: 4, horizontal: false },
            },
            dataLabels: { enabled: false },
            xaxis: { categories: [] },
            yaxis: { title: { text: '' } },
            title: { text: '', align: 'left' },
            tooltip: {
                y: {
                    formatter: function (val) {
                        return "AED " + Number(val).toLocaleString();
                    }
                }
            }
        },
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const revenue = await getMonthwiseRevenue();

                if (revenue && Array.isArray(revenue)) {
                    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

                    // current month index from browser date
                    // Jan = 0, Feb = 1, ..., Dec = 11
                    const currentMonthIndex = new Date().getMonth();

                    // Total row alag nikal lo
                    const totalRow = revenue.find(
                        item => item.month?.toLowerCase() === 'total'
                    );

                    // Sirf valid months lo, Total ko exclude karo
                    // aur current month tak hi show karo
                    const filteredRevenue = revenue.filter(item => {
                        const monthIndex = monthOrder.indexOf(item.month);
                        return monthIndex !== -1 && monthIndex <= currentMonthIndex;
                    });

                    // month order ke hisaab se sort bhi kar do
                    const sortedRevenue = filteredRevenue.sort(
                        (a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
                    );

                    const months = sortedRevenue.map(item => item.month);
                    const totals = sortedRevenue.map(item => parseFloat(item.total_revenue) || 0);

                    setChartData(prev => ({
                        ...prev,
                        series: [{ name: 'Revenue', data: totals }],
                        options: {
                            ...prev.options,
                            xaxis: { categories: months },
                        }
                    }));

                    // Agar API total bhej rahi hai to woh use karo
                    // warna fallback mein visible months ka sum use ho jaye
                    setTotalRevenue(
                        totalRow ? parseFloat(totalRow.total_revenue) || 0 : totals.reduce((a, b) => a + b, 0)
                    );
                }
            } catch (error) {
                console.error('Error fetching monthwise revenue:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    border: '6px solid #e0e0e0',
                    borderTop: '6px solid #45B369',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
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
            <div className="card h-100 radius-8 border-0">
                <div className="card-body p-24">
                    <div className="d-flex align-items-center flex-wrap gap-2 justify-content-between">
                        <div>
                            <h6 className="mb-2 fw-bold text-lg">Revenue Statistic</h6>
                            <span className="text-sm fw-medium text-secondary-light">
                                Monthly Earning Overview
                            </span>
                        </div>
                        <span className="px-3 py-1 border border-secondary-light rounded-pill text-sm fw-medium text-secondary-light">
                            Monthly
                        </span>
                    </div>

                    <div className="mt-20 d-flex justify-content-center flex-wrap gap-3">
                        <div className="d-inline-flex align-items-center gap-2 p-2 radius-8 border pe-36 br-hover-primary group-item">
                            <span className="bg-neutral-100 w-44-px h-44-px text-xxl radius-8 d-flex justify-content-center align-items-center text-secondary-light group-hover:bg-primary-600 group-hover:text-white">
                                <Icon icon="uis:chart" className="icon" />
                            </span>
                            <div>
                                <span className="text-secondary-light text-sm fw-medium">
                                    Total Revenue
                                </span>
                                <h6 className="text-md fw-semibold mb-0">
                                    AED {Number(totalRevenue).toLocaleString()}
                                </h6>
                            </div>
                        </div>
                    </div>

                    <div id="barChart">
                        <ReactApexChart
                            options={chartData.options}
                            series={chartData.series}
                            type="bar"
                            height={310}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EarningStaticOne;