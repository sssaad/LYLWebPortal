import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import TeacherPayoutListPage from "../components/TeacherPayoutListPage";

const TeacherPayoutPage = () => {
  return (
    <MasterLayout>
      <Breadcrumb title="Teacher Payouts" />
      <TeacherPayoutListPage />
    </MasterLayout>
  );
};

export default TeacherPayoutPage;
