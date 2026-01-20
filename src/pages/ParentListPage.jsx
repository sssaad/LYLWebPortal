import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import ParentListLayer from "../components/ParentListLayer";




const ParentListPage = () => {
  return (
    <>

      {/* MasterLayout */}
      <MasterLayout>

        {/* Breadcrumb */}
        <Breadcrumb title="Parents" />

        {/* InvoiceListLayer */}
        <ParentListLayer />

      </MasterLayout>

    </>
  );
};

export default ParentListPage;
