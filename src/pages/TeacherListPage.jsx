import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import TeacherListLayer from "../components/TeacherListLayer";




const TeacherListPage = () => {
  return (
    <>

      {/* MasterLayout */}
      <MasterLayout>

        {/* Breadcrumb */}
        <Breadcrumb title="Teachers" />

        {/* InvoiceListLayer */}
        <TeacherListLayer />

      </MasterLayout>

    </>
  );
};

export default TeacherListPage;