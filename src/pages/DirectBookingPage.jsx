import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import DirectBookingLayer from "../components/DirectBookingLayer";

const DirectBookingPage = () => {
  return (
    <>

      {/* MasterLayout */}
      <MasterLayout>

        {/* Breadcrumb */}
        <Breadcrumb title="Direct Bookings" />

        {/* RoleAccessLayer */}
        <DirectBookingLayer />

      </MasterLayout>

    </>
  );
};

export default DirectBookingPage; 
