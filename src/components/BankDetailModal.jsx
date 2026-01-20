import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { getToken } from "../api/getToken";

const BankDetailModal = ({ teacherId, teacherName, paymentInfo, onClose, onSaved }) => {
  const initialState = {
    bankname: "",
    accounttitle: "",
    bankaccountno: "",
    iban: "",
    sortcode: "",
    swiftcode: "",
    currency: "AED",
    minHourlyRate: "",
  };

  const [bankData, setBankData] = useState(initialState);
  const [loading, setLoading] = useState(false);

  // ✅ helper: agar kisi bhi field me value ho to "has values"
  const hasAnyValue = (obj) => {
    if (!obj) return false;
    const keys = ["bankname","accounttitle","bankaccountno","iban","sortcode","swiftcode","currency","minHourlyRate"];
    return keys.some((k) => {
      const v = obj?.[k];
      return v !== null && v !== undefined && String(v).trim() !== "";
    });
  };

  const firstInfo = useMemo(() => {
    return Array.isArray(paymentInfo) && paymentInfo.length > 0 ? paymentInfo[0] : null;
  }, [paymentInfo]);

  // ✅ mode decide HERE
  const isUpdateMode = useMemo(() => hasAnyValue(firstInfo), [firstInfo]);

  // ✅ seed form: update mode => values fill, add mode => blank defaults
  useEffect(() => {
    if (isUpdateMode && firstInfo) {
      setBankData({ ...initialState, ...firstInfo, currency: firstInfo.currency || "AED" });
    } else {
      setBankData(initialState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, isUpdateMode]);

  const fieldLabels = {
    bankname: "Bank Name",
    accounttitle: "Account Title",
    bankaccountno: "Bank Account Number",
    iban: "IBAN Number",
    sortcode: "Sort Code",
    swiftcode: "SWIFT Code",
    currency: "Currency",
    minHourlyRate: "Min Hourly Rate",
  };

  const currencyOptions = ["AED", "USD", "GBP", "EUR", "SAR"];
  const inputClass = "form-control mb-2";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBankData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      const tk = await getToken();
      const tokenValue = typeof tk === "string" ? tk : tk?.token || tk?.data?.token;

      const headers = {
        projectid: "1",
        userid: "test",
        password: "test",
        "x-api-key": "abc123456789",
        token: tokenValue,
        "Content-Type": "application/json",
      };

      let url = "";
      let payload = {};

      if (!isUpdateMode) {
        // ✅ ADD
        url = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=add_dynamic_data";
        payload = {
          tablename: "teacherpaymentinformation",
          userid: Number(teacherId),
          bankname: bankData.bankname || "",
          bankaccountno: bankData.bankaccountno || "",
          iban: bankData.iban || "",
          sortcode: bankData.sortcode || "",
          swiftcode: bankData.swiftcode || "",
          accounttitle: bankData.accounttitle || "",
          currency: bankData.currency || "AED",
          minHourlyRate:
            bankData.minHourlyRate === "" || bankData.minHourlyRate == null
              ? ""
              : Number(bankData.minHourlyRate),
        };
      } else {
        // ✅ UPDATE (id nahi mil raha data me, so userid based update)
        url = "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";
        payload = {
          tablename: "teacherpaymentinformation",
          conditions: [
            { userid: Number(teacherId) } // ✅ key point
          ],
          updatedata: [
            {
              bankname: bankData.bankname || "",
              bankaccountno: bankData.bankaccountno || "",
              iban: bankData.iban || "",
              sortcode: bankData.sortcode || "",
              swiftcode: bankData.swiftcode || "",
              accounttitle: bankData.accounttitle || "",
              currency: bankData.currency || "AED",
              minHourlyRate:
                bankData.minHourlyRate === "" || bankData.minHourlyRate == null
                  ? ""
                  : String(bankData.minHourlyRate),
            },
          ],
        };
      }

      const { data } = await axios.post(url, payload, { headers });

      if (data?.statusCode === 200) {
        Swal.fire({
          icon: "success",
          title: isUpdateMode ? "Updated!" : "Added!",
          text: isUpdateMode ? "Bank details updated successfully." : "Bank details added successfully.",
          timer: 1500,
          showConfirmButton: false,
        });

        onSaved?.();  // ✅ refresh list
        onClose?.();
      } else {
        Swal.fire("Failed!", data?.message || "Save failed.", "error");
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Network error";
      Swal.fire("Error!", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const fields = ["bankname","accounttitle","bankaccountno","iban","sortcode","swiftcode","currency","minHourlyRate"];

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-md modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{isUpdateMode ? "Update Bank Detail" : "Add Bank Detail"}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            <h6>Teacher:</h6>
            <p>{teacherName || `Teacher #${teacherId}`}</p>
            <hr />

            <div className="row">
              {fields.map((field) => (
                <div className="col-6" key={field}>
                  <label>{fieldLabels[field]}</label>

                  {field === "currency" ? (
                    <select className={inputClass} name={field} value={bankData[field] || "AED"} onChange={handleChange}>
                      {currencyOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : field === "minHourlyRate" ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={inputClass}
                      name={field}
                      value={bankData[field] ?? ""}
                      onChange={handleChange}
                    />
                  ) : (
                    <input
                      type="text"
                      className={inputClass}
                      name={field}
                      value={bankData[field] ?? ""}
                      onChange={handleChange}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : isUpdateMode ? "Update Details" : "Add Details"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankDetailModal;
