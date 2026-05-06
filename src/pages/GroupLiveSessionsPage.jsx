import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import GroupLiveSessionsLayer from "../components/GroupLiveSessionsLayer";

const GroupLiveSessionsPage = () => {
  return (
    <MasterLayout>
      <Breadcrumb title="Live Group Sessions" />
      <GroupLiveSessionsLayer />
    </MasterLayout>
  );
};

export default GroupLiveSessionsPage;