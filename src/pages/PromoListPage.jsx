import React from "react";
import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import PromoListLayer from "../components/PromoListLayer";

const PromoListPage = () => {
  return (
    <MasterLayout>
      <Breadcrumb title="Promo Codes" />
      <PromoListLayer />
    </MasterLayout>
  );
};

export default PromoListPage;
