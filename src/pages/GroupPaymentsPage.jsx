import MasterLayout from "../masterLayout/MasterLayout";
import Breadcrumb from "../components/Breadcrumb";
import GroupPaymentsLayer from "../components/GroupPaymentsLayer";

const GroupPaymentsPage = () => {
  return (
    <MasterLayout>
      <Breadcrumb title="Group Payments" />
      <GroupPaymentsLayer />
    </MasterLayout>
  );
};

export default GroupPaymentsPage;