import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import LeadCentreLayer from "../components/LeadCentreLayer";

const LeadCentrePage = () => {
  return (
    <>

      {/* MasterLayout */}
      <MasterLayout>

        {/* Breadcrumb */}
        <Breadcrumb title="Leads Centre" />

        {/* RoleAccessLayer */}
        <LeadCentreLayer/>

      </MasterLayout>

    </>
  );
};

export default LeadCentrePage; 
