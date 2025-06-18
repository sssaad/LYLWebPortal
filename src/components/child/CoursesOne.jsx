import { Icon } from '@iconify/react/dist/iconify.js'
import React from 'react'
import { Link } from 'react-router-dom'

const CoursesOne = () => {

    return (
        <div className="col-xxl-12">
            <div className="card h-100">
                <div className="card-header">
                    <div className="d-flex align-items-center flex-wrap gap-2 justify-content-between">
                        <h6 className="mb-2 fw-bold text-lg mb-0">Course Enrollments</h6>
                        {/* <Link
                            to="#"
                            className="text-primary-600 hover-text-primary d-flex align-items-center gap-1"
                        >
                            View All
                            <Icon
                                icon="solar:alt-arrow-right-linear"
                                className="icon"
                            />
                        </Link> */}
                    </div>
                </div>
                <div className="card-body p-24">
                    <div className="table-responsive scroll-sm">
                        <table className="table bordered-table mb-0">
                            <thead>
                                <tr>
                                    <th scope="col">Registered On</th>
                                    <th scope="col">Instructors </th>
                                    <th scope="col">Users</th>
                                    <th scope="col">Enrolled</th>
                                    <th scope="col">Price </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        <span className="text-secondary-light">24 Feb 2025</span>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">Ayesha Ali</span>
                                    </td>
                                    <td>
                                        <div className="text-secondary-light">
                                            <h6 className="text-md mb-0 fw-normal">
                                                Urdu Lessons
                                            </h6>
                                            <span className="text-sm fw-normal">2 Lessons</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">2</span>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">$25.00</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <span className="text-secondary-light">24 Feb 2025</span>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">Gautham Kumar</span>
                                    </td>
                                    <td>
                                        <div className="text-secondary-light">
                                            <h6 className="text-md mb-0 fw-normal">
                                               Hindi Lessons
                                            </h6>
                                            <span className="text-sm fw-normal">2 Lessons</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">2</span>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">$29.00</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <span className="text-secondary-light">25 Feb 2025</span>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">Sukhdeep Singh</span>
                                    </td>
                                    <td>
                                        <div className="text-secondary-light">
                                            <h6 className="text-md mb-0 fw-normal">
                                                Punjabi Lessons
                                            </h6>
                                            <span className="text-sm fw-normal">5 Lessons</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">5</span>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">$35.00</span>
                                    </td>
                                </tr>
                                {/* <tr>
                                    <td>
                                        <span className="text-secondary-light">24 Jun 2024</span>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">Floyd Miles</span>
                                    </td>
                                    <td>
                                        <div className="text-secondary-light">
                                            <h6 className="text-md mb-0 fw-normal">
                                                Advanced App Development
                                            </h6>
                                            <span className="text-sm fw-normal">25 Lessons</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">57</span>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">$29.00</span>
                                    </td>
                                </tr> */}
                                {/* <tr>
                                    <td>
                                        <span className="text-secondary-light">24 Jun 2024</span>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">Ralph Edwards</span>
                                    </td>
                                    <td>
                                        <div className="text-secondary-light">
                                            <h6 className="text-md mb-0 fw-normal">
                                                HTML Fundamental Course
                                            </h6>
                                            <span className="text-sm fw-normal">17 Lessons&nbsp;</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">27</span>
                                    </td>
                                    <td>
                                        <span className="text-secondary-light">$29.00</span>
                                    </td>
                                </tr> */}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CoursesOne