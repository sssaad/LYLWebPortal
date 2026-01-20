import { Icon } from "@iconify/react";
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";


const SignInLayer = () => {
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const baseURL = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=";
  const headers = {
    projectid: "1",
    userid: "test",
    password: "test",
    "x-api-key": "abc123456789",
  };

  useEffect(() => {
    const isLoggedIn = localStorage.getItem("user_id");
    if (isLoggedIn) {
      navigate("/index", { replace: true });
    }

    window.history.pushState(null, null, window.location.href);
    const handlePopState = () => window.history.go(1);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("userid", userid);
    formData.append("password", password);

    try {
      const response = await axios.post(`${baseURL}user_login`, formData, {
        headers: {
          ...headers,
          "Content-Type": "multipart/form-data",
        },
      });

      const data = response.data;

      if (data.statusCode === 200 && data.message === "Successful") {
        const user = data.data.userdata[0];

        if (user.roleid !== 6) {
          Swal.fire({
            icon: "info",
            title: "Access Restricted",
            text: "Only Admin accounts are allowed.",
            iconColor: "#ff8800",
            timer: 2000,
            showConfirmButton: false,
            position: "center",
          });
          return;
        }

        localStorage.setItem("user_id", user.id);
        localStorage.setItem("teacherid", user.id);
        localStorage.setItem("user_email", user.email);
        localStorage.setItem("user_name", user.fullname);
        localStorage.setItem("role_id", user.roleid);
        const cleanImagePath = user.imagepath?.trim() || "assets/images/user.png";
        localStorage.setItem("user_image", cleanImagePath);

        Swal.fire({
          icon: "success",
          title: "Login Successful",
          text: "Welcome back!",
          timer: 1500,
          position: "center",
          showConfirmButton: false,
          timerProgressBar: true,
          didClose: () => {
            navigate("/index");
          },
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Login Failed",
          text: data.message || "Invalid credentials",
          position: "center",
          showConfirmButton: false,
          timer: 2000,
        });
      }
    } catch (error) {
      console.error("Login Error:", error);
      Swal.fire({
        icon: "error",
        title: "Something went wrong",
        text: "Please try again.",
        position: "center",
        showConfirmButton: false,
        timer: 2000,
      });
    }
  };

  return (
    <section className='auth bg-base d-flex flex-wrap'>
      <div className='auth-left d-lg-block d-none'>
        <div className='d-flex align-items-center flex-column h-100 justify-content-center'>
          <img src='assets/images/auth/auth-img.png' alt='' />
        </div>
      </div>
      <div className='auth-right py-32 px-24 d-flex flex-column justify-content-center'>
        <div className='max-w-464-px mx-auto w-100'>
          <div>
            <Link to='/' className='mb-40 max-w-290-px' style={{ marginLeft: '80px' }}>
              <img src='assets/images/logo.png' alt='' />
            </Link>
            <h4 className='mb-12'>Sign In to your Account</h4>
            <p className='mb-32 text-secondary-light text-lg'>
              Welcome back! please enter your detail
            </p>
          </div>

          <form onSubmit={handleLogin} autoComplete="on">
            <div className='icon-field mb-16'>
              <span className='icon top-50 translate-middle-y'>
                <Icon icon='mage:email' />
              </span>
              <input
                type='email'
                className='form-control h-56-px bg-neutral-50 radius-12'
                placeholder='Email'
                value={userid}
                name='email'
                autoComplete='email'
                onChange={(e) => setUserid(e.target.value)}
                required
              />
            </div>

            <div className='position-relative mb-20'>
              <div className='icon-field'>
                <span className='icon top-50 translate-middle-y'>
                  <Icon icon='solar:lock-password-outline' />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className='form-control h-56-px bg-neutral-50 radius-12'
                  placeholder='Password'
                  value={password}
                  name='password'
                  autoComplete='password'
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <span
                  className='position-absolute top-50 end-0 translate-middle-y pe-16'
                  style={{ cursor: "pointer" }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <Icon icon={showPassword ? "mdi:eye-off" : "mdi:eye"} />
                </span>
              </div>
            </div>

            <div className='d-flex justify-content-between gap-2'>
              {/* <Link to='#' className='text-primary-600 fw-medium'>
                Forgot Password?
              </Link> */}
            </div>

            <button
              type='submit'
              className='btn btn-primary text-sm btn-sm px-12 py-16 w-100 radius-12 mt-32'
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default SignInLayer;
