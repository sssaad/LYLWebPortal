import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import StudentfeedbackLayer from "../components/StudentfeedbackLayer";


const StudentfeedbackPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>

        {/* Breadcrumb */}
        <Breadcrumb title="Teacher Reviews" />

        {/* EmailLayer */}
        <StudentfeedbackLayer />


      </MasterLayout>
    </>
  );
};

export default StudentfeedbackPage;
