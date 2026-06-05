import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import GroupClassInquiriesLayer from "../components/GroupClassInquiriesLayer";

const GroupClassInquiriesPage = () => {
  return (
    <MasterLayout>
      <Breadcrumb title="Group Class Inquiries" />
      <GroupClassInquiriesLayer />
    </MasterLayout>
  );
};

export default GroupClassInquiriesPage;