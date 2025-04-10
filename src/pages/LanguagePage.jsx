import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import LanguageLayer from "../components/LanguageLayer";




const LanguagePage = () => {
  return (
    <>

      {/* MasterLayout */}
      <MasterLayout>

        {/* Breadcrumb */}
        <Breadcrumb title="Courses" />

        {/* LanguageLayer */}
        <LanguageLayer />

      </MasterLayout>

    </>
  );
};

export default LanguagePage; 
