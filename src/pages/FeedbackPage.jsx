import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import FeedbackLayer from "../components/FeedbackLayer";


const FeedbackPage = () => {
  return (
    <>
      {/* MasterLayout */}
      <MasterLayout>

        {/* Breadcrumb */}
        <Breadcrumb title="Session Feedbacks" />

        {/* EmailLayer */}
        <FeedbackLayer />


      </MasterLayout>
    </>
  );
};

export default FeedbackPage;
