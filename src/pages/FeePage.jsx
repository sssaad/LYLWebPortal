import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import FeeLayer from "../components/FeeLayer"




const FeePage = () => {
  return (
    <>

      {/* MasterLayout */}
      <MasterLayout>

        {/* Breadcrumb */}
        <Breadcrumb title="Fee" />

        {/* LanguageLayer */}
        <FeeLayer />

      </MasterLayout>

    </>
  );
};

export default FeePage; 
