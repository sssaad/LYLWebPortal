import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Link, NavLink, useLocation } from "react-router-dom";
import ThemeToggleButton from "../helper/ThemeToggleButton";
import { getTeacherProfile } from "../api/getTeacherProfile";
import Swal from "sweetalert2";

const MasterLayout = ({ children }) => {
  const [sidebarActive, seSidebarActive] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const location = useLocation();
  const [teacherName, setTeacherName] = useState("User");
  const [teacherImage, setTeacherImage] = useState("assets/images/user.png");

  useEffect(() => {
    const fetchTeacherData = async () => {
      const teacherId = localStorage.getItem("teacherid");
      if (teacherId) {
        const data = await getTeacherProfile(teacherId);
        if (data) {
          const fullName = `${data.firstname || ""} ${data.lastname || ""}`.trim();
          const image = data.imagepath?.trim() || "assets/images/user.png";
          setTeacherName(fullName || "User");
          setTeacherImage(image);
        }
      }
    };
    fetchTeacherData();
  }, []);

  // ✅ Reload site after every 5 minutes
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     window.location.reload();
  //   }, 300000); // 5 minutes

  //   return () => clearInterval(interval);
  // }, []);

  useEffect(() => {
    const handleDropdownClick = (event) => {
      event.preventDefault();
      const clickedLink = event.currentTarget;
      const clickedDropdown = clickedLink.closest(".dropdown");
      if (!clickedDropdown) return;

      const isActive = clickedDropdown.classList.contains("open");
      const allDropdowns = document.querySelectorAll(".sidebar-menu .dropdown");
      allDropdowns.forEach((dropdown) => {
        dropdown.classList.remove("open");
        const submenu = dropdown.querySelector(".sidebar-submenu");
        if (submenu) submenu.style.maxHeight = "0px";
      });

      if (!isActive) {
        clickedDropdown.classList.add("open");
        const submenu = clickedDropdown.querySelector(".sidebar-submenu");
        if (submenu) submenu.style.maxHeight = `${submenu.scrollHeight}px`;
      }
    };

    const dropdownTriggers = document.querySelectorAll(
      ".sidebar-menu .dropdown > a, .sidebar-menu .dropdown > Link"
    );
    dropdownTriggers.forEach((trigger) => {
      trigger.addEventListener("click", handleDropdownClick);
    });

    const openActiveDropdown = () => {
      const allDropdowns = document.querySelectorAll(".sidebar-menu .dropdown");
      allDropdowns.forEach((dropdown) => {
        const submenuLinks = dropdown.querySelectorAll(".sidebar-submenu li a");
        submenuLinks.forEach((link) => {
          if (
            link.getAttribute("href") === location.pathname ||
            link.getAttribute("to") === location.pathname
          ) {
            dropdown.classList.add("open");
            const submenu = dropdown.querySelector(".sidebar-submenu");
            if (submenu) submenu.style.maxHeight = `${submenu.scrollHeight}px`;
          }
        });
      });
    };

    openActiveDropdown();
    return () => {
      dropdownTriggers.forEach((trigger) => {
        trigger.removeEventListener("click", handleDropdownClick);
      });
    };
  }, [location.pathname]);

  const sidebarControl = () => seSidebarActive(!sidebarActive);
  const mobileMenuControl = () => setMobileMenu(!mobileMenu);

  const handleLogout = () => {
    Swal.fire({
      icon: "success",
      title: "Logged Out",
      text: "You have been successfully logged out.",
      timer: 1500,
      showConfirmButton: false,
      position: "center",
      timerProgressBar: true,
      willClose: () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/";
      },
    });
  };

  return (
    <section className={mobileMenu ? "overlay active" : "overlay"}>
      <aside
        className={
          sidebarActive
            ? "sidebar active"
            : mobileMenu
            ? "sidebar sidebar-open"
            : "sidebar"
        }
      >
        <button onClick={mobileMenuControl} type="button" className="sidebar-close-btn">
          <Icon icon="radix-icons:cross-2" />
        </button>
        <div>
          <Link to="/" className="sidebar-logo">
            <img src="assets/images/logo.png" alt="site logo" className="light-logo" />
            <img src="assets/images/logo-light.png" alt="site logo" className="dark-logo" />
            <img src="assets/images/logo-icon.png" alt="site logo" className="logo-icon" />
          </Link>
        </div>
        <div className="sidebar-menu-area">
          <ul className="sidebar-menu" id="sidebar-menu">
            <li>
              <NavLink to="/index" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="solar:home-smile-angle-outline" className="menu-icon" />
                <span>Dashboard</span>
              </NavLink>
            </li>
            <li className="sidebar-menu-group-title">Application</li>
            <li>
              <NavLink to="/students-list" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="mdi:book-education-outline" className="menu-icon" />
                <span>Students</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/teachers-list" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="game-icons:teacher" className="menu-icon" />
                <span>Teachers</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/parents-list" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="mdi:family-tree" className="menu-icon" />
                <span>Parents</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/subject" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="solar:calendar-outline" className="menu-icon" />
                <span>Subjects</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/bookings" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="material-symbols:map-outline" className="menu-icon" />
                <span>Bookings</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/subscription" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="material-symbols:subscriptions-outline" className="menu-icon" />
                <span>Subscriptions</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/block-subscription" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="mdi:credit-card-lock-outline" className="menu-icon" />
                <span>Block Subscriptions</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/promocodes" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="material-symbols:sell-outline" className="menu-icon" />
                <span>Promo Codes</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/payments" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="mdi:credit-card-outline" className="menu-icon" />
                <span>Payments</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/email" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="mdi:email-check-outline" className="menu-icon" />
                <span>Confirmation Emails</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/invoice-list" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="mdi:receipt-outline" className="menu-icon" />
                <span>Invoices</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/session-feedbacks" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="mdi:message-text-outline" className="menu-icon" />
                <span>Session Feedbacks</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/teacher-payouts" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="mdi:cash-multiple" className="menu-icon" />
                <span>Teacher Payouts</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/setting" className={({ isActive }) => (isActive ? "active-page" : "")}>
                <Icon icon="icon-park-outline:setting-two" className="menu-icon" />
                <span>Settings</span>
              </NavLink>
            </li>
          </ul>
        </div>
      </aside>

      <main className={sidebarActive ? "dashboard-main active" : "dashboard-main"}>
        <div className="navbar-header">
          <div className="row align-items-center justify-content-between">
            <div className="col-auto">
              <div className="d-flex flex-wrap align-items-center gap-4">
                <button type="button" className="sidebar-toggle" onClick={sidebarControl}>
                  {sidebarActive ? (
                    <Icon icon="iconoir:arrow-right" className="icon text-2xl non-active" />
                  ) : (
                    <Icon icon="heroicons:bars-3-solid" className="icon text-2xl non-active" />
                  )}
                </button>
                <button onClick={mobileMenuControl} type="button" className="sidebar-mobile-toggle">
                  <Icon icon="heroicons:bars-3-solid" className="icon" />
                </button>
              </div>
            </div>
            <div className="col-auto">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <ThemeToggleButton />
                <div className="dropdown">
                  <button className="d-flex justify-content-center align-items-center rounded-circle" type="button" data-bs-toggle="dropdown">
                    <img src={teacherImage} onError={(e) => (e.target.src = "assets/images/user.png")} alt="image_user" className="w-40-px h-40-px object-fit-cover rounded-circle" />
                  </button>
                  <div className="dropdown-menu to-top dropdown-menu-sm">
                    <div className="py-12 px-16 radius-8 bg-primary-50 mb-16 d-flex align-items-center justify-content-between gap-2">
                      <div>
                        <h6 className="text-lg text-primary-light fw-semibold mb-2">{teacherName}</h6>
                        <span className="text-secondary-light fw-medium text-sm">Admin</span>
                      </div>
                      <button type="button" className="hover-text-danger">
                        <Icon icon="radix-icons:cross-1" className="icon text-xl" />
                      </button>
                    </div>
                    <ul className="to-top-list">
                      <li>
                        <Link className="dropdown-item text-black px-0 py-8 hover-bg-transparent hover-text-primary d-flex align-items-center gap-3" to="/setting">
                          <Icon icon="solar:user-linear" className="icon text-xl" /> My Profile
                        </Link>
                      </li>
                      <li>
                        <button
                          onClick={handleLogout}
                          className="dropdown-item text-black px-0 py-8 hover-bg-transparent hover-text-danger d-flex align-items-center gap-3 bg-transparent border-0 w-100 text-start"
                        >
                          <Icon icon="lucide:power" className="icon text-xl" /> Log Out
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-main-body">{children}</div>

        <footer className="d-footer">
          <div className="row align-items-center justify-content-between">
            <div className="col-auto">
              <p className="mb-0">© 2025 Gostudy.ae All Rights Reserved.</p>
            </div>
            <div className="col-auto">
              <p className="mb-0">
                Made by <span className="text-primary-600">GoStudy.ae</span>
              </p>
            </div>
          </div>
        </footer>
      </main>
    </section>
  );
};

export default MasterLayout;
