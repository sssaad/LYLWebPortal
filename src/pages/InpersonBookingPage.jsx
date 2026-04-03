import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import InpersonBookingLayer from "../components/InpersonBookingLayer";

const InpersonBookingPage = () => {
  return (
    <>

      {/* MasterLayout */}
      <MasterLayout>

        {/* Breadcrumb */}
        <Breadcrumb title="In-Person Bookings" />

        {/* RoleAccessLayer */}
        <InpersonBookingLayer />

      </MasterLayout>

    </>
  );
};

export default InpersonBookingPage; 
