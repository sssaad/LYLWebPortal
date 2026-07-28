import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import GroupBookingListLayer from "../components/GroupBookingListLayer";

const GroupBookingPage = () => {
  return (
    <MasterLayout>
      <GroupBookingListLayer />
    </MasterLayout>
  );
};

export default GroupBookingPage;