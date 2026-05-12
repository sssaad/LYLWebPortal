import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import WeeklyTimetablePortalLayer from "../components/WeeklyTimetablePortalLayer";

const WeeklyTimetablePage = () => {
  return (
    <MasterLayout>
      <Breadcrumb title="Weekly Timetable" />
      <WeeklyTimetablePortalLayer />
    </MasterLayout>
  );
};

export default WeeklyTimetablePage;