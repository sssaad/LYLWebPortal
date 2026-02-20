import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import BlockSubscriptionsListLayer from "../components/BlockSubscriptionsListLayer";

const BlockSubscriptionListPage = () => {
  return (
    <MasterLayout>
      <Breadcrumb title="Block Subscriptions" />
      <BlockSubscriptionsListLayer />
    </MasterLayout>
  );
};

export default BlockSubscriptionListPage;
