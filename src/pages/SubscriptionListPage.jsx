import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import SubscriptionsListLayer from "../components/SubscriptionsListLayer";

const SubscriptionListPage = () => {
  return (
    <MasterLayout>
      <Breadcrumb title="Subscriptions" />
      <SubscriptionsListLayer />
    </MasterLayout>
  );
};

export default SubscriptionListPage;
