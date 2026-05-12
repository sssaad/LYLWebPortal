import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import RegistrationRequestsLayer from "../components/RegistrationRequestsLayer";

const RegistrationRequestsPage = () => {
  return (
    <>
      <MasterLayout>
        <Breadcrumb title="Registration Requests" />
        <RegistrationRequestsLayer />
      </MasterLayout>
    </>
  );
};

export default RegistrationRequestsPage;