import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import CoursesLayer from "../components/CoursesLayer"




const CoursesPage = () => {
  return (
    <>

      {/* MasterLayout */}
      <MasterLayout>

        {/* Breadcrumb */}
        <Breadcrumb title="Subjects" />

        {/* LanguageLayer */}
        <CoursesLayer />

      </MasterLayout>

    </>
  );
};

export default CoursesPage; 
