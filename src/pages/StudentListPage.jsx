import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import StudentListLayer from "../components/StudentListLayer";


function StudentListPage() {
  return (
    <>

      {/* MasterLayout */}
      <MasterLayout>

        {/* Breadcrumb */}
        <Breadcrumb title="Students" />

        {/* UsersListLayer */}
        <StudentListLayer />

      </MasterLayout>

    </>
  );
}

export default StudentListPage; 